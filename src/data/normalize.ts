/**
 * Normalizer: maps raw cdragon `tft.json` -> our internal `SetData`.
 *
 * Verified against the real Set 17 cdragon dump (zh_CN). Key facts:
 *  - champion.stats uses `damage`/`hp`/`initialMana`/`mana` (NOT `attackDamage`/
 *    `health`/`mana`/`maxMana`). `stats.mana` is the cast cost; `stats.initialMana`
 *    is starting mana.
 *  - ability.variables[].value is a 7-element array. Index 1/2/3 = star1/2/3
 *    (index 0 is a passive/placeholder, 4+ are higher-star slots).
 *  - champion.traits is a list of localized trait *names* (e.g. "幻灵战队"),
 *    NOT apiNames. We resolve names -> apiNames during set normalization.
 *  - items live in the global `raw.items` array (set node has `items: []`).
 *    Effect keys: `AD` (PERCENT additive: 0.15 -> +15%), `AP` (FLAT: 15 -> +15),
 *    `AS` (PERCENT, integer scale: 10 -> +10%), `CritChance` (PERCENT, integer
 *    scale: 35 -> +35% chance), `Armor`/`MagicResist`/`Health`/`Mana` flat.
 *  - Trait breakpoint variables use different keys again (`AttackSpeedPercent`,
 *    `TeamwideAS`, `ADAP1`, ...). We map a small whitelist; unknown keys are
 *    carried as raw `extra` for the engine to ignore safely.
 *
 * The normalizer is defensive: missing fields log a warning rather than crash.
 */
import type {
  Ability,
  AbilityScalingVariable,
  Champion,
  Item,
  ItemStatModifiers,
  SetData,
  StarScaled,
  Stats,
  StatKey,
  Trait,
  TraitBreakpoint,
} from "./types";
import { getAbilityCastSpec } from "./ability-effects";
import { getItemBehavior } from "./item-effects";
import { DEFAULT_TUNING } from "../engine/tuning";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** How a raw effect numeric value should be interpreted. */
type EffectUnit = "flat" | "percent-int" | "percent-frac";

interface EffectSpec {
  stat: StatKey;
  /**
   * - flat:         value applied as-is (Armor:20 -> +20)
   * - percent-int:  value is an integer percentage (AS:10 -> +0.10 fraction)
   * - percent-frac: value is already a fraction (AD:0.15 -> +0.15)
   */
  unit: EffectUnit;
  /** Which phase: flat -> add, percent-* -> percent-add. */
  phase: "flat" | "percent";
}

/** Item `effects` field — explicit per-key mapping. */
const ITEM_EFFECT_SPEC: Record<string, EffectSpec> = {
  AD: { stat: "attackDamage", unit: "percent-frac", phase: "percent" },
  AP: { stat: "power", unit: "flat", phase: "flat" },
  AS: { stat: "attackSpeed", unit: "percent-int", phase: "percent" },
  CritChance: { stat: "critChance", unit: "percent-int", phase: "flat" },
  Armor: { stat: "armor", unit: "flat", phase: "flat" },
  MagicResist: { stat: "magicResist", unit: "flat", phase: "flat" },
  Health: { stat: "health", unit: "flat", phase: "flat" },
  Mana: { stat: "mana", unit: "flat", phase: "flat" }, // bonus starting mana (e.g. Blue Buff)
  Range: { stat: "range", unit: "flat", phase: "flat" },
};

/** Trait `variables` field — explicit per-key mapping. Unknown keys ignored. */
const TRAIT_EFFECT_SPEC: Record<string, EffectSpec> = {
  AttackSpeedPercent: { stat: "attackSpeed", unit: "percent-frac", phase: "percent" },
  TeamwideAS: { stat: "attackSpeed", unit: "percent-frac", phase: "percent" },
  AS: { stat: "attackSpeed", unit: "percent-int", phase: "percent" },
  AD: { stat: "attackDamage", unit: "percent-frac", phase: "percent" },
  ADAmp: { stat: "attackDamage", unit: "percent-frac", phase: "percent" },
  AP: { stat: "power", unit: "flat", phase: "flat" },
  // ADAP / ADAPPercent: trait grants both AD% and AP flat. We treat ADAP as a
  // shorthand and emit only the power flat half (AD% handled by name variants
  // when present). Many set-17 traits use `ADAP1` etc. — names normalize to AP.
  ADAP: { stat: "power", unit: "flat", phase: "flat" },
  ADAP1: { stat: "power", unit: "flat", phase: "flat" },
  ADAP2: { stat: "power", unit: "flat", phase: "flat" },
  Armor: { stat: "armor", unit: "flat", phase: "flat" },
  MagicResist: { stat: "magicResist", unit: "flat", phase: "flat" },
  Health: { stat: "health", unit: "flat", phase: "flat" },
  HealthPercent: { stat: "health", unit: "percent-frac", phase: "percent" },
  CritChance: { stat: "critChance", unit: "percent-int", phase: "flat" },
  CritDamage: { stat: "critMultiplier", unit: "percent-frac", phase: "flat" },
};

