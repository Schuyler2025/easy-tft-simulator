/**
 * Shows the champion's ability variables (per-star values), the curated cast
 * spec components, and a warning when no castSpec is curated (engine fell
 * back to "largest variable as magic damage").
 */
import type { Champion, StarLevel } from "../data";
import type { DpsBreakdown } from "../engine";

interface Props {
  champion: Champion;
  starLevel: StarLevel;
  breakdown: DpsBreakdown;
}

function starValueOf(values: { star1: number; star2: number; star3: number }, star: StarLevel): number {
  return star === 1 ? values.star1 : star === 2 ? values.star2 : values.star3;
}

export function AbilityDetail({ champion, starLevel, breakdown }: Props) {
  const ab = champion.ability;
  const spec = ab.castSpec;

  return (
    <div className="ability-detail">
      <h4>{champion.name} · 施法消耗 {ab.castCostMana}</h4>

      {breakdown.spellDps.abilityUncurated === 1 && (
        <div className="warn">
          ⚠ 该英雄无手工整理的技能规格 (castSpec)，使用回退估算（最大 variable 作魔法伤害，无 AD/AP 缩放）。
        </div>
      )}

      {spec ? (
        <table className="stat-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>变量</th>
              <th>类型</th>
              <th className="num">AD 系数</th>
              <th className="num">AP 系数</th>
              <th className="num">段数</th>
            </tr>
          </thead>
          <tbody>
            {spec.components.map((c, i) => (
              <tr key={i}>
                <td>{c.variable}</td>
                <td>
                  {c.damageType === "physical" && "物理"}
                  {c.damageType === "magic" && "魔法"}
                  {c.damageType === "true" && "真伤"}
                </td>
                <td className="num">{c.adRatio?.toFixed(2) ?? "-"}</td>
                <td className="num">{c.apRatio?.toFixed(2) ?? "-"}</td>
                <td className="num">{c.hitCount ?? 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <div className="panel-title" style={{ marginTop: 12 }}>
        技能变量 (Set 17 数据原值)
      </div>
      <div className="ability-vars">
        {ab.variables.map((v) => (
          <div className="var-row" key={v.name}>
            <span className="var-name">{v.name}</span>
            <span className="var-vals">
              {starValueOf(v.values, starLevel).toFixed(2)}
              <span className="muted" style={{ marginLeft: 4 }}>
                ({v.values.star1.toFixed(0)}/{v.values.star2.toFixed(0)}/
                {v.values.star3.toFixed(0)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
