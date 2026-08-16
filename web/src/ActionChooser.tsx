import { useState } from "react";
import {
  CATEGORIES,
  findAction,
  keycodeFor,
  type NamedAction,
  type Os,
} from "./actions";
import {
  KEYCODE_GROUPS,
  MODIFIERS,
  describeKeycode,
  packKeycode,
  splitKeycode,
} from "./keycodes";
import { useLang, useT } from "./i18n";

/**
 * Picking what a gesture does, by clicking.
 *
 * Assigning something used to mean choosing a ZMK behaviour and then supplying
 * its parameters as numbers, which only worked if you already knew ZMK's
 * internals. Gestures almost always send a key combination, so the choice on
 * offer here is a named action; the key picker below covers the rest, and
 * nothing needs typing.
 */
export function ActionChooser({
  value,
  isDefault,
  busy,
  os,
  onOsChange,
  onPick,
  onReset,
  onCancel,
}: {
  value: number;
  isDefault: boolean;
  busy: boolean;
  os: Os;
  onOsChange: (os: Os) => void;
  onPick: (keycode: number, persist: boolean) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [draft, setDraft] = useState(value);

  const current = findAction(draft);
  const { mods, base } = splitKeycode(draft);

  return (
    <div className="chooser">
      <div className="chooserHead">
        <span className="muted small">{t("currentlySends")}</span>
        <code>{describeAction(draft, lang)}</code>
        <div className="langToggle">
          <button
            className={os === "win" ? "lang on" : "lang"}
            onClick={() => onOsChange("win")}
          >
            Windows
          </button>
          <button
            className={os === "mac" ? "lang on" : "lang"}
            onClick={() => onOsChange("mac")}
          >
            macOS
          </button>
        </div>
      </div>

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

      <details>
        <summary className="muted small">{t("pickKeyDirectly")}</summary>
        <div className="paramBlock">
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
          <label>
            {t("keyLabel")}
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
          </label>
        </div>
      </details>

      <div className="row">
        <button disabled={busy || draft === 0} onClick={() => onPick(draft, true)}>
          {t("save")}
        </button>
        <button
          className="ghost"
          disabled={busy || draft === 0}
          onClick={() => onPick(draft, false)}
          title={t("tryTitle")}
        >
          {t("tryWithoutSaving")}
        </button>
        {!isDefault && (
          <button className="ghost" disabled={busy} onClick={onReset}>
            {t("resetToDefault")}
          </button>
        )}
        <button className="ghost" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

/** Catalogue name where there is one, otherwise the key combination itself. */
export function describeAction(keycode: number, lang: "ja" | "en"): string {
  if (keycode === 0) {
    return "—";
  }
  const named: NamedAction | undefined = findAction(keycode);
  return named ? `${named.label[lang]} (${describeKeycode(keycode)})` : describeKeycode(keycode);
}
