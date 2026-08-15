import { useState } from "react";
import type { Action, Group, Request } from "./gestureActionCodec";
import { UNSET } from "./gestureActionCodec";
import { useT } from "./i18n";

/** Layers worth offering. 0-2 are the base and its immediate companions on
 *  most keyboards, and taking the pointer over on those is rarely wanted. */
const SELECTABLE_LAYERS = [3, 4, 5, 6, 7, 8, 9, 10];

const DIRECTIONS = ["colUp", "colDown", "colLeft", "colRight"] as const;

export function GroupTabs({
  groups,
  actions,
  names,
  busy,
  renderSlot,
  onSetLayers,
}: {
  groups: Group[];
  actions: Action[];
  names: string[];
  busy: boolean;
  renderSlot: (slot: number) => React.ReactNode;
  onSetLayers: (index: number, mask: number) => void;
}) {
  const t = useT();
  const [tab, setTab] = useState(0);

  if (groups.length === 0) {
    return <p className="muted small">{t("groupsUnsupported")}</p>;
  }

  const group = groups[Math.min(tab, groups.length - 1)];
  // Groups own four consecutive slots each, in group order.
  const firstSlot = group.index * 4;

  return (
    <div className="groups">
      <div className="tabs" role="tablist">
        {groups.map((g, i) => (
          <button
            key={g.index}
            role="tab"
            aria-selected={i === tab}
            className={i === tab ? "tab on" : "tab"}
            onClick={() => setTab(i)}
          >
            {g.name || `${t("groupTab")} ${g.index + 1}`}
          </button>
        ))}
      </div>

      <div className="tabPanel">
        <fieldset>
          <legend>{t("appliesTo")}</legend>
          <p className="muted small">{t("appliesToHint")}</p>
          <div className="mods">
            {SELECTABLE_LAYERS.map((layer) => (
              <label key={layer} className="check">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={(group.activeLayers & (1 << layer)) !== 0}
                  onChange={(e) =>
                    onSetLayers(
                      group.index,
                      e.target.checked
                        ? group.activeLayers | (1 << layer)
                        : group.activeLayers & ~(1 << layer),
                    )
                  }
                />
                {layer}
              </label>
            ))}
          </div>
          {describeLayers(group.activeLayers).length === 0 && (
            <p className="muted small">{t("unassigned")}</p>
          )}
        </fieldset>

        <table>
          <tbody>
            {DIRECTIONS.map((dirKey, i) => {
              const slot = firstSlot + i;
              const action = actions.find((x) => x.slot === slot);
              return (
                <tr key={slot}>
                  <th scope="row" className="slotCol">
                    {t(dirKey)}
                  </th>
                  <td className="muted small">{names[slot] || slot}</td>
                  <td>
                    {action && action.behaviorId !== UNSET ? null : null}
                    {renderSlot(slot)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Layer numbers a mask covers, ignoring the "unassigned" parking bit. */
export function describeLayers(mask: number): number[] {
  const layers: number[] = [];
  for (const layer of SELECTABLE_LAYERS) {
    if (mask & (1 << layer)) {
      layers.push(layer);
    }
  }
  return layers;
}

export type { Request };
