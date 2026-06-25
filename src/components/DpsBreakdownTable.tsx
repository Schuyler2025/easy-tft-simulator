import type { DpsBreakdown } from "../engine";

export function DpsBreakdownTable({ breakdown }: { breakdown: DpsBreakdown }) {
  const { autoAttackDps, spellDps, combinedDps } = breakdown;
  return (
    <table className="stat-table">
      <thead>
        <tr>
          <th>来源</th>
          <th className="num">值</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>普攻 · 物理</td>
          <td className="num">{autoAttackDps.physical.toFixed(1)}</td>
          <td className="muted">AD × 期望暴击 × 减免 × 攻速</td>
        </tr>
        <tr>
          <td>普攻 · 触发</td>
          <td className="num">{autoAttackDps.onHit.toFixed(1)}</td>
          <td className="muted">on-hit 装备伤害</td>
        </tr>
        <tr>
          <td>普攻 · 小计</td>
          <td className="num accent">{autoAttackDps.total.toFixed(1)}</td>
          <td></td>
        </tr>
        <tr>
          <td>技能 · 单次</td>
          <td className="num">{spellDps.perCast.toFixed(1)}</td>
          <td className="muted">含减免</td>
        </tr>
        <tr>
          <td>技能 · 每秒施放</td>
          <td className="num">{spellDps.castsPerSec.toFixed(3)}</td>
          <td className="muted">蓝量 / 施法消耗</td>
        </tr>
        <tr>
          <td>技能 · 小计</td>
          <td className="num accent">{spellDps.total.toFixed(1)}</td>
          <td></td>
        </tr>
        <tr>
          <td style={{ fontWeight: 600 }}>合计</td>
          <td className="num accent" style={{ fontSize: 16 }}>
            {combinedDps.toFixed(1)}
          </td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}
