import { describe, it, expect } from "vitest";
import { normalizeTftJson } from "../data/normalize";

// Minimal synthetic cdragon-shaped fixture using real Set 17 field names.
const RAW = {
  sets: {
    "99": {
      name: "Set99",
      champions: [
        {
          apiName: "TFT99_TestChamp",
          name: "Test Champ",
          cost: 2,
          traits: ["测试羁绊"], // localized name -> must resolve to TFT99_TraitA
          stats: {
            hp: 800,
            mana: 40,         // cast cost
            initialMana: 0,
            damage: 60,        // AD
            attackSpeed: 0.7,
            critChance: 0.25,
            critMultiplier: 1.4,
            armor: 20,
            magicResist: 20,
            range: 4,
          },
          ability: {
            apiName: "TFT99_TestChamp",
            // 7-element array; index 1/2/3 = star1/2/3
            variables: [{ name: "Damage", value: [0, 200, 300, 450, 0, 0, 0] }],
          },
        },
      ],
      traits: [
        {
          apiName: "TFT99_TraitA",
          name: "测试羁绊",
          effects: [
            // Set-17 style: AttackSpeedPercent is a fraction (0.20 = +20%)
            { minUnits: 2, variables: { AttackSpeedPercent: 0.2 } },
            { minUnits: 4, variables: { AttackSpeedPercent: 0.45 } },
          ],
        },
      ],
    },
  },
  items: [
    {
      id: 1,
      apiName: "TFT_Item_RunaansHurricane",
      name: "海妖之怒",
      // Set-17 effects: AD% as fraction, AS as integer percent
      effects: { AD: 0.1, AS: 10, MagicResist: 20 },
    },
    {
      apiName: "TFT_Item_InfinityEdge",
      name: "无尽之刃",
      effects: { AD: 0.35, CritChance: 35 },
    },
    {
      // augment garbage that should be filtered out
      apiName: "TFT17_Augment_Foo",
      name: "Augment",
      effects: { AD: 0.1 },
    },
  ],
};

describe("normalizeTftJson (Set 17 field shapes)", () => {
  const data = normalizeTftJson(RAW);

  it("extracts set number", () => {
    expect(data.setNumber).toBe(99);
  });

  it("normalizes champion stats using cdragon field names (damage/hp/initialMana/mana)", () => {
    const c = data.champions[0];
    expect(c.apiName).toBe("TFT99_TestChamp");
    expect(c.baseStats.star1.attackDamage).toBe(60); // from stats.damage
    expect(c.baseStats.star1.health).toBe(800);      // from stats.hp
    expect(c.baseStats.star1.maxMana).toBe(40);      // from stats.mana (= cast cost)
    expect(c.baseStats.star1.mana).toBe(0);          // from stats.initialMana
    expect(c.baseStats.star1.critChance).toBe(0.25);
    expect(c.baseStats.star1.critMultiplier).toBeCloseTo(1.4, 5);
    expect(c.ability.castCostMana).toBe(40);
  });

  it("scales AD & HP per star with default multipliers", () => {
    const c = data.champions[0];
    expect(c.baseStats.star2.attackDamage).toBeCloseTo(108, 5); // 60 * 1.8
    expect(c.baseStats.star2.health).toBeCloseTo(1440, 5);      // 800 * 1.8
    expect(c.baseStats.star2.attackSpeed).toBeCloseTo(0.7, 5);  // not scaled
  });

  it("reads ability variables from 7-element array by index 1/2/3", () => {
    const v = data.champions[0].ability.variables[0];
    expect(v.name).toBe("Damage");
    expect(v.values.star1).toBe(200);
    expect(v.values.star2).toBe(300);
    expect(v.values.star3).toBe(450);
  });

  it("resolves localized champion traits to apiNames", () => {
    expect(data.champions[0].traits).toEqual(["TFT99_TraitA"]);
  });

  it("converts trait AttackSpeedPercent (fractional) into percentAdditive variables", () => {
    const t = data.traits[0];
    expect(t.breakpoints[0].minUnits).toBe(2);
    expect(t.breakpoints[0].variables.attackSpeed).toBeCloseTo(0.2, 5);
    expect(t.breakpoints[1].variables.attackSpeed).toBeCloseTo(0.45, 5);
  });

  it("interprets item AD as percent-additive (Set-17 fraction)", () => {
    const runaans = data.items.find((i) => i.apiName === "TFT_Item_RunaansHurricane")!;
    expect(runaans.statModifiers.percentAdditive.attackDamage).toBeCloseTo(0.1, 5);
    // AS: 10 -> 10/100 = 0.10 percent-additive
    expect(runaans.statModifiers.percentAdditive.attackSpeed).toBeCloseTo(0.1, 5);
    expect(runaans.statModifiers.flat.magicResist).toBe(20);
  });

  it("interprets item CritChance as integer-percent flat addition", () => {
    const ie = data.items.find((i) => i.apiName === "TFT_Item_InfinityEdge")!;
    expect(ie.statModifiers.flat.critChance).toBeCloseTo(0.35, 5); // 35 -> 0.35
    expect(ie.statModifiers.percentAdditive.attackDamage).toBeCloseTo(0.35, 5);
  });

  it("filters out augment/encounter/debug items", () => {
    const aug = data.items.find((i) => i.apiName.includes("Augment"));
    expect(aug).toBeUndefined();
  });

  it("merges item behavior override (onHit/passive) by apiName", () => {
    const runaans = data.items.find((i) => i.apiName === "TFT_Item_RunaansHurricane")!;
    expect(runaans.onHit?.length).toBeGreaterThan(0);
    expect(runaans.passive).toMatch(/stacks/);
  });
});
