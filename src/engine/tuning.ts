/**
 * Set/patch tuning constants.
 *
 * Values verified against real cdragon Set 17 data are marked [VERIFIED];
 * unverified values keep [ASSUMPTION]. A set bump = edit this file +
 * re-curate the override layers.
 */

export interface Tuning {
  /** Constant K in armor mitigation: damageMultiplier = K / (K + armor). Stable across sets. */
  armorK: number;

  /** Hard cap on attacks per second. [ASSUMPTION] */
  attackSpeedCap: number;

  /** Effective attack speed may not exceed baseAS * this multiplier. [ASSUMPTION] */
  attackSpeedMultiplierCap: number;

  /** Mana gained per auto-attack the unit performs. [ASSUMPTION — set-17 default] */
  manaPerAttack: number;

  /** Mana gained per point of pre-mitigation damage the unit *takes*. [ASSUMPTION, varies by set] */
  manaPerPremitDamageTaken: number;

  /** Base crit multiplier — [VERIFIED Set 17: 1.4 across all sampled champions]. */
  baseCritMultiplier: number;

  /** Base crit chance — [VERIFIED Set 17: 0.25 across all sampled champions]. */
  baseCritChance: number;

  /** Star multipliers for AD & HP, used to derive star2/star3 from cdragon 1-star scalars. */
  starMultipliers: { star1: number; star2: number; star3: number };
}

export const DEFAULT_TUNING: Tuning = {
  armorK: 100,
  attackSpeedCap: 5.0,
  attackSpeedMultiplierCap: 2.5,
  manaPerAttack: 10,
  manaPerPremitDamageTaken: 0.01, // [ASSUMPTION] ~1 mana per 100 pre-mit damage taken
  baseCritMultiplier: 1.4,
  baseCritChance: 0.25,
  starMultipliers: { star1: 1, star2: 1.8, star3: 3.24 },
};
