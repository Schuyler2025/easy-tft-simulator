/**
 * Normalized internal data model for the TFT DPS simulator.
 *
 * Raw cdragon JSON never leaks past `normalize.ts`. Everything the engine
 * consumes is defined here. Field shapes are decoupled from the API so a set
 * bump only touches `tuning.ts` + the hand-authored override layers
 * (`item-effects.ts` / `ability-effects.ts`), not the data pipeline.
 */

/** Stats tracked per champion. `power` = ability power. */
export type StatKey =
  | "health"
  | "mana" // current/starting mana
  | "maxMana" // cast cost
  | "attackDamage"
  | "attackSpeed" // attacks per second
  | "critChance"
  | "critMultiplier"
  | "armor"
  | "magicResist"
  | "power"
  | "range";

export type Stats = Record<StatKey, number>;

/** Per-star scaling (1/2/3 star). TFT multiplies AD & HP and ability values by star. */
export interface StarScaled<T> {
  star1: T;
  star2: T;
  star3: T;
}

export type StarLevel = 1 | 2 | 3;

/** Damage kind, decides which target resistance mitigates it. */
export type DamageType = "physical" | "magic" | "true";

export type DamageCategory = "physical" | "magic" | "true";

/** A single scaling variable from a champion's ability (e.g. AbilityDamage). */
export interface AbilityScalingVariable {
  name: string;
  values: StarScaled<number>;
  /** Hand-curated: AP scaling ratio for this variable, if any. */
  apRatio?: number;
  /** Hand-curated: damage type, defaults to magic if absent. */
  damageType?: DamageType;
}

/**
 * Cast specification — hand-authored per champion in `ability-effects.ts`.
 * Describes how ability variables combine into damage components per cast.
 * cdragon does not encode this reliably, so it lives in the override layer.
 *
 * Per-component damage (before target mitigation):
 *   raw = (variable_value_at_star + flatBase) + apRatio*AP + adRatio*AD
 *
 * The `variable` value from cdragon is treated as ABSOLUTE base damage at that
 * star (e.g. Aurora's `Damage` star2 = 80 means "+80 base"). AD/AP scaling
 * coefficients are not exposed in cdragon JSON — they're hand-tuned here.
 */
export interface CastComponent {
  /** Which ability variable supplies the base value. */
  variable: string;
  damageType: DamageType;
  /** Multiplier on the unit's effective AD (1.0 = +1 dmg per AD). */
  adRatio?: number;
  /** Multiplier on the unit's effective AP (1.0 = +1 dmg per AP). */
  apRatio?: number;
  /** Flat bonus added to the variable value before scaling. */
  flatBase?: number;
  /**
   * Number of hits/tick instances per cast. The base value from cdragon is
   * per-hit, and the total is `hitCount × (base + scaling)`. Default 1.
   * Examples: Bel'Veth 12-slash (@scaleAS%), Mordekaiser 5-proc.
   */
  hitCount?: number;
}

export interface AbilityCastSpec {
  components: CastComponent[];
  /**
   * How casts are triggered. Default = mana economy (mana/sec ÷ castCostMana).
   *
   * `proc-per-attack` is for zero-mana passive procs — e.g. Caitlyn whose
   * "spell" is "each auto-attack has ProcChance% to fire a headshot". The
   * variable named here supplies the proc chance; casts/sec then equals
   * `procChance × attacksPerSec` and mana is ignored.
   */
  trigger?:
    | { kind: "mana" }
    | { kind: "proc-per-attack"; chanceVariable: string; /** values are 0-100 */ chanceIsPercent?: boolean };
}

export interface Ability {
  apiName: string;
  /** Mana needed to cast (= cdragon maxMana). */
  castCostMana: number;
  variables: AbilityScalingVariable[];
  /** Present only when hand-curated. Absent => spell DPS uses best-effort fallback. */
  castSpec?: AbilityCastSpec;
}

export interface Champion {
  apiName: string;
  name: string;
  cost: number;
  traits: string[]; // trait apiNames
  baseStats: StarScaled<Stats>;
  ability: Ability;
  set: number;
}

/** How an on-hit / passive effect triggers from auto-attacks. */
export type OnHitTrigger =
  | { kind: "every-attack" } // Runaan's bolt
  | { kind: "every-nth-attack"; n: number } // Statikk Shiv (n=3)
  | { kind: "stacking"; maxStacks: number; perStackStat?: Partial<Stats> } // Titan's
  | { kind: "on-cast" };

export interface OnHitEffect {
  trigger: OnHitTrigger;
  damageType: DamageType;
  /** Flat base damage per proc. */
  base?: number;
  /** Ratio of effective AD applied per proc. */
  adRatio?: number;
  /** Ratio of effective power (AP) applied per proc. */
  apRatio?: number;
  /** Where the proc lands. `secondary` => does not get primary target mitigation stacking. */
  target: "primary" | "secondary";
}

export interface ItemStatModifiers {
  /** Flat adds (AD, AP, armor, HP, mana...). */
  flat: Partial<Stats>;
  /** Percent-additive (e.g. AS%). Summed, then multiplied. */
  percentAdditive: Partial<Stats>;
  /** Percent-multiplicative (rare; applied as sequential multipliers). */
  percentMultiplicative: Partial<Stats>;
}

export interface Item {
  apiName: string;
  id: number;
  name: string;
  statModifiers: ItemStatModifiers;
  onHit?: OnHitEffect[];
  /** Free-form passive note; engine may model special cases off this. */
  passive?: string;
}

export interface TraitBreakpoint {
  minUnits: number;
  variables: Partial<Stats>;
}

export interface Trait {
  apiName: string;
  name: string;
  breakpoints: TraitBreakpoint[];
  set: number;
}

/** The dummy the champion hits. */
export interface TargetDummy {
  health: number;
  armor: number;
  magicResist: number;
  flatReductionPhysical?: number;
  flatReductionMagic?: number;
}

export interface SetData {
  setNumber: number;
  patch: string;
  champions: Champion[];
  traits: Trait[];
  items: Item[];
  fetchedAt: number;
  source: string;
}

/** A trait breakpoint the user has activated (e.g. 4 Bruiser). */
export interface ActiveBreakpoint {
  traitApiName: string;
  minUnits: number;
}
