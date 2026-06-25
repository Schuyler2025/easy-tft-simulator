import { describe, it, expect } from "vitest";
import { computeDps } from "../engine/dps";
import type { Champion, Item, TargetDummy } from "../data/types";
import type { Tuning } from "../engine/tuning";

// Clean tuning: no base crit, so critExpectation = 1 when critChance 0.
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
    attackDamage: 100,
    attackSpeed: 1.0,
    critChance: 0,
    critMultiplier: 1,
    armor: 0,
    magicResist: 0,
    power: 0,
    range: 4,
  };
  return {
    apiName: "TFT_Test_Champ",
    name: "Test",
    cost: 1,
    traits: [],
    baseStats: { star1: { ...base }, star2: { ...base }, star3: { ...base } },
    ability: {
      apiName: "A",
      castCostMana: 40,
      variables: [{ name: "AbilityDamage", values: { star1: 200, star2: 300, star3: 450 } }],
      castSpec: { components: [{ variable: "AbilityDamage", damageType: "magic" }] },
    },
    set: 99,
    ...overrides,
  };
}

const TARGET: TargetDummy = { health: 2000, armor: 100, magicResist: 0 };

describe("computeDps — auto-attack", () => {
  it("physical auto DPS = AD * critExpect * armorMit * AS", () => {
    const out = computeDps({
      champion: champ(),
      starLevel: 1,
      items: [],
      breakpoints: [],
      target: { health: 2000, armor: 100, magicResist: 0 },
      tuning: TUNING,
    });
    // AD 100, AS 1.0, critExpect 1, armor 100 -> mit 0.5 => 50 DPS
    expect(out.autoAttackDps.physical).toBeCloseTo(50, 5);
    expect(out.autoAttackDps.onHit).toBe(0);
    expect(out.autoAttackDps.total).toBeCloseTo(50, 5);
  });

  it("Runaan's bolt adds 0.75x AD physical per attack (mitigated by armor)", () => {
    const champNoSpell = champ({
      ability: { apiName: "A", castCostMana: 0, variables: [] },
    });
    const runaans: Item = {
      apiName: "TFT_Item_RunansHurricane",
      id: 1,
      name: "Runaan's",
      statModifiers: { flat: {}, percentAdditive: {}, percentMultiplicative: {} },
      onHit: [
        {
          trigger: { kind: "every-attack" },
          damageType: "physical",
          adRatio: 0.75,
          target: "secondary",
        },
      ],
    };
    const out = computeDps({
      champion: champNoSpell,
      starLevel: 1,
      items: [runaans],
      breakpoints: [],
      target: { health: 2000, armor: 100, magicResist: 0 },
      tuning: TUNING,
    });
    // bolt per attack = 0.75 * 100 = 75 pre-mit, * 0.5 armor * 1 attack/sec = 37.5
    expect(out.autoAttackDps.onHit).toBeCloseTo(37.5, 5);
  });
});

describe("computeDps — spell", () => {
  it("spell DPS = perCast * castsPerSec with mana from autos", () => {
    const out = computeDps({
      champion: champ(),
      starLevel: 1,
      items: [],
      breakpoints: [],
      target: { health: 2000, armor: 100, magicResist: 0 },
      tuning: TUNING,
    });
    // manaPerSec = 1.0 * 10 = 10; castCost 40 => castsPerSec 0.25
    // perCast = 200 magic, MR 0 => mit 1.0 => 200
    // spellDps = 200 * 0.25 = 50
    expect(out.spellDps.castsPerSec).toBeCloseTo(0.25, 5);
    expect(out.spellDps.perCast).toBeCloseTo(200, 5);
    expect(out.spellDps.total).toBeCloseTo(50, 5);
    expect(out.spellDps.abilityUncurated).toBe(0);
  });

  it("combined DPS = auto + spell", () => {
    const out = computeDps({
      champion: champ(),
      starLevel: 1,
      items: [],
      breakpoints: [],
      target: TARGET,
      tuning: TUNING,
    });
    expect(out.combinedDps).toBeCloseTo(100, 5); // 50 auto + 50 spell
  });

  it("falls back to best variable as magic when no castSpec", () => {
    const c = champ({
      ability: {
        apiName: "A",
        castCostMana: 40,
        variables: [{ name: "AbilityDamage", values: { star1: 200, star2: 300, star3: 450 } }],
        // no castSpec
      },
    });
    const out = computeDps({
      champion: c,
      starLevel: 1,
      items: [],
      breakpoints: [],
      target: { health: 2000, armor: 100, magicResist: 0 },
      tuning: TUNING,
    });
    expect(out.spellDps.abilityUncurated).toBe(1);
    expect(out.spellDps.perCast).toBeCloseTo(200, 5);
  });
});
