/** DPS entry point: combines auto-attack + spell DPS against a target. Pure. */
import type {
  Champion,
  Item,
  StarLevel,
  TargetDummy,
  TraitBreakpoint,
} from "../data/types";
import type { Tuning } from "./tuning";
import { DEFAULT_TUNING } from "./tuning";
import { computeEffectiveStats } from "./modifier";
import { computeAutoAttackDps } from "./autoAttack";
import { computeSpellDps, type ManaEconomy } from "./spell";

export interface DpsInput {
  champion: Champion;
  starLevel: StarLevel;
  items: Item[];
  /** Resolved active trait breakpoints (with their variables). */
  breakpoints: TraitBreakpoint[];
  target: TargetDummy;
  /** Pre-mitigation DPS the unit is taking (for mana-from-being-hit). Default 0. */
  incomingDps?: number;
  tuning?: Tuning;
}

export interface DpsBreakdown {
  effectiveStats: import("../data/types").Stats;
  autoAttackDps: {
    physical: number;
    onHit: number;
    total: number;
    attacksPerSec: number;
  };
  spellDps: {
    perCast: number;
    castsPerSec: number;
    total: number;
    abilityUncurated: 0 | 1;
  };
  combinedDps: number;
  detail: {
    physical: number;
    magic: number;
    true: number;
  };
}

export function computeDps(input: DpsInput): DpsBreakdown {
  const tuning = input.tuning ?? DEFAULT_TUNING;
  const mana: ManaEconomy = { incomingDps: input.incomingDps ?? 0 };

  const effectiveStats = computeEffectiveStats({
    champion: input.champion,
    starLevel: input.starLevel,
    items: input.items,
    breakpoints: input.breakpoints,
    tuning,
  });

  const auto = computeAutoAttackDps(effectiveStats, input.items, input.target, tuning);
  const spell = computeSpellDps(
    input.champion.ability,
    input.starLevel,
    effectiveStats,
    input.target,
    mana,
    tuning,
  );

  // Damage-type split (approximate: onHit types lumped by their declared type
  // would need per-effect tracking; here physical = auto physical + onHit,
  // magic/true come only from spell path which is already mitigated into total).
  const physical = auto.total;
  const magic = spell.total;
  const trueDmg = 0;

  return {
    effectiveStats,
    autoAttackDps: auto,
    spellDps: spell,
    combinedDps: auto.total + spell.total,
    detail: { physical, magic, true: trueDmg },
  };
}
