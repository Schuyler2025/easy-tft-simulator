/** Auto-attack DPS: physical auto damage + on-hit procs. Pure. */
import type { Item, Stats, TargetDummy } from "../data/types";
import type { Tuning } from "./tuning";
import { DEFAULT_TUNING } from "./tuning";
import { damageMultiplier } from "./target";

export interface AutoAttackDps {
  /** Primary physical auto damage per second (after crit + armor). */
  physical: number;
  /** On-hit proc damage per second (Runaan's, Statikk, etc.). */
  onHit: number;
  total: number;
  attacksPerSec: number;
}

/** Crit expectation multiplier on average hit: 1 + critChance*(critMult-1). */
export function critExpectation(stats: Stats): number {
  return 1 + stats.critChance * (stats.critMultiplier - 1);
}

/**
 * Damage per second from a single on-hit effect, averaged over attacks.
 * `attackIndex` modeling: every-attack = 1/attack; every-nth = 1/n per attack;
 * stacking = assume full stacks (flat bonus already in stats via passive);
 * on-cast = handled in spell path, returns 0 here.
 */
function onHitDpsPerEffect(
  effect: Item["onHit"] extends (infer E)[] | undefined ? E : never,
  stats: Stats,
  attacksPerSec: number,
  target: TargetDummy,
  tuning: Tuning,
): number {
  const trigger = effect.trigger;
  if (trigger.kind === "on-cast") return 0;
  if (trigger.kind === "stacking") return 0; // modeled as stat bonus, not per-hit damage

  let procsPerAttack = 0;
  if (trigger.kind === "every-attack") procsPerAttack = 1;
  else if (trigger.kind === "every-nth-attack") procsPerAttack = 1 / trigger.n;

  let perProc = effect.base ?? 0;
  if (effect.adRatio) perProc += effect.adRatio * stats.attackDamage;
  if (effect.apRatio) perProc += effect.apRatio * stats.power;

  // Secondary targets (Runaan's bolt) use the same armor mitigation as primary
  // in this single-dummy model.
  const mult = damageMultiplier(effect.damageType, target, tuning);
  return perProc * mult * procsPerAttack * attacksPerSec;
}

export function computeAutoAttackDps(
  stats: Stats,
  items: Item[],
  target: TargetDummy,
  tuning: Tuning = DEFAULT_TUNING,
): AutoAttackDps {
  const attacksPerSec = stats.attackSpeed;
  const critExp = critExpectation(stats);
  const physMit = damageMultiplier("physical", target, tuning);

  const physical = stats.attackDamage * critExp * physMit * attacksPerSec;

  let onHit = 0;
  for (const item of items) {
    if (!item.onHit) continue;
    for (const effect of item.onHit) {
      onHit += onHitDpsPerEffect(effect, stats, attacksPerSec, target, tuning);
    }
  }

  return { physical, onHit, total: physical + onHit, attacksPerSec };
}
