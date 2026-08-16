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
  totalSlots,
  actions,
  names,
  busy,
  renderSlot,
  onSetLayers,
}: {
  groups: Group[];
  totalSlots: number;
  actions: Action[];
  names: string[];
  busy: boolean;
  renderSlot: (slot: number) => React.ReactNode;
  onSetLayers: (index: number, mask: number) => void;
}) {
  const t = useT();
  const [tab, setTab] = useState(0);

  // Firmware without the layer-groups RPC still has slots to edit; it just
  // cannot say which layers they fire on. Group them four to a tab anyway so
  // the slots stay reachable, and drop only the layer checkboxes.
  const layersSupported = groups.length > 0;
  const shown: Group[] = layersSupported
    ? groups
    : Array.from({ length: Math.ceil(totalSlots / 4) }, (_, i) => ({
        index: i,
        name: "",
        activeLayers: 0,
      }));

  if (shown.length === 0) {
    return null;
  }

  const group = shown[Math.min(tab, shown.length - 1)];
  // Groups own four consecutive slots each, in group order.
  const firstSlot = group.index * 4;

  return (
    <div className="groups">
      <div className="tabs" role="tablist">
        {shown.map((g, i) => (
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
        {layersSupported ? (
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
        ) : (
          <p className="muted small">{t("groupsUnsupported")}</p>
        )}

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
