/**
 * DPS-over-time simulator — discrete time-step model.
 *
 * Where `computeDps` returns steady-state expected DPS, this simulator
 * generates the actual damage timeline: auto-attacks land on a clock driven by
 * `attacksPerSec`, abilities fire when accumulated mana hits `castCostMana`,
 * and damage accumulates tick by tick. This exposes the real shape of a
 * carry's output (slow ramp-up while charging the first cast, jumps on each
 * spell, plateau once mana economy stabilizes).
 *
 * The simulator is intentionally simple and PURE:
 *   - No buffs that scale over time (Titan's stacking, Archangel APPerInterval)
 *     are modeled here. Their steady-state value is already baked into the
 *     effective stats. A future pass can wire ramping stats to this loop.
 *   - On-hit damage from items is applied per-attack via the same auto-attack
 *     formula used by `computeAutoAttackDps`.
 *   - Mana from being hit (incomingDps * manaPerPremitDamageTaken) is folded
 *     into a continuous trickle, not modeled as discrete enemy strikes.
 *
 * The output is deterministic — `critChance` is folded into expected damage
 * per hit (same as `computeDps`), not sampled stochastically. This keeps the
 * curve smooth and the result reproducible. A future flag can switch to
 * sampled mode for variance bands.
 */
import type {
  Champion,
  Item,
  StarLevel,
  Stats,
  TargetDummy,
  TraitBreakpoint,
} from "../data/types";
import { DEFAULT_TUNING, type Tuning } from "./tuning";
import { computeEffectiveStats } from "./modifier";
import { critExpectation } from "./autoAttack";
import { damageMultiplier } from "./target";
import { computeDamagePerCast } from "./spell";

export interface TimelineInput {
  champion: Champion;
  starLevel: StarLevel;
  items: Item[];
  breakpoints: TraitBreakpoint[];
  target: TargetDummy;
  incomingDps?: number;
  tuning?: Tuning;
  /** Total duration in seconds (default 15). */
  duration?: number;
  /** Tick granularity in seconds (default 0.05 = 50ms). Smaller = smoother. */
  dt?: number;
}

export interface TimelinePoint {
  t: number;
  /** Cumulative total damage dealt by time t. */
  cumulative: number;
  /**
   * Running-average DPS up to time `t` — `cumulative / t`. Smooth and
   * monotonically converges to steady-state DPS. This is what most TFT DPS
   * charts visualize ("DPS so far"), and is what `dps` on this point holds.
   */
  dps: number;
  /**
   * Instantaneous DPS over the last 1-second sliding window. Spiky by nature
   * (every auto-attack and cast is a discrete event), useful for spotting
   * mana-economy stalls and burst windows. Not used by the default chart.
   */
  dpsWindow: number;
  /** Marker if a cast landed exactly in this tick. */
  cast?: boolean;
}

export interface Timeline {
  points: TimelinePoint[];
  /** Total damage at end of duration. */
  totalDamage: number;
  /** Effective DPS over the full window = totalDamage / duration. */
  averageDps: number;
  /** Number of ability casts that landed. */
  castCount: number;
  /** Times at which casts landed, for chart annotations. */
  castTimes: number[];
}

interface AutoHitDamage {
  /** Damage from primary auto-attack (after crit, mitigation). */
  auto: number;
  /** Damage from on-hit procs that fire every attack. */
  onHitEveryAttack: number;
  /** Per-Nth-attack proc bookkeeping: cycle length N => {dmg, n}. */
  onHitEveryN: { n: number; dmg: number }[];
}

function computeAutoHitDamage(
  stats: Stats,
  items: Item[],
  target: TargetDummy,
  tuning: Tuning,
): AutoHitDamage {
  const critExp = critExpectation(stats);
  const physMit = damageMultiplier("physical", target, tuning);
  const auto = stats.attackDamage * critExp * physMit;

  let onHitEveryAttack = 0;
  const onHitEveryN: { n: number; dmg: number }[] = [];
  for (const item of items) {
    if (!item.onHit) continue;
    for (const effect of item.onHit) {
      const trigger = effect.trigger;
      if (trigger.kind === "stacking" || trigger.kind === "on-cast") continue;
      let perProc = effect.base ?? 0;
      if (effect.adRatio) perProc += effect.adRatio * stats.attackDamage;
      if (effect.apRatio) perProc += effect.apRatio * stats.power;
      perProc *= damageMultiplier(effect.damageType, target, tuning);
      if (trigger.kind === "every-attack") {
        onHitEveryAttack += perProc;
      } else if (trigger.kind === "every-nth-attack") {
        onHitEveryN.push({ n: trigger.n, dmg: perProc });
      }
    }
  }
  return { auto, onHitEveryAttack, onHitEveryN };
}

/** Mana from being hit — continuous trickle only. Auto-attack mana is added {@link simulator main loop} */
function computeManaTrickle(incomingDps: number, tuning: Tuning): number {
  return incomingDps * tuning.manaPerPremitDamageTaken;
}

/**
 * Simulate combat tick by tick and produce a damage timeline.
 *
 * Loop invariants:
 *   - `attackCooldown` counts down from 1/attacksPerSec; when it hits 0, an
 *     auto-attack lands (damage applied, mana gained, cooldown reset).
 *   - `mana` accrues continuously from incoming-damage trickle + discretely
 *     per auto-attack landing. When `mana >= castCost`, a cast fires (damage
 *     applied, mana reset to 0).
 *   - `attackCount` tracks landed autos for `every-nth-attack` procs.
 *   - Casts on the same tick as an auto are applied after the auto.
 */
