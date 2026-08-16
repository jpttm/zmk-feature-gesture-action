import { useState } from "react";
import type { Action, Group, Request } from "./gestureActionCodec";
import { UNSET } from "./gestureActionCodec";
import { useT } from "./i18n";

/**
 * Layers worth offering.
 *
 * 0-2 are the base and its immediate companions on most keyboards, and taking
 * the pointer over on those is rarely wanted.
 *
 * 3 is left out because CLine46 attaches scrolling to it with an input-listener
 * layer override. Overrides are evaluated before the base chain and stop there,
 * so scrolling wins and a gesture group assigned to layer 3 would never fire -
 * a checkbox that does nothing and says nothing. (Moving scrolling into the
 * base chain, the way the gesture groups already are, would free layer 3 up.)
 */
const SELECTABLE_LAYERS = [4, 5, 6, 7, 8, 9, 10];

const DIRECTIONS = ["colUp", "colDown", "colLeft", "colRight"] as const;

export function GroupTabs({
  groups,
  totalSlots,
  actions,
  busy,
  renderSlot,
  onSetLayers,
}: {
  groups: Group[];
  totalSlots: number;
  actions: Action[];
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
            {`${t("groupTab")} ${g.index + 1}`}
          </button>
        ))}
      </div>

      <div className="tabPanel">
        {layersSupported ? (
          <fieldset>
            {/* The three rules behind these checkboxes are the same on every
                tab, so they live once at the foot of the section rather than
                repeating under each group. */}
            <legend>
              {t("appliesTo")}
              <span className="footMark">*</span>
            </legend>
            <div className="mods">
              {SELECTABLE_LAYERS.map((layer) => {
                const mine = (group.activeLayers & (1 << layer)) !== 0;
                // One layer, one group: two groups on the same layer would
                // both fire, and which action wins is not something a user
                // should have to reason about. Whoever holds it releases it.
                const takenByOther =
                  !mine &&
                  groups.some(
                    (g) => g.index !== group.index && (g.activeLayers & (1 << layer)) !== 0,
                  );
                return (
                <label key={layer} className={takenByOther ? "check taken" : "check"}>
                  <input
                    type="checkbox"
                    disabled={busy || takenByOther}
                    checked={mine}
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
                );
              })}
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