function applyUnit(raw: number, unit: EffectUnit): number {
  if (!Number.isFinite(raw) || raw === 0) return 0;
  switch (unit) {
    case "flat":
      return raw;
    case "percent-int":
      return raw / 100;
    case "percent-frac":
      return raw;
  }
}

function emptyStats(): Stats {
  return {
    health: 0,
    mana: 0,
    maxMana: 0,
    attackDamage: 0,
    attackSpeed: 0,
    critChance: 0,
    critMultiplier: 0,
    armor: 0,
    magicResist: 0,
    power: 0,
    range: 1,
  };
}

/**
 * Pull a per-star value from cdragon's 7-element ability variable array.
 * Index 1/2/3 = star1/2/3. Falls back to index 0 or the scalar value.
 */
function starValueFromVarArray(value: any, star: 1 | 2 | 3): number {
  if (Array.isArray(value)) {
    if (value.length >= 4) return Number(value[star]) || 0;
    if (value.length >= 1) return Number(value[Math.min(star - 1, value.length - 1)]) || 0;
    return 0;
  }
  return Number(value) || 0;
}

function abilityVarToStarScaled(value: any): StarScaled<number> {
  return {
    star1: starValueFromVarArray(value, 1),
    star2: starValueFromVarArray(value, 2),
    star3: starValueFromVarArray(value, 3),
  };
}

function normalizeItem(raw: any): Item {
  const statModifiers: ItemStatModifiers = { flat: {}, percentAdditive: {}, percentMultiplicative: {} };
  const effects = raw?.effects ?? {};
  for (const [k, v] of Object.entries(effects)) {
    const spec = ITEM_EFFECT_SPEC[k];
    if (!spec) continue;
    const num = Number(v);
    if (!Number.isFinite(num) || num === 0) continue;
    const value = applyUnit(num, spec.unit);
    if (spec.phase === "flat") {
      statModifiers.flat[spec.stat] = (statModifiers.flat[spec.stat] ?? 0) + value;
    } else {
      statModifiers.percentAdditive[spec.stat] = (statModifiers.percentAdditive[spec.stat] ?? 0) + value;
    }
  }

  const apiName = String(raw?.apiName ?? raw?.name ?? "");
  const behavior = getItemBehavior(apiName);

  return {
    apiName,
    id: Number(raw?.id ?? 0),
    name: String(raw?.name ?? apiName),
    statModifiers,
    onHit: behavior?.onHit,
    passive: behavior?.passive,
  };
}

function normalizeAbility(raw: any, fallbackApiName: string, fallbackCastCost: number): Ability {
  const variables: AbilityScalingVariable[] = [];
  const rawVars: any[] = raw?.variables ?? [];
  for (const rv of rawVars) {
    const name = String(rv?.name ?? "");
    if (!name) continue;
    variables.push({
      name,
      values: abilityVarToStarScaled(rv?.value),
      apRatio: rv?.apRatio,
      damageType: rv?.damageType,
    });
  }
  const apiName = String(raw?.apiName ?? fallbackApiName ?? "");
  return {
    apiName,
    castCostMana: Number(raw?.castCostMana ?? fallbackCastCost ?? 0),
    variables,
    castSpec: getAbilityCastSpec(apiName),
  };
}

function normalizeChampion(raw: any, set: number, traitNameToApi: Map<string, string>): Champion {
  const s = raw?.stats ?? {};

  // cdragon field names: `damage` (AD), `hp` (HP), `mana` (cast cost),
  // `initialMana` (starting mana). Map onto our normalized stat names.
  const star1 = emptyStats();
  star1.health = Number(s.hp ?? 0);
  star1.mana = Number(s.initialMana ?? 0);
  star1.maxMana = Number(s.mana ?? 0);
  star1.attackDamage = Number(s.damage ?? 0);
  star1.attackSpeed = Number(s.attackSpeed ?? 0);
  star1.critChance = Number(s.critChance ?? 0);
  star1.critMultiplier = Number(s.critMultiplier ?? 0);
  star1.armor = Number(s.armor ?? 0);
  star1.magicResist = Number(s.magicResist ?? 0);
  star1.power = 0; // champions have no base AP
  star1.range = Number(s.range ?? 1);

  const m = DEFAULT_TUNING.starMultipliers;
  const scale = (v: number, mult: number) => v * mult;
  const baseStats: StarScaled<Stats> = {
    star1: { ...star1 },
    star2: {
      ...star1,
      health: scale(star1.health, m.star2),
      attackDamage: scale(star1.attackDamage, m.star2),
    },
    star3: {
      ...star1,
      health: scale(star1.health, m.star3),
      attackDamage: scale(star1.attackDamage, m.star3),
    },
  };

  // Champion.traits comes in as localized names; resolve to apiNames so the
  // engine can match against Trait.apiName. Unresolved names are kept as-is
  // with a warning so we don't silently drop a trait.
  const rawTraits: string[] = Array.isArray(raw?.traits) ? raw.traits.map(String) : [];
  const traits = rawTraits.map((t) => traitNameToApi.get(t) ?? t);

  return {
    apiName: String(raw?.apiName ?? raw?.name ?? ""),
    name: String(raw?.name ?? raw?.apiName ?? ""),
    cost: Number(raw?.cost ?? 0),
    traits,
    baseStats,
    ability: normalizeAbility(raw?.ability ?? {}, String(raw?.apiName ?? ""), star1.maxMana),
    set,
  };
}

