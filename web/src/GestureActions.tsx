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

export function GestureActions() {
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
        if (!res) throw new Error("No response");
        if (res.kind === "error") throw new Error(res.message);
        if (res.kind !== "getActions") throw new Error("Unexpected response");

        totalSlots = res.totalSlots;
        collected.push(...res.actions);

        if (res.actions.length === 0 || collected.length >= totalSlots) break;
        startSlot = collected.length;
      }

      setTotal(totalSlots);
      setActions(collected);

      // Names are fixed at build time, so this only needs doing once per
      // connection - but it is cheap enough to redo alongside a reload.
      const collectedNames: string[] = [];
      startSlot = 0;
      for (;;) {
        const res = await call({ kind: "getSlotNames", startSlot });
        if (!res || res.kind !== "getSlotNames") break;
        collectedNames.push(...res.names);
        if (res.names.length === 0 || collectedNames.length >= res.totalSlots) break;
        startSlot = collectedNames.length;
      }
      setNames(collectedNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [call]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const apply = useCallback(
    async (request: Request) => {
      setBusy(true);
      setError(null);
      try {
        const res = await call(request);
        if (!res) throw new Error("No response");
        if (res.kind === "error") throw new Error(res.message);
        setEditing(null);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    },
    [call, refresh],
  );

  if (!ready) {
    return (
      <section>
        <h2>Gesture actions</h2>
        <p className="muted">
          This keyboard does not expose <code>{SUBSYSTEM_ID}</code>. Flash
          firmware built with the gesture-action module to configure it here.
        </p>
      </section>
    );
  }

  const nameFor = (id: number) =>
    behaviors.find((b) => b.id === id)?.displayName ?? `#${id}`;

  return (
    <section>
      <h2>Gesture actions ({total})</h2>

      {behaviorsLoading && (
        <p className="muted">Loading the behaviour list from the keyboard…</p>
      )}
      {error && <p className="warn">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Assignment</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => (
            <tr key={action.slot}>
              <td className="num">{names[action.slot] || action.slot}</td>
              <td>
                {action.behaviorId === UNSET ? (
                  <span className="muted">default (from firmware)</span>
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
                  {editing === action.slot ? "Cancel" : "Edit"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing !== null && (
        <Editor
          slot={editing}
          label={names[editing] || `Slot ${editing}`}
          current={actions.find((a) => a.slot === editing)}
          behaviors={behaviors}
          busy={busy}
          onApply={apply}
        />
      )}

      <div className="row">
        <button className="ghost" disabled={busy} onClick={() => void refresh()}>
          Reload
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
        Behaviour
        <select
          value={behaviorId}
          onChange={(e) => setBehaviorId(Number(e.target.value))}
        >
          <option value={0}>— use the firmware default —</option>
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
            Key
            <select
              value={base}
              onChange={(e) => setParam1(packKeycode(mods, Number(e.target.value)))}
            >
              <option value={0}>— pick a key —</option>
              {KEYCODE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
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
            Sends <code>{describeKeycode(param1)}</code>. Anything missing from
            the list can be entered as a raw value below.
          </p>
        </>
      ) : null}

      <details>
        <summary className="muted small">Raw parameters</summary>
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
          Save
        </button>
        <button
          className="ghost"
          disabled={busy}
          onClick={() => onApply({ kind: "setAction", action, persist: false })}
          title="Apply without writing to flash — lost on reboot"
        >
          Try without saving
        </button>
        <button
          className="ghost"
          disabled={busy}
          onClick={() => onApply({ kind: "resetAction", slot, persist: true })}
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}
