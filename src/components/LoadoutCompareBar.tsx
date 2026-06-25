/**
 * Compact A/B DPS comparison strip — shown above the timeline chart.
 * Displays steady-state DPS for both loadouts, the absolute delta, and a %
 * change so the user can read the trade-off at a glance without scanning
 * the breakdown tables.
 */
import type { DpsBreakdown } from "../engine";

interface Props {
  a: DpsBreakdown;
  b: DpsBreakdown | null;
  active: "A" | "B";
  onSwitch: (key: "A" | "B") => void;
}

export function LoadoutCompareBar({ a, b, active, onSwitch }: Props) {
  if (!b) {
    return (
      <div className="compare-bar single">
        <button
          className={"compare-cell active"}
          onClick={() => onSwitch("A")}
        >
          <div className="compare-label">方案 A</div>
          <div className="compare-dps">{a.combinedDps.toFixed(1)}</div>
          <div className="compare-sub">DPS</div>
        </button>
        <div className="compare-hint muted">
          选中方案 B 的装备以开启对比
        </div>
      </div>
    );
  }

  const delta = b.combinedDps - a.combinedDps;
  const pct = a.combinedDps > 0 ? (delta / a.combinedDps) * 100 : 0;
  const sign = delta >= 0 ? "+" : "";

  return (
    <div className="compare-bar">
      <button
        className={"compare-cell loadout-a" + (active === "A" ? " active" : "")}
        onClick={() => onSwitch("A")}
      >
        <div className="compare-label">方案 A</div>
        <div className="compare-dps">{a.combinedDps.toFixed(1)}</div>
        <div className="compare-sub">
          普攻 {a.autoAttackDps.total.toFixed(0)} · 技能{" "}
          {a.spellDps.total.toFixed(0)}
        </div>
      </button>

      <div className={"compare-delta " + (delta >= 0 ? "positive" : "negative")}>
        <div className="compare-delta-arrow">{delta >= 0 ? "▲" : "▼"}</div>
        <div className="compare-delta-value">
          {sign}
          {delta.toFixed(1)}
        </div>
        <div className="compare-delta-pct">
          {sign}
          {pct.toFixed(1)}%
        </div>
      </div>

      <button
        className={"compare-cell loadout-b" + (active === "B" ? " active" : "")}
        onClick={() => onSwitch("B")}
      >
        <div className="compare-label">方案 B</div>
        <div className="compare-dps">{b.combinedDps.toFixed(1)}</div>
        <div className="compare-sub">
          普攻 {b.autoAttackDps.total.toFixed(0)} · 技能{" "}
          {b.spellDps.total.toFixed(0)}
        </div>
      </button>
    </div>
  );
}
