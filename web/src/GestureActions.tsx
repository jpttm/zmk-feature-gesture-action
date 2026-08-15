import { useCallback, useContext, useEffect, useState } from "react";
import {
  ZMKAppContext,
  useCustomSubsystem,
} from "@cormoran/zmk-studio-react-hook";
import {
  SUBSYSTEM_ID,
  UNSET,
  gestureActionCodec,
  type Action,
  type Request,
  type Response,
} from "./gestureActionCodec";
import { useBehaviors } from "./useBehaviors";
import {
  KEYCODE_GROUPS,
  MODIFIERS,
  describeKeycode,
  packKeycode,
  splitKeycode,
} from "./keycodes";
import { useT } from "./i18n";

export function GestureActions() {
  const t = useT();
  const zmk = useContext(ZMKAppContext);
  const { ready, call } = useCustomSubsystem<Request, Response>(
    SUBSYSTEM_ID,
    gestureActionCodec,
  );
  const { behaviors, loading: behaviorsLoading } = useBehaviors(
    zmk?.state.connection ?? null,
  );

  const [actions, setActions] = useState<Action[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [namesError, setNamesError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Paged: the firmware answers eight slots at a time so the response fits
      // the RPC buffer. Keep asking until we have covered every slot.
      const collected: Action[] = [];
      let startSlot = 0;
      let totalSlots = 0;

      for (;;) {
        const res = await call({ kind: "getActions", startSlot });
        if (!res) throw new Error(t("noResponse"));
        if (res.kind === "error") throw new Error(res.message);
        if (res.kind !== "getActions") throw new Error("Unexpected response");

        totalSlots = res.totalSlots;
        collected.push(...res.actions);

        if (res.actions.length === 0 || collected.length >= totalSlots) break;
        startSlot = collected.length;
      }

      setTotal(totalSlots);
      setActions(collected);

      // Failing here is not fatal - the table falls back to slot numbers. It
      // does need saying out loud though, because silently showing numbers
      // looks identical to firmware that simply has no names configured.
      const collectedNames: string[] = [];
      let nameFailure: string | null = null;
      startSlot = 0;

      for (;;) {
        const res = await call({ kind: "getSlotNames", startSlot });
        if (!res) {
          nameFailure = t("noResponse");
          break;
        }
        if (res.kind === "error") {
          nameFailure = res.message;
          break;
        }
        if (res.kind !== "getSlotNames") {
          nameFailure = t("oldFirmware");
          break;
        }
        collectedNames.push(...res.names);
        if (res.names.length === 0 || collectedNames.length >= res.totalSlots) break;
        startSlot = collectedNames.length;
      }

      setNames(collectedNames);
      setNamesError(nameFailure);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [call, t]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const apply = useCallback(
    async (request: Request) => {
      setBusy(true);
      setError(null);
      try {
        const res = await call(request);
        if (!res) throw new Error(t("noResponse"));
        if (res.kind === "error") throw new Error(res.message);
        setEditing(null);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    },
    [call, refresh, t],
  );

  if (!ready) {
    return (
      <section>
        <h2>{t("gestureActions")}</h2>
        <p className="muted">{t("notSupported")}</p>
      </section>
    );
  }

  const nameFor = (id: number) =>
    behaviors.find((b) => b.id === id)?.displayName ?? `#${id}`;

  return (
    <section>
      <h2>
        {t("gestureActions")} ({total})
      </h2>

      {behaviorsLoading && <p className="muted">{t("loadingBehaviors")}</p>}
      {error && <p className="warn">{error}</p>}
      {namesError && (
        <p className="muted small">
          {t("namesFallback")}（{namesError}）
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th className="slotCol">{t("slot")}</th>
            <th>{t("assignment")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {actions.flatMap((action) => {
            const row = (
              <tr key={action.slot}>
                <td className="slotCol">{names[action.slot] || action.slot}</td>
                <td>
                  {action.behaviorId === UNSET ? (
                    <span className="muted">{t("fromFirmware")}</span>
                  ) : isKeyPress(nameFor(action.behaviorId)) ? (
                    <code>{describeKeycode(action.param1)}</code>
                  ) : (
                    <code>
                      {nameFor(action.behaviorId)} {action.param1} {action.param2}
                    </code>
                  )}
                </td>
                <td className="right">
                  <button
                    className="ghost"
                    disabled={busy}
                    onClick={() =>
                      setEditing(editing === action.slot ? null : action.slot)
                    }
                  >
                    {editing === action.slot ? t("cancel") : t("edit")}
                  </button>
                </td>
              </tr>
            );

            if (editing !== action.slot) {
              return [row];
            }

            // The editor is its own row directly under the one being edited,
            // so the controls sit next to the thing they change.
            return [
              row,
              <tr key={`${action.slot}-editor`}>
                <td colSpan={3} className="editorCell">
                  <Editor
                    slot={action.slot}
                    label={names[action.slot] || `${t("slot")} ${action.slot}`}
                    current={action}
                    behaviors={behaviors}
                    busy={busy}
                    onApply={apply}
                  />
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>

      <div className="row">
        <button className="ghost" disabled={busy} onClick={() => void refresh()}>
          {t("reload")}
        </button>
      </div>
    </section>
  );
}

/** ZMK's key-press behaviour is the one worth giving a real picker. */
function isKeyPress(displayName: string): boolean {
  return displayName.toLowerCase().replace(/[\s_-]/g, "") === "keypress";
}

function Editor({
  slot,
  label,
  current,
  behaviors,
  busy,
  onApply,
}: {
  slot: number;
  label: string;
  current: Action | undefined;
  behaviors: { id: number; displayName: string }[];
  busy: boolean;
  onApply: (request: Request) => void;
}) {
  const t = useT();
  const [behaviorId, setBehaviorId] = useState(current?.behaviorId ?? 0);
  const [param1, setParam1] = useState(current?.param1 ?? 0);
  const [param2, setParam2] = useState(current?.param2 ?? 0);

  const action: Action = { slot, behaviorId, param1, param2 };
  const keyPress = isKeyPress(
    behaviors.find((b) => b.id === behaviorId)?.displayName ?? "",
  );
  const { mods, base } = splitKeycode(param1);

  return (
    <div className="editor">
      <h3>{label}</h3>

      <label>
        {t("behaviour")}
        <select
          value={behaviorId}
          onChange={(e) => setBehaviorId(Number(e.target.value))}
        >
          <option value={0}>{t("useFirmwareDefault")}</option>
          {behaviors.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
      </label>

      {keyPress ? (
        <>
          <div className="mods">
            {MODIFIERS.map((m) => (
              <label key={m.label} className="check">
                <input
                  type="checkbox"
                  checked={(mods & m.bit) !== 0}
                  onChange={(e) =>
                    setParam1(
                      packKeycode(
                        e.target.checked ? mods | m.bit : mods & ~m.bit,
                        base,
                      ),
                    )
                  }
                />
                {m.label}
              </label>
            ))}
          </div>

          <label>
            {t("keyLabel")}
            <select
              value={base}
              onChange={(e) => setParam1(packKeycode(mods, Number(e.target.value)))}
            >
              <option value={0}>{t("pickKey")}</option>
              {KEYCODE_GROUPS.map((group) => (
                <optgroup key={group.labelKey} label={t(group.labelKey)}>
                  {group.keys.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <p className="muted small">
            {t("sends")} <code>{describeKeycode(param1)}</code> — {t("sendsHint")}
          </p>
        </>
      ) : null}

      <details>
        <summary className="muted small">{t("rawParameters")}</summary>
        <div className="row">
          <label>
            param1
            <input
              type="number"
              min={0}
              value={param1}
              onChange={(e) => setParam1(Number(e.target.value))}
            />
          </label>
          <label>
            param2
            <input
              type="number"
              min={0}
              value={param2}
              onChange={(e) => setParam2(Number(e.target.value))}
            />
          </label>
        </div>
      </details>

      <div className="row">
        <button
          disabled={busy}
          onClick={() => onApply({ kind: "setAction", action, persist: true })}
        >
          {t("save")}
        </button>
        <button
          className="ghost"
          disabled={busy}
          onClick={() => onApply({ kind: "setAction", action, persist: false })}
          title={t("tryTitle")}
        >
          {t("tryWithoutSaving")}
        </button>
        <button
          className="ghost"
          disabled={busy}
          onClick={() => onApply({ kind: "resetAction", slot, persist: true })}
        >
          {t("resetToDefault")}
        </button>
      </div>
    </div>
  );
}
