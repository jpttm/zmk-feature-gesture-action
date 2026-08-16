import { useState } from "react";
import { CATEGORIES, findAction, keycodeFor, type NamedAction, type Os } from "./actions";
import {
  KEYCODE_GROUPS,
  MODIFIERS,
  describeKeycode,
  packKeycode,
  splitKeycode,
} from "./keycodes";
import { useLang, useT, type StringKey } from "./i18n";
import { parseBinding, type ParsedBinding } from "./zmkNotation";
import type { BehaviorInfo } from "./useBehaviors";

/**
 * Picking what a gesture does, by clicking.
 *
 * Assigning something used to mean choosing a ZMK behaviour and supplying its
 * parameters as numbers, which only worked if you already knew ZMK's
 * internals. Gestures almost always send a key combination, so the choice on
 * offer is a named action; the key picker and the notation field below cover
 * the rest.
 */
export function ActionChooser({
  value,
  canRestore,
  restoreLabel,
  busy,
  os,
  behaviors,
  onPick,
  onPickBinding,
  onRestore,
  onCancel,
}: {
  value: number;
  canRestore: boolean;
  restoreLabel: string;
  busy: boolean;
  os: Os;
  behaviors: BehaviorInfo[];
  onPick: (keycode: number) => void;
  onPickBinding: (binding: ParsedBinding) => void;
  onRestore: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [draft, setDraft] = useState(value);
  const [notation, setNotation] = useState("");

  const current = findAction(draft);
  const { mods, base } = splitKeycode(draft);
  const parsed = notation.trim() ? parseBinding(notation, behaviors) : null;

  return (
    <div className="chooser">
      {CATEGORIES.map((cat) => (
        <div key={cat.key} className="catBlock">
          <h4>{t(cat.key)}</h4>
          <div className="chips">
            {cat.actions.map((action) => {
              const code = keycodeFor(action, os);
              return (
                <button
                  key={action.id}
                  className={current?.id === action.id ? "chip on" : "chip"}
                  disabled={busy}
                  title={describeKeycode(code)}
                  onClick={() => setDraft(code)}
                >
                  {action.label[lang]}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="catBlock otherKeys">
        <h4>{t("pickKeyOther")}</h4>
        <div className="row">
          <div className="mods">
            {MODIFIERS.map((m) => (
              <label key={m.label} className="check">
                <input
                  type="checkbox"
                  checked={(mods & m.bit) !== 0}
                  onChange={(e) =>
                    setDraft(
                      packKeycode(e.target.checked ? mods | m.bit : mods & ~m.bit, base),
                    )
                  }
                />
                {m.label}
              </label>
            ))}
          </div>
          <select
            value={base}
            onChange={(e) => setDraft(packKeycode(mods, Number(e.target.value)))}
          >
            <option value={0}>{t("pickKey")}</option>
            {KEYCODE_GROUPS.map((group) => (
              <optgroup key={group.labelKey} label={t(group.labelKey)}>
                {group.keys.map((key) => (
                  <option key={key.value} value={key.value}>
                    {key.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <code className="muted">{draft ? describeKeycode(draft) : "—"}</code>
        </div>
      </div>

      <details className="catBlock">
        <summary>{t("zmkNotation")}</summary>
        <p className="muted small">{t("zmkHint")}</p>
        <div className="row">
          <input
            type="text"
            className="grow"
            value={notation}
            placeholder="&kp LC(TAB)"
            onChange={(e) => setNotation(e.target.value)}
          />
          <button
            disabled={busy || !parsed?.ok}
            onClick={() => parsed?.ok && onPickBinding(parsed.value)}
          >
            {t("zmkApply")}
          </button>
        </div>
        {parsed && !parsed.ok && (
          <p className="warn small">{t(errorKey(parsed.error))}</p>
        )}
        {parsed?.ok && (
          <p className="muted small">
            {t("zmkOkPrefix")}{" "}
            <code>
              {behaviors.find((b) => b.id === parsed.value.behaviorId)?.displayName}
              {" "}
              {parsed.value.param1}
              {parsed.value.param2 ? ` ${parsed.value.param2}` : ""}
            </code>
          </p>
        )}
      </details>

      <div className="row">
        <button disabled={busy || draft === 0} onClick={() => onPick(draft)}>
          {t("save")}
        </button>
        {canRestore && (
          <button className="ghost" disabled={busy} onClick={onRestore}>
            {restoreLabel}
          </button>
        )}
        <button className="ghost" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>

    </div>
  );
}

function errorKey(error: string): StringKey {
  switch (error) {
    case "empty":
      return "errEmpty";
    case "syntax":
      return "errSyntax";
    case "unknownBehavior":
      return "errUnknownBehavior";
    case "paramCount":
      return "errParamCount";
    default:
      return "errBadParam";
  }
}

/** Catalogue name where there is one, otherwise the key combination itself. */
export function describeAction(keycode: number, lang: "ja" | "en"): string {
  if (keycode === 0) {
    return "—";
  }
  const named: NamedAction | undefined = findAction(keycode);
  return named ? `${named.label[lang]} (${describeKeycode(keycode)})` : describeKeycode(keycode);
}
