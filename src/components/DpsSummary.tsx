import type { DpsBreakdown } from "../engine";

export function DpsSummary({ breakdown }: { breakdown: DpsBreakdown }) {
  return (
    <div className="dps-summary">
      <div className="label">合计 DPS</div>
      <div className="value">{breakdown.combinedDps.toFixed(1)}</div>
      <div className="split">
        <div className="seg">
          <span className="seg-label">普攻</span>
          <span className="seg-value physical">
            {breakdown.autoAttackDps.total.toFixed(1)}
          </span>
        </div>
        <div className="seg">
          <span className="seg-label">技能</span>
          <span className="seg-value magic">
            {breakdown.spellDps.total.toFixed(1)}
          </span>
        </div>
        <div className="seg">
          <span className="seg-label">攻速 / 秒</span>
          <span className="seg-value">
            {breakdown.autoAttackDps.attacksPerSec.toFixed(2)}
          </span>
        </div>
        <div className="seg">
          <span className="seg-label">每秒施法</span>
          <span className="seg-value">
            {breakdown.spellDps.castsPerSec.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
