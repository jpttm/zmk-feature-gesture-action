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
import { useLang, useT } from "./i18n";
import { PRESETS, type Preset } from "./presets";
import { GroupTabs } from "./GroupTabs";
import type { Group } from "./gestureActionCodec";

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
  const [preview, setPreview] = useState<Preset | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

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

      // Groups are optional: firmware without the layer-groups RPC still works,
      // it just cannot move a set between layers.
      const groupRes = await call({ kind: "getGroups" });
      setGroups(groupRes?.kind === "getGroups" ? groupRes.groups : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [call, t]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const setGroupLayers = useCallback(
    async (index: number, mask: number) => {
      setBusy(true);
      setError(null);
      try {
        const res = await call({
          kind: "setGroupLayers",
          index,
          activeLayers: mask,
          persist: true,
        });
        if (!res) throw new Error(t("noResponse"));
        if (res.kind === "error") throw new Error(res.message);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    },
    [call, refresh, t],
  );

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

  const applyPreset = useCallback(
    async (preset: Preset, keyPressId: number) => {
      setBusy(true);
      setError(null);
      try {
        // One RPC per slot: the protocol has no bulk write, and over BLE this
        // takes a moment - hence the busy state rather than silent waiting.
        for (const item of preset.actions) {
          const res = await call({
            kind: "setAction",
            action: {
              slot: item.slot,
              behaviorId: keyPressId,
              param1: item.keycode,
              param2: 0,
            },
            persist: true,
          });
          if (!res) throw new Error(t("noResponse"));
          if (res.kind === "error") throw new Error(res.message);
        }
        setPreview(null);
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

      <Presets
        total={total}
        names={names}
        busy={busy}
        keyPressId={behaviors.find((b) => isKeyPress(b.displayName))?.id ?? null}
        preview={preview}
        onPreview={setPreview}
        onApply={applyPreset}
      />

      <GroupTabs
        groups={groups}
        totalSlots={total}
        actions={actions}
        names={names}
        busy={busy}
        onSetLayers={setGroupLayers}
        renderSlot={(slot) => {
          const action = actions.find((x) => x.slot === slot);
          if (!action) return null;
          return (
            <div className="slotCell">
              <span>
                {action.behaviorId === UNSET ? (
                  <span className="muted">{t("fromFirmware")}</span>
                ) : isKeyPress(nameFor(action.behaviorId)) ? (
                  <code>{describeKeycode(action.param1)}</code>
                ) : (
                  <code>
                    {nameFor(action.behaviorId)} {action.param1} {action.param2}
                  </code>
                )}
              </span>
              <button
                className="ghost"
                disabled={busy}
                onClick={() => setEditing(editing === slot ? null : slot)}
              >
                {editing === slot ? t("cancel") : t("edit")}
              </button>
              {editing === slot && (
                <Editor
                  slot={slot}
                  label={names[slot] || `${t("slot")} ${slot}`}
                  current={action}
                  behaviors={behaviors}
                  busy={busy}
                  onApply={apply}
                />
              )}
            </div>
          );
        }}
      />

      <div className="row">
        <button className="ghost" disabled={busy} onClick={() => void refresh()}>
          {t("reload")}
        </button>
      </div>
    </section>
  );
}

/** Slots run up/down/left/right per gesture layer, so four to a row. */
function groupSlots(count: number): number[][] {
  const rows: number[][] = [];
  for (let start = 0; start < count; start += 4) {
    rows.push([start, start + 1, start + 2, start + 3]);
  }
  return rows;
}

/**
 * Row heading. The firmware's slot names carry the layer ("L8 Up"), so the
 * shared prefix is the most meaningful label available; fall back to a group
 * number when a keyboard names its slots some other way.
 */
function rowLabel(
  names: string[],
  firstSlot: number,
  index: number,
  groupWord: string,
): string {
  const name = names[firstSlot];
  const prefix = name?.trim().split(/\s+/)[0];
  return prefix || `${groupWord} ${index + 1}`;
}

function Presets({
  total,
  names,
  busy,
  keyPressId,
  preview,
  onPreview,
  onApply,
}: {
  total: number;
  names: string[];
  busy: boolean;
  keyPressId: number | null;
  preview: Preset | null;
  onPreview: (preset: Preset | null) => void;
  onApply: (preset: Preset, keyPressId: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();

  if (keyPressId === null) {
    return <p className="muted small">{t("presetNoKeyPress")}</p>;
  }

  return (
    <div className="presets">
      <div className="row presetRow">
        <span className="muted small">{t("presets")}:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={preview?.id === preset.id ? "ghost on" : "ghost"}
            disabled={busy}
            onClick={() => onPreview(preview?.id === preset.id ? null : preset)}
          >
            {preset.name[lang]}
          </button>
        ))}
      </div>
      <p className="muted small">{t("presetsHint")}</p>

      {preview && (
        <div className="editor">
          <h3>
            {preview.name[lang]} — {t("presetPreview")}
          </h3>

          {/* The preset assumes a 16-slot layout; on anything else the
              preview is where a mismatch becomes visible. */}
          {total !== preview.actions.length && (
            <p className="warn small">{t("presetMismatch")}</p>
          )}

          {/* One row per gesture layer, one column per direction: reading
              "what does up do on layer 8" off a flat list of sixteen was
              needlessly hard. */}
          <table className="previewTable">
            <thead>
              <tr>
                <th>{t("colLayer")}</th>
                <th>{t("colUp")}</th>
                <th>{t("colDown")}</th>
                <th>{t("colLeft")}</th>
                <th>{t("colRight")}</th>
              </tr>
            </thead>
            <tbody>
              {groupSlots(preview.actions.length).map((group, i) => (
                <tr key={i}>
                  <th scope="row">{rowLabel(names, group[0], i, t("groupLabel"))}</th>
                  {group.map((slot) => {
                    const item = preview.actions.find((x) => x.slot === slot);
                    return (
                      <td key={slot}>
                        {item ? (
                          <>
                            <span className="cellLabel">{item.label[lang]}</span>
                            <code className="cellKey">
                              {describeKeycode(item.keycode)}
                            </code>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="muted small">{t("presetOverwrite")}</p>

          <div className="row">
            <button disabled={busy} onClick={() => onApply(preview, keyPressId)}>
              {busy ? t("presetApplying") : t("presetApply")}
            </button>
            <button className="ghost" disabled={busy} onClick={() => onPreview(null)}>
              {t("presetCancel")}
            </button>
          </div>
        </div>
      )}
    </div>
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
