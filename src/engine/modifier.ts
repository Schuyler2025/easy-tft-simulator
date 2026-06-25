/**
 * Stat modifier pipeline — the heart of the engine.
 *
 * Every stat effect (from items or active trait breakpoints) becomes a
 * `StatModifier` tagged with an operation. Stats are resolved per-stat in a
 * fixed four-phase order matching TFT's actual computation:
 *
 *   1. ADD            -> effective = base + sum(add)
 *   2. PERCENT-ADD    -> effective *= (1 + sum(percent-add))
 *   3. PERCENT-MUL    -> effective *= product(1 + v)   (rare, sequential)
 *   4. OVERRIDE       -> last override wins
 *
 * Then post-clamps (attack-speed cap, crit in [0,1], mana <= maxMana).
 */
import type {
  Champion,
  Item,
  StarLevel,
  Stats,
  StatKey,
  TraitBreakpoint,
} from "../data/types";
import { traitStatOp, type ModifierOp } from "../data/traitModifierKind";
import type { Tuning } from "./tuning";
import { DEFAULT_TUNING } from "./tuning";

export interface StatModifier {
  stat: StatKey;
  op: ModifierOp;
  value: number;
  source: string;
}

export interface EffectiveStatsInput {
  champion: Champion;
  starLevel: StarLevel;
  items: Item[];
  /** Resolved trait breakpoints (with their `variables`). */
  breakpoints: TraitBreakpoint[];
  tuning?: Tuning;
}

const PHASE_ORDER: ModifierOp[] = ["add", "percent-add", "percent-mul", "override"];

function starStats(champion: Champion, star: StarLevel): Stats {
  const s = champion.baseStats;
  return star === 1 ? s.star1 : star === 2 ? s.star2 : s.star3;
}

function pushFlat(mods: StatModifier[], flat: Partial<Stats>, source: string): void {
  for (const [k, v] of Object.entries(flat)) {
    if (v === undefined) continue;
    mods.push({ stat: k as StatKey, op: "add", value: v, source });
  }
}

function pushPct(mods: StatModifier[], pct: Partial<Stats>, op: ModifierOp, source: string): void {
  for (const [k, v] of Object.entries(pct)) {
    if (v === undefined) continue;
    mods.push({ stat: k as StatKey, op, value: v, source });
  }
}

/** Collect all modifiers from items + breakpoints. */
export function collectModifiers(
  items: Item[],
  breakpoints: TraitBreakpoint[],
): StatModifier[] {
  const mods: StatModifier[] = [];

  for (const item of items) {
    pushFlat(mods, item.statModifiers.flat, `item:${item.apiName}`);
    pushPct(mods, item.statModifiers.percentAdditive, "percent-add", `item:${item.apiName}`);
    pushPct(mods, item.statModifiers.percentMultiplicative, "percent-mul", `item:${item.apiName}`);
  }

  for (const bp of breakpoints) {
    for (const [k, v] of Object.entries(bp.variables)) {
      if (v === undefined) continue;
      const stat = k as StatKey;
      mods.push({ stat, op: traitStatOp(stat), value: v, source: `trait@${bp.minUnits}` });
    }
  }

  return mods;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Resolve a champion's effective stats after star level, items, and active
 * trait breakpoints. Pure function.
 */
export function computeEffectiveStats(input: EffectiveStatsInput): Stats {
  const tuning = input.tuning ?? DEFAULT_TUNING;
  const base = { ...starStats(input.champion, input.starLevel) };

  // Base defaults: TFT grants every unit base crit. Fill if data omitted.
  if (!base.critChance) base.critChance = tuning.baseCritChance;
  if (!base.critMultiplier) base.critMultiplier = tuning.baseCritMultiplier;

  const mods = collectModifiers(input.items, input.breakpoints);

  // Group by stat.
  const byStat = new Map<StatKey, StatModifier[]>();
  for (const m of mods) {
    const arr = byStat.get(m.stat) ?? [];
    arr.push(m);
    byStat.set(m.stat, arr);
  }

  for (const [stat, statMods] of byStat) {
    // Apply in phase order.
    for (const op of PHASE_ORDER) {
      const phaseMods = statMods.filter((m) => m.op === op);
      if (phaseMods.length === 0) continue;
      if (op === "add") {
        base[stat] += phaseMods.reduce((s, m) => s + m.value, 0);
      } else if (op === "percent-add") {
        const sum = phaseMods.reduce((s, m) => s + m.value, 0);
        base[stat] *= 1 + sum;
      } else if (op === "percent-mul") {
        for (const m of phaseMods) base[stat] *= 1 + m.value;
      } else {
        // override: last wins (stable order = collection order)
        base[stat] = phaseMods[phaseMods.length - 1].value;
      }
    }
  }

  // Post-clamps.
  const baseAS = starStats(input.champion, input.starLevel).attackSpeed;
  base.attackSpeed = Math.min(
    base.attackSpeed,
    baseAS * tuning.attackSpeedMultiplierCap,
    tuning.attackSpeedCap,
  );
  base.attackSpeed = Math.max(0, base.attackSpeed);
  base.critChance = clamp(base.critChance, 0, 1);
  base.critMultiplier = Math.max(tuning.baseCritMultiplier, base.critMultiplier);
  if (base.maxMana > 0) base.mana = Math.min(base.mana, base.maxMana);
  base.health = Math.max(1, base.health);

  return base;
}
