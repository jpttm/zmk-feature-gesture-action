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
import { useBehaviors, type BehaviorInfo } from "./useBehaviors";
import { describeKeycode } from "./keycodes";
import { useLang, useT } from "./i18n";
import { PRESETS, type Preset } from "./presets";
import { GroupTabs, describeLayers } from "./GroupTabs";
import type { Group } from "./gestureActionCodec";
import { describeParam } from "./ParamEditor";
import { ActionChooser, describeAction } from "./ActionChooser";
import type { ParsedBinding } from "./zmkNotation";
import type { Os } from "./actions";

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
  const { lang } = useLang();
  const keyPressId =
    behaviors.find((b) => isKeyPress(b.displayName))?.id ?? null;

  const [actions, setActions] = useState<Action[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [namesError, setNamesError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preset | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [defaults, setDefaults] = useState<Action[]>([]);
  const [os, setOs] = useState<Os>(
    () => (localStorage.getItem("zmk-gesture-action.os") as Os) || "win",
  );
  const [appliedPreset, setAppliedPreset] = useState<string | null>(() =>
    localStorage.getItem("zmk-gesture-action.preset"),
  );

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

      // Defaults are static; fetching them is what lets an untouched slot show
      // the action it will actually perform instead of the word "default".
      const collectedDefaults: Action[] = [];
      startSlot = 0;
      for (;;) {
        const res = await call({ kind: "getDefaults", startSlot });
        if (!res || res.kind !== "getDefaults") break;
        collectedDefaults.push(...res.actions);
        if (res.actions.length === 0 || collectedDefaults.length >= res.totalSlots) break;
        startSlot = collectedDefaults.length;
      }
      setDefaults(collectedDefaults);
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
        localStorage.setItem("zmk-gesture-action.preset", preset.id);
        setAppliedPreset(preset.id);
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


  // "Restore" should hand back what the user picked at setup, not whatever
  // the firmware happens to ship - so if a preset was applied, that is the
  // value to return to. Which preset is browser-local; without it, the
  // firmware default is the honest fallback.
  const presetValueFor = (slot: number): number | null => {
    const preset = PRESETS.find((p) => p.id === appliedPreset);
    return preset?.actions.find((x) => x.slot === slot)?.keycode ?? null;
  };

  return (
    <section>
      {behaviorsLoading && <p className="muted">{t("loadingBehaviors")}</p>}
      {error && <p className="warn">{error}</p>}
      {namesError && (
        <p className="muted small">
          {t("namesFallback")}（{namesError}）
        </p>
      )}

      <div className="sectionHead">
        <h2 className="sectionH2">{t("presetsHeading")}</h2>
        <p className="muted small hintRight">{t("presetsHint")}</p>
      </div>

      <Presets
        total={total}
        names={names}
        groups={groups}
        busy={busy}
        keyPressId={behaviors.find((b) => isKeyPress(b.displayName))?.id ?? null}
        preview={preview}
        onPreview={setPreview}
        onApply={applyPreset}
      />

      <div className="sectionHead">
        <h2 className="sectionH2">{t("customHeading")}</h2>
        <div className="langToggle">
          <button
            className={os === "win" ? "lang on" : "lang"}
            onClick={() => {
              setOs("win");
              localStorage.setItem("zmk-gesture-action.os", "win");
            }}
          >
            Windows
          </button>
          <button
            className={os === "mac" ? "lang on" : "lang"}
            onClick={() => {
              setOs("mac");
              localStorage.setItem("zmk-gesture-action.os", "mac");
            }}
          >
            macOS
          </button>
        </div>
      </div>

      <GroupTabs
        groups={groups}
        totalSlots={total}
        actions={actions}
        busy={busy}
        onSetLayers={setGroupLayers}
        renderSlot={(slot) => {
          const action = actions.find((x) => x.slot === slot);
          if (!action) return null;

          // What the gesture actually does: the stored assignment if there is
          // one, otherwise the firmware's own default for that slot.
          const isDefault = action.behaviorId === UNSET;
          const shown = isDefault ? defaults.find((d) => d.slot === slot) : action;
          const behavior = shown
            ? behaviors.find((b) => b.id === shown.behaviorId)
            : undefined;
          const sendsKey = behavior?.param1.some((d) => d.hidUsage) ?? false;

          return (
            <div className="slotCell">
              <span>
                {!shown || shown.behaviorId === UNSET ? (
                  <span className="muted">{t("nothing")}</span>
                ) : sendsKey ? (
                  describeAction(shown.param1, lang)
                ) : (
                  <code>{summarise(behavior, shown)}</code>
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
                <div className="editor">
                  {!sendsKey && shown && shown.behaviorId !== UNSET && (
                    <p className="muted small">{t("notAKeyPress")}</p>
                  )}
                  <ActionChooser
                    value={sendsKey && shown ? shown.param1 : 0}
                    canRestore={!isDefault || presetValueFor(slot) !== null}
                    restoreLabel={
                      presetValueFor(slot) !== null
                        ? t("restoreToPreset")
                        : t("restoreToDefault")
                    }
                    busy={busy}
                    os={os}
                    behaviors={behaviors}
                    onPick={(keycode) => {
                      if (keyPressId === null) return;
                      apply({
                        kind: "setAction",
                        action: { slot, behaviorId: keyPressId, param1: keycode, param2: 0 },
                        persist: true,
                      });
                    }}
                    onPickBinding={(binding: ParsedBinding) =>
                      apply({
                        kind: "setAction",
                        action: { slot, ...binding },
                        persist: true,
                      })
                    }
                    onRestore={() => {
                      const preset = presetValueFor(slot);
                      if (preset !== null && keyPressId !== null) {
                        apply({
                          kind: "setAction",
                          action: { slot, behaviorId: keyPressId, param1: preset, param2: 0 },
                          persist: true,
                        });
                      } else {
                        apply({ kind: "resetAction", slot, persist: true });
                      }
                    }}
                    onCancel={() => setEditing(null)}
                  />
                </div>
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

      {/* Rules that apply to every group's layer picker. Kept here, once, so
          they are available without shouting from inside each tab. */}
      <div className="footnote">
        <p className="muted small">
          <span className="footMark">*</span> {t("appliesTo")}
        </p>
        <ul className="muted small">
          <li>{t("appliesToHint")}</li>
          <li>{t("layerTakenHint")}</li>
          <li>{t("layerScrollNote")}</li>
        </ul>
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

const DIRECTION_KEYS = ["colUp", "colDown", "colLeft", "colRight"] as const;

/**
 * Column heading: the layers this group currently fires on, since that is what
 * a reader wants to match against ("which column is layer 8?").
 *
 * The group-to-layer mapping is a runtime setting, so it is read from the
 * device rather than assumed from the group number. Without that information -
 * older firmware - fall back to the slot name's prefix, then to a group number.
 */
function columnLabel(
  groups: Group[],
  index: number,
  names: string[],
  firstSlot: number,
  t: (key: "layerWord" | "groupLabel" | "unassigned") => string,
): string {
  const layers = groups[index] ? describeLayers(groups[index].activeLayers) : [];
  if (layers.length > 0) {
    return `${t("layerWord")} ${layers.join(", ")}`;
  }
  if (groups[index]) {
    return `${t("groupLabel")} ${index + 1}（${t("unassigned")}）`;
  }

  const prefix = names[firstSlot]?.trim().split(/\s+/)[0];
  return prefix || `${t("groupLabel")} ${index + 1}`;
}

function Presets({
  total,
  names,
  groups,
  busy,
  keyPressId,
  preview,
  onPreview,
  onApply,
}: {
  total: number;
  names: string[];
  groups: Group[];
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

          {/* Directions run down the rows and layers across the columns, the
              same way round as the per-group editor. The two used to be
              transposed relative to each other, which made comparing what a
              preset would do against what is set an exercise in re-orienting. */}
          <table className="previewTable">
            <thead>
              <tr>
                <th />
                {groupSlots(preview.actions.length).map((group, i) => (
                  <th key={i}>{columnLabel(groups, i, names, group[0], t)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIRECTION_KEYS.map((dirKey, dir) => (
                <tr key={dirKey}>
                  <th scope="row">{t(dirKey)}</th>
                  {groupSlots(preview.actions.length).map((group, i) => {
                    const item = preview.actions.find((x) => x.slot === group[dir]);
                    return (
                      <td key={i}>
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

/** Presets assign key presses, so they need that behaviour's id. */
function isKeyPress(displayName: string): boolean {
  return displayName.toLowerCase().replace(/[\s_-]/g, "") === "keypress";
}

/** One-line summary of a binding, using the keyboard's own parameter metadata. */
function summarise(behavior: BehaviorInfo | undefined, action: Action): string {
  if (!behavior) {
    return `#${action.behaviorId} ${action.param1} ${action.param2}`;
  }

  const parts = [
    describeParam(behavior.param1, action.param1),
    describeParam(behavior.param2, action.param2),
  ].filter(Boolean);

  // Key Press reads better as just "Ctrl+Tab" than "Key Press Ctrl+Tab".
  if (parts.length === 1 && behavior.param1.some((d) => d.hidUsage)) {
    return parts[0];
  }

  return [behavior.displayName, ...parts].join(" ");
}