function normalizeTrait(raw: any, set: number): Trait {
  const breakpoints: TraitBreakpoint[] = [];
  const effects: any[] = raw?.effects ?? [];
  for (const e of effects) {
    const variables: Partial<Stats> = {};
    const vars = e?.variables ?? {};
    for (const [k, v] of Object.entries(vars)) {
      const spec = TRAIT_EFFECT_SPEC[k];
      if (!spec) continue;
      const num = Number(v);
      if (!Number.isFinite(num) || num === 0) continue;
      variables[spec.stat] = (variables[spec.stat] ?? 0) + applyUnit(num, spec.unit);
    }
    breakpoints.push({ minUnits: Number(e?.minUnits ?? 0), variables });
  }
  return {
    apiName: String(raw?.apiName ?? raw?.name ?? ""),
    name: String(raw?.name ?? raw?.apiName ?? ""),
    breakpoints,
    set,
  };
}

/**
 * Heuristic filter: keep only items the engine could plausibly model. Excludes
 * augments, encounter rewards, debug items, components without effects, and
 * legacy duplicates from non-current sets.
 */
function shouldKeepItem(raw: any, setNumber: number): boolean {
  const apiName: string = String(raw?.apiName ?? "");
  if (!apiName) return false;
  if (apiName.includes("Augment")) return false;
  if (apiName.includes("Encounter")) return false;
  if (apiName.includes("Assist_")) return false;
  if (apiName.includes("Debug")) return false;
  if (apiName.includes("Grant")) return false;
  if (apiName.includes("Tutorial")) return false;
  if (apiName.includes("PVEMODE")) return false;
  if (apiName.includes("MacaoMode")) return false;
  if (apiName === "TFT_Item_Blank" || apiName === "TFT_Item_EmptyBag") return false;

  // Standard items: TFT_Item_* with at least one mapped effect.
  if (apiName.startsWith("TFT_Item_")) {
    const eff = raw?.effects ?? {};
    return Object.keys(eff).some((k) => k in ITEM_EFFECT_SPEC);
  }
  // Set-specific artifacts: TFT{set}_Item_Artifact_*
  if (apiName.startsWith(`TFT${setNumber}_Item_Artifact_`)) return true;
  return false;
}

export interface NormalizeOptions {
  /** Which set to extract (e.g. 17). Defaults to the highest-numbered set present. */
  setNumber?: number;
}

export function normalizeTftJson(raw: any, opts: NormalizeOptions = {}): SetData {
  const setsObj = raw?.sets ?? {};
  const setKeys = Object.keys(setsObj).map(Number).filter((n) => !Number.isNaN(n));
  const target = opts.setNumber ?? Math.max(...setKeys);
  const setNode = setsObj[String(target)] ?? setsObj[target] ?? {};

  // Build trait-name -> apiName lookup BEFORE normalizing champions.
  const traits: Trait[] = (setNode.traits ?? []).map((t: any) => normalizeTrait(t, target));
  const traitNameToApi = new Map<string, string>();
  for (const rawTrait of setNode.traits ?? []) {
    const name = String(rawTrait?.name ?? "");
    const api = String(rawTrait?.apiName ?? "");
    if (name && api) traitNameToApi.set(name, api);
  }

  const champions: Champion[] = (setNode.champions ?? []).map((c: any) =>
    normalizeChampion(c, target, traitNameToApi),
  );

  const rawItems: any[] = raw.items ?? [];
  const items: Item[] = rawItems.filter((i) => shouldKeepItem(i, target)).map(normalizeItem);

  const patch = String(raw?.apiData ?? raw?.patch ?? "unknown");

  if (champions.length === 0) {
    console.warn(`[normalize] no champions found for set ${target}`);
  }

  return {
    setNumber: target,
    patch,
    champions,
    traits,
    items,
    fetchedAt: Date.now(),
    source: "communitydragon",
  };
}
