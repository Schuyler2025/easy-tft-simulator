import { describe, it, expect } from "vitest";
import { computeEffectiveStats } from "../engine/modifier";
import type { Champion, Item, TraitBreakpoint } from "../data/types";
import type { Tuning } from "../engine/tuning";

const TUNING: Tuning = {
  armorK: 100,
  attackSpeedCap: 5,
  attackSpeedMultiplierCap: 2.5,
  manaPerAttack: 10,
  manaPerPremitDamageTaken: 0.01,
  baseCritChance: 0,
  baseCritMultiplier: 1,
  starMultipliers: { star1: 1, star2: 1.8, star3: 3.24 },
};

function champ(overrides: Partial<Champion> = {}): Champion {
  const base = {
    health: 800,
    mana: 0,
    maxMana: 50,
    attackDamage: 60,
    attackSpeed: 0.7,
    critChance: 0,
    critMultiplier: 1,
    armor: 20,
    magicResist: 20,
    power: 0,
    range: 4,
  };
  return {
    apiName: "TFT_Test_Champ",
    name: "Test",
    cost: 1,
    traits: [],
    baseStats: { star1: { ...base }, star2: { ...base }, star3: { ...base } },
    ability: { apiName: "A", castCostMana: 50, variables: [] },
    set: 99,
    ...overrides,
  };
}

function flatItem(apiName: string, flat: Partial<Item["statModifiers"]["flat"]>): Item {
  return {
    apiName,
    id: 1,
    name: apiName,
    statModifiers: { flat, percentAdditive: {}, percentMultiplicative: {} },
  };
}

function pctItem(apiName: string, pct: Partial<Item["statModifiers"]["percentAdditive"]>): Item {
  return {
    apiName,
    id: 2,
    name: apiName,
    statModifiers: { flat: {}, percentAdditive: pct, percentMultiplicative: {} },
  };
}

describe("computeEffectiveStats — phases", () => {
  it("ADD: flat AD from item adds to base", () => {
    const stats = computeEffectiveStats({
      champion: champ(),
      starLevel: 1,
      items: [flatItem("BF", { attackDamage: 30 })],
      breakpoints: [],
      tuning: TUNING,
    });
    expect(stats.attackDamage).toBe(90); // 60 + 30
  });

  it("PERCENT-ADD: AS% from item sums then multiplies base", () => {
    const stats = computeEffectiveStats({
      champion: champ(),
      starLevel: 1,
      items: [pctItem("Recurve", { attackSpeed: 0.5 })],
      breakpoints: [],
      tuning: TUNING,
    });
    expect(stats.attackSpeed).toBeCloseTo(0.7 * 1.5, 5); // 1.05
  });

  it("PERCENT-ADD: item + trait AS% sum before multiplying", () => {
    const bp: TraitBreakpoint = { minUnits: 2, variables: { attackSpeed: 0.2 } };
    const stats = computeEffectiveStats({
      champion: champ(),
      starLevel: 1,
      items: [pctItem("Recurve", { attackSpeed: 0.5 })],
      breakpoints: [bp],
      tuning: TUNING,
    });
    // 0.7 * (1 + 0.5 + 0.2) = 0.7 * 1.7 = 1.19
    expect(stats.attackSpeed).toBeCloseTo(1.19, 5);
  });

  it("ADD before PERCENT: flat AD added, then no percent on AD (additive trait)", () => {
    const bp: TraitBreakpoint = { minUnits: 2, variables: { attackDamage: 10 } };
    const stats = computeEffectiveStats({
      champion: champ(),
      starLevel: 1,
      items: [flatItem("BF", { attackDamage: 30 })],
      breakpoints: [bp],
      tuning: TUNING,
    });
    expect(stats.attackDamage).toBe(100); // 60 + 30 + 10
  });

  it("clamps attack speed to baseAS * multiplier cap", () => {
    const stats = computeEffectiveStats({
      champion: champ(),
      starLevel: 1,
      items: [pctItem("Greedy", { attackSpeed: 10 })], // +1000%
      breakpoints: [],
      tuning: TUNING,
    });
    // baseAS 0.7 * 2.5 = 1.75, well under 5.0 cap
    expect(stats.attackSpeed).toBeCloseTo(1.75, 5);
  });

  it("clamps crit chance to [0,1]", () => {
    const stats = computeEffectiveStats({
      champion: champ(),
      starLevel: 1,
      items: [flatItem("JG", { critChance: 2 })],
      breakpoints: [],
      tuning: TUNING,
    });
    expect(stats.critChance).toBe(1);
  });
});
