import type { DpsBreakdown } from "../engine";

const ROWS: { key: keyof DpsBreakdown["effectiveStats"]; label: string; format?: (v: number) => string }[] = [
  { key: "attackDamage", label: "AD", format: (v) => v.toFixed(1) },
  { key: "attackSpeed", label: "攻速", format: (v) => v.toFixed(3) },
  { key: "critChance", label: "暴击率", format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: "critMultiplier", label: "暴击倍率", format: (v) => `${v.toFixed(2)}×` },
  { key: "power", label: "AP", format: (v) => v.toFixed(0) },
  { key: "armor", label: "护甲", format: (v) => v.toFixed(0) },
  { key: "magicResist", label: "魔抗", format: (v) => v.toFixed(0) },
  { key: "health", label: "HP", format: (v) => v.toFixed(0) },
  { key: "mana", label: "起始蓝", format: (v) => v.toFixed(0) },
  { key: "maxMana", label: "施法消耗", format: (v) => v.toFixed(0) },
  { key: "range", label: "攻击距离", format: (v) => v.toFixed(0) },
];

export function StatTable({ breakdown }: { breakdown: DpsBreakdown }) {
  const s = breakdown.effectiveStats;
  return (
    <table className="stat-table">
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.key}>
            <td>{row.label}</td>
            <td className="num">{row.format ? row.format(s[row.key]) : s[row.key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
