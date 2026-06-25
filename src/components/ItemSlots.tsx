/**
 * Three item slots with a modal item picker.
 *
 * The item picker filters to "completed standard items" — `TFT_Item_*` with
 * `composition.length === 2` is the canonical signal (two component items).
 * Set-specific artifacts (`TFT17_Item_Artifact_*`) are shown in a separate
 * tab in a future iteration; for MVP we only show completed items.
 */
import { useMemo, useState } from "react";
import type { Item, SetData } from "../data";
import type { ItemSlots as ItemSlotsType, LoadoutKey } from "../state";

interface Props {
  setData: SetData;
  slots: ItemSlotsType;
  onChange: (slot: 0 | 1 | 2, item: Item | null) => void;
  /** A/B selector — when present, renders the loadout toggle header. */
  loadout?: {
    active: LoadoutKey;
    onSwitch: (key: LoadoutKey) => void;
    onClear: (key: LoadoutKey) => void;
    onCopy: (from: LoadoutKey, to: LoadoutKey) => void;
    /** Count of filled slots per loadout, for the badge. */
    counts: Record<LoadoutKey, number>;
  };
}

function statSummary(item: Item): string {
  const parts: string[] = [];
  const f = item.statModifiers.flat;
  const p = item.statModifiers.percentAdditive;
  if (p.attackDamage) parts.push(`+${Math.round(p.attackDamage * 100)}% AD`);
  if (f.power) parts.push(`+${f.power} AP`);
  if (p.attackSpeed) parts.push(`+${Math.round(p.attackSpeed * 100)}% AS`);
  if (f.critChance) parts.push(`+${Math.round(f.critChance * 100)}% 暴击`);
  if (f.armor) parts.push(`+${f.armor} 护甲`);
  if (f.magicResist) parts.push(`+${f.magicResist} 魔抗`);
  if (f.health) parts.push(`+${f.health} HP`);
  if (f.mana) parts.push(`+${f.mana} 起始蓝`);
  return parts.join(" · ");
}

/** Filter to playable completed items + Set 17 artifacts. */
function isCompletedItem(item: Item): boolean {
  // Heuristic: has at least one mapped stat modifier.
  const f = item.statModifiers.flat;
  const p = item.statModifiers.percentAdditive;
  const hasStat =
    Object.keys(f).length > 0 || Object.keys(p).length > 0;
  if (!hasStat) return false;
  // Completed standard items only (excludes raw components).
  const knownCompleted = item.apiName.startsWith("TFT_Item_") &&
    !item.apiName.startsWith("TFT_Item_Free") &&
    !item.apiName.endsWith("Component") &&
    // skip the 6 base components by name
    item.apiName !== "TFT_Item_BFSword" &&
    item.apiName !== "TFT_Item_RecurveBow" &&
    item.apiName !== "TFT_Item_NeedlesslyLargeRod" &&
    item.apiName !== "TFT_Item_TearOfTheGoddess" &&
    item.apiName !== "TFT_Item_ChainVest" &&
    item.apiName !== "TFT_Item_NegatronCloak" &&
    item.apiName !== "TFT_Item_GiantsBelt" &&
    item.apiName !== "TFT_Item_SparringGloves" &&
    item.apiName !== "TFT_Item_Spatula" &&
    item.apiName !== "TFT_Item_FryingPan";
  return knownCompleted;
}

export function ItemSlots({ setData, slots, onChange, loadout }: Props) {
  const [pickingSlot, setPickingSlot] = useState<0 | 1 | 2 | null>(null);

  const completedItems = useMemo(
    () =>
      setData.items
        .filter(isCompletedItem)
        .sort((a, b) => a.name.localeCompare(b.name, "zh")),
    [setData],
  );

  return (
    <>
      {loadout && (
        <div className="loadout-tabs">
          {(["A", "B"] as const).map((key) => (
            <button
              key={key}
              className={
                "loadout-tab loadout-tab-" + key.toLowerCase() +
                (loadout.active === key ? " active" : "")
              }
              onClick={() => loadout.onSwitch(key)}
              title={`方案 ${key} · ${loadout.counts[key]}/3 件`}
            >
              <span className="loadout-tab-label">方案 {key}</span>
              <span className="loadout-tab-count">{loadout.counts[key]}/3</span>
            </button>
          ))}
          <div className="loadout-actions">
            <button
              className="ghost mini"
              onClick={() =>
                loadout.onCopy(loadout.active, loadout.active === "A" ? "B" : "A")
              }
              title={`把方案 ${loadout.active} 复制到 ${loadout.active === "A" ? "B" : "A"}`}
              disabled={loadout.counts[loadout.active] === 0}
            >
              复制到 {loadout.active === "A" ? "B" : "A"}
            </button>
            <button
              className="ghost mini"
              onClick={() => loadout.onClear(loadout.active)}
              title={`清空方案 ${loadout.active}`}
              disabled={loadout.counts[loadout.active] === 0}
            >
              清空
            </button>
          </div>
        </div>
      )}

      <div className="item-slots">
        {slots.map((it, idx) => (
          <div
            key={idx}
            className={"item-slot" + (it ? " filled" : "")}
            onClick={() => setPickingSlot(idx as 0 | 1 | 2)}
            onContextMenu={(e) => {
              e.preventDefault();
              onChange(idx as 0 | 1 | 2, null);
            }}
            title={it ? "点击替换" : "点击选择装备"}
          >
            {it && (
              <button
                className="item-slot-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(idx as 0 | 1 | 2, null);
                }}
                title="移除"
                aria-label="移除装备"
              >
                ×
              </button>
            )}
            {it ? (
              <>
                <div className="item-name">{it.name}</div>
                <div className="item-stats">{statSummary(it)}</div>
              </>
            ) : (
              <span>+ 装备</span>
            )}
          </div>
        ))}
      </div>

      {pickingSlot !== null && (
        <div
          className="item-picker-modal"
          onClick={() => setPickingSlot(null)}
        >
          <div
            className="item-picker-card"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <span style={{ fontWeight: 600 }}>选择装备</span>
              <button className="ghost" onClick={() => setPickingSlot(null)}>
                取消
              </button>
            </header>
            <div className="item-picker-grid">
              {completedItems.map((it) => (
                <div
                  key={it.apiName}
                  className="item-card"
                  onClick={() => {
                    onChange(pickingSlot, it);
                    setPickingSlot(null);
                  }}
                >
                  <div className="item-card-name">{it.name}</div>
                  <div className="item-card-effects">
                    {statSummary(it) || (
                      <span className="muted">无属性加成</span>
                    )}
                    {it.passive && (
                      <div className="muted" style={{ marginTop: 4 }}>
                        被动：{it.passive}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
