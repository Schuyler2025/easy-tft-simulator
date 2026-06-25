/** Spell DPS: ability damage per cast * casts per second. Pure. */
import type { Ability, StarLevel, Stats, TargetDummy } from "../data/types";
import type { Tuning } from "./tuning";
import { DEFAULT_TUNING } from "./tuning";
import { damageMultiplier } from "./target";

export interface SpellDps {
  /** Average damage dealt per cast (after target mitigation). */
  perCast: number;
  /** Casts per second, driven by mana economy. */
  castsPerSec: number;
  total: number;
  /** 1 if perCast used the best-effort fallback (no curated castSpec). */
  abilityUncurated: 0 | 1;
}

export interface ManaEconomy {
  /** Pre-mitigation DPS the unit is taking (mana from being hit). 0 = solo dummy. */
  incomingDps: number;
}

/**
 * Mana gained per second.
 *   attacks/sec * manaPerAttack  +  incomingDps * manaPerPremitDamageTaken
 */
export function computeManaPerSec(
  attacksPerSec: number,
  incomingDps: number,
  tuning: Tuning = DEFAULT_TUNING,
): number {
  return attacksPerSec * tuning.manaPerAttack + incomingDps * tuning.manaPerPremitDamageTaken;
}

function starValue(values: { star1: number; star2: number; star3: number }, star: StarLevel): number {
  return star === 1 ? values.star1 : star === 2 ? values.star2 : values.star3;
}

/**
 * Average damage per cast. Uses the curated `castSpec` if present; otherwise
 * falls back to the largest ability variable as magic damage and flags
 * `abilityUncurated`.
 */
export function computeDamagePerCast(
  ability: Ability,
  star: StarLevel,
  stats: Stats,
  target: TargetDummy,
  tuning: Tuning = DEFAULT_TUNING,
): { perCast: number; abilityUncurated: 0 | 1 } {
  if (ability.castSpec) {
    let perCast = 0;
    for (const comp of ability.castSpec.components) {
      const variable = ability.variables.find((v) => v.name === comp.variable);
      const base = variable ? starValue(variable.values, star) : 0;
      let dmg = base + (comp.flatBase ?? 0);
      if (comp.apRatio) dmg += comp.apRatio * stats.power;
      if (comp.adRatio) dmg += comp.adRatio * stats.attackDamage;
      const hits = comp.hitCount ?? 1;
      perCast += dmg * hits * damageMultiplier(comp.damageType, target, tuning);
    }
    return { perCast, abilityUncurated: 0 };
  }

  // Fallback: largest variable as magic damage.
  let best = 0;
  let fallbackType: import("../data/types").DamageType = "magic";
  for (const v of ability.variables) {
    const val = starValue(v.values, star);
    if (val > best) {
      best = val;
      fallbackType = v.damageType ?? "magic";
    }
  }
  return {
    perCast: best * damageMultiplier(fallbackType, target, tuning),
    abilityUncurated: 1,
  };
}

export function computeSpellDps(
  ability: Ability,
  star: StarLevel,
  stats: Stats,
  target: TargetDummy,
  mana: ManaEconomy,
  tuning: Tuning = DEFAULT_TUNING,
): SpellDps {
  const { perCast, abilityUncurated } = computeDamagePerCast(ability, star, stats, target, tuning);

  // Cast frequency: either mana-driven (default) or attack-proc (zero-mana
  // passive carries like Caitlyn whose "spell" fires on a % of autos).
  const trigger = ability.castSpec?.trigger;
  let castsPerSec: number;
  if (trigger?.kind === "proc-per-attack") {
    const v = ability.variables.find((x) => x.name === trigger.chanceVariable);
    const raw = v ? starValue(v.values, star) : 0;
    // cdragon stores Caitlyn's ProcChance as `15` (percent), not `0.15`.
    // Default behavior assumes percent; explicit `chanceIsPercent: false`
    // overrides for already-fractional variables.
    const chance = trigger.chanceIsPercent === false ? raw : raw / 100;
    castsPerSec = Math.max(0, chance) * stats.attackSpeed;
  } else {
    const manaPerSec = computeManaPerSec(stats.attackSpeed, mana.incomingDps, tuning);
    const castCost = ability.castCostMana > 0 ? ability.castCostMana : Infinity;
    castsPerSec = castCost === Infinity ? 0 : manaPerSec / castCost;
  }

  return { perCast, castsPerSec, total: perCast * castsPerSec, abilityUncurated };
}
