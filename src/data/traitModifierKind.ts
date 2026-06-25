/**
 * Registry mapping a stat to the modifier operation a trait breakpoint uses
 * when granting that stat. TFT applies stat bonuses in different phases:
 * power/AD/armor/MR/health are additive; attackSpeed is percent-additive;
 * critChance is additive. Centralizing this keeps the modifier pipeline generic.
 */
import type { StatKey } from "./types";

export type ModifierOp = "add" | "percent-add" | "percent-mul" | "override";

export const TRAIT_STAT_OP: Partial<Record<StatKey, ModifierOp>> = {
  power: "add",
  attackDamage: "add",
  armor: "add",
  magicResist: "add",
  health: "add",
  attackSpeed: "percent-add",
  critChance: "add",
  critMultiplier: "add",
};

/** Default op when a stat is granted but not in the registry. */
export const DEFAULT_STAT_OP: ModifierOp = "add";

export function traitStatOp(stat: StatKey): ModifierOp {
  return TRAIT_STAT_OP[stat] ?? DEFAULT_STAT_OP;
}
