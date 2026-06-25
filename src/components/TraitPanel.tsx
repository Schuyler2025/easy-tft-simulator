/**
 * Trait breakpoint panel.
 *
 * For each trait the selected champion belongs to, show its breakpoint options
 * (e.g. 2/4/6 Anima Squad). The user clicks one to activate it for the
 * calculation; clicking the active one again deactivates it.
 */
import type {
  ActiveBreakpoint,
  Champion,
  SetData,
  TraitBreakpoint,
} from "../data";

interface Props {
  setData: SetData;
  champion: Champion;
  active: ActiveBreakpoint[];
  onToggle: (traitApiName: string, minUnits: number) => void;
}

/** Pretty-print a breakpoint's stat variables for tooltip / debug. */
function bpSummary(bp: TraitBreakpoint): string {
  const parts: string[] = [];
  if (bp.variables.attackSpeed)
    parts.push(`+${Math.round(bp.variables.attackSpeed * 100)}% AS`);
  if (bp.variables.attackDamage)
    parts.push(`+${Math.round(bp.variables.attackDamage * 100)}% AD`);
  if (bp.variables.power) parts.push(`+${bp.variables.power} AP`);
  if (bp.variables.armor) parts.push(`+${bp.variables.armor} 护甲`);
  if (bp.variables.magicResist)
    parts.push(`+${bp.variables.magicResist} 魔抗`);
  if (bp.variables.health) parts.push(`+${bp.variables.health} HP`);
  return parts.join(" · ");
}

export function TraitPanel({ setData, champion, active, onToggle }: Props) {
  // Resolve the champion's traits (apiNames) into full Trait objects.
  const traits = champion.traits
    .map((apiName) => setData.traits.find((t) => t.apiName === apiName))
    .filter((t): t is NonNullable<typeof t> => !!t);

  if (traits.length === 0) {
    return <div className="placeholder">该英雄无可激活的羁绊</div>;
  }

  return (
    <div>
      {traits.map((t) => {
        const activeBp = active.find((b) => b.traitApiName === t.apiName);
        const breakpoints = t.breakpoints.filter((b) => b.minUnits > 0);
        return (
          <div className="trait-row" key={t.apiName}>
            <span className="trait-name">{t.name}</span>
            <div className="trait-breakpoints">
              {breakpoints.length === 0 && (
                <span className="muted" style={{ fontSize: 11 }}>
                  (无属性断点)
                </span>
              )}
              {breakpoints.map((bp) => {
                const isActive = activeBp?.minUnits === bp.minUnits;
                return (
                  <button
                    key={bp.minUnits}
                    className={"trait-bp" + (isActive ? " active" : "")}
                    onClick={() => onToggle(t.apiName, bp.minUnits)}
                    title={bpSummary(bp) || "(纯被动羁绊)"}
                  >
                    {bp.minUnits}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
