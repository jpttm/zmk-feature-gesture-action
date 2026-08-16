import {
  KEYCODE_GROUPS,
  MODIFIERS,
  describeKeycode,
  packKeycode,
  splitKeycode,
} from "./keycodes";
import { useT } from "./i18n";
import type { ParamDescription } from "./useBehaviors";

/**
 * Editor for one behaviour parameter, shaped by what the keyboard says that
 * parameter accepts.
 *
 * Every behaviour used to fall back to a raw number, which made anything but
 * Key Press unusable: there is no way to work out that `&mo`'s parameter is a
 * layer, or that Ctrl+Tab packs to 0x0100002B, from a number field. The
 * firmware already reports the answer per parameter, so ask it.
 */
export function ParamEditor({
  label,
  descriptions,
  value,
  layerCount,
  onChange,
}: {
  label: string;
  descriptions: ParamDescription[];
  value: number;
  layerCount: number;
  onChange: (value: number) => void;
}) {
  const t = useT();

  if (descriptions.length === 0) {
    return null;
  }

  const kind = classify(descriptions);

  if (kind === "nil") {
    return null;
  }

  if (kind === "hidUsage") {
    const { mods, base } = splitKeycode(value);
    return (
      <div className="paramBlock">
        <div className="mods">
          {MODIFIERS.map((m) => (
            <label key={m.label} className="check">
              <input
                type="checkbox"
                checked={(mods & m.bit) !== 0}
                onChange={(e) =>
                  onChange(
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
            onChange={(e) => onChange(packKeycode(mods, Number(e.target.value)))}
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
          {t("sends")} <code>{describeKeycode(value)}</code>
        </p>
      </div>
    );
  }

  if (kind === "layerId") {
    return (
      <label className="paramBlock">
        {t("layerWord")}
        <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {Array.from({ length: layerCount }, (_, i) => (
            <option key={i} value={i}>
              {t("layerWord")} {i}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (kind === "constants") {
    // A fixed set of named values, e.g. mouse buttons or Bluetooth commands.
    const options = descriptions.filter((d) => d.constant !== undefined);
    return (
      <label className="paramBlock">
        {label}
        <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {options.map((d) => (
            <option key={d.constant} value={d.constant}>
              {d.name || String(d.constant)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const range = descriptions.find((d) => d.range)?.range;
  return (
    <label className="paramBlock">
      {label}
      {range ? (
        <>
          <input
            type="number"
            min={range.min}
            max={range.max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="muted small">
            {range.min} – {range.max}
          </span>
        </>
      ) : (
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
    </label>
  );
}

type Kind = "nil" | "hidUsage" | "layerId" | "constants" | "range";

/** What the whole set of descriptions adds up to, most specific first. */
function classify(descriptions: ParamDescription[]): Kind {
  if (descriptions.some((d) => d.hidUsage)) return "hidUsage";
  if (descriptions.some((d) => d.layerId)) return "layerId";
  if (descriptions.some((d) => d.constant !== undefined)) return "constants";
  if (descriptions.some((d) => d.range)) return "range";
  return "nil";
}

/** Human-readable form of a binding, using the same knowledge as the editor. */
export function describeParam(
  descriptions: ParamDescription[],
  value: number,
): string {
  switch (classify(descriptions)) {
    case "nil":
      return "";
    case "hidUsage":
      return describeKeycode(value);
    case "layerId":
      return `L${value}`;
    case "constants": {
      const match = descriptions.find((d) => d.constant === value);
      return match?.name || String(value);
    }
    default:
      return String(value);
  }
}