export function simulateTimeline(input: TimelineInput): Timeline {
  const tuning = input.tuning ?? DEFAULT_TUNING;
  const duration = input.duration ?? 15;
  const dt = input.dt ?? 0.05;
  const incomingDps = input.incomingDps ?? 0;

  const stats = computeEffectiveStats({
    champion: input.champion,
    starLevel: input.starLevel,
    items: input.items,
    breakpoints: input.breakpoints,
    tuning,
  });

  const attacksPerSec = stats.attackSpeed;
  const attackInterval = attacksPerSec > 0 ? 1 / attacksPerSec : Infinity;
  const hitDmg = computeAutoHitDamage(stats, input.items, input.target, tuning);

  const castCost =
    input.champion.ability.castCostMana > 0
      ? input.champion.ability.castCostMana
      : Infinity;
  const { perCast } = computeDamagePerCast(
    input.champion.ability,
    input.starLevel,
    stats,
    input.target,
    tuning,
  );
  const manaPerAttack = tuning.manaPerAttack;
  const manaTricklePerSec = computeManaTrickle(incomingDps, tuning);

  // Proc-per-attack passive ability (e.g. Caitlyn headshot): each auto-attack
  // has `procChance` to fire the ability. Folded as expected damage per auto
  // (deterministic, matches `computeSpellDps` mode). castCost is Infinity for
  // these so the mana-driven branch is automatically skipped below.
  const trigger = input.champion.ability.castSpec?.trigger;
  let procChancePerAttack = 0;
  if (trigger?.kind === "proc-per-attack") {
    const v = input.champion.ability.variables.find(
      (x) => x.name === trigger.chanceVariable,
    );
    if (v) {
      const raw =
        input.starLevel === 1
          ? v.values.star1
          : input.starLevel === 2
            ? v.values.star2
            : v.values.star3;
      procChancePerAttack = Math.max(
        0,
        trigger.chanceIsPercent === false ? raw : raw / 100,
      );
    }
  }
  const procDmgPerAuto = procChancePerAttack * perCast;

  // Initial state.
  let t = 0;
  let mana = stats.mana; // starting mana
  let attackCooldown = attackInterval; // first auto fires at t = attackInterval
  let attackCount = 0;
  let cumulative = 0;
  const castTimes: number[] = [];

  const points: TimelinePoint[] = [];
  // Push initial point (t=0, 0 damage).
  points.push({ t: 0, cumulative: 0, dps: 0, dpsWindow: 0 });

  const totalTicks = Math.ceil(duration / dt);
  for (let i = 1; i <= totalTicks; i++) {
    t = i * dt;
    let castFired = false;

    // 1. Auto-attack timer.
    attackCooldown -= dt;
    while (attackCooldown <= 0 && attacksPerSec > 0) {
      attackCount++;
      // primary auto damage
      cumulative += hitDmg.auto;
      // every-attack on-hit
      cumulative += hitDmg.onHitEveryAttack;
      // every-Nth on-hit
      for (const proc of hitDmg.onHitEveryN) {
        if (proc.n > 0 && attackCount % proc.n === 0) cumulative += proc.dmg;
      }
      // proc-per-attack ability (Caitlyn): expected damage per auto, and
      // count a fractional cast on each trigger event for the cast counter.
      if (procDmgPerAuto > 0) {
        cumulative += procDmgPerAuto;
        castTimes.push(t);
        castFired = true;
      }
      // mana from this auto
      if (castCost !== Infinity) mana += manaPerAttack;
      attackCooldown += attackInterval;
    }

    // 2. Mana from incoming damage (continuous trickle).
    if (castCost !== Infinity) mana += manaTricklePerSec * dt;

    // 3. Cast if mana ready.
    if (castCost !== Infinity && mana >= castCost) {
      cumulative += perCast;
      mana -= castCost; // overflow carries over
      castTimes.push(t);
      castFired = true;
    }

    points.push({
      t,
      cumulative,
      dps: cumulative / t,
      dpsWindow: instantaneousDps(points, cumulative, t, 1.0),
      ...(castFired ? { cast: true } : {}),
    });
  }

  return {
    points,
    totalDamage: cumulative,
    averageDps: duration > 0 ? cumulative / duration : 0,
    castCount: castTimes.length,
    castTimes,
  };
}

/**
 * DPS over a sliding 1-second window ending at time `t`. Uses the timeline
 * built so far; we look back through `points` for the value closest to
 * `t - window` seconds.
 */
function instantaneousDps(
  prior: TimelinePoint[],
  currentCumulative: number,
  t: number,
  window: number,
): number {
  if (t <= window) return currentCumulative / Math.max(t, 1e-6);
  const target = t - window;
  // Binary search would be cleaner, but the array is small and time grows
  // monotonically — linear scan from the tail is plenty fast for 300-pt
  // timelines.
  for (let i = prior.length - 1; i >= 0; i--) {
    if (prior[i].t <= target) {
      return (currentCumulative - prior[i].cumulative) / window;
    }
  }
  return currentCumulative / Math.max(t, 1e-6);
}
