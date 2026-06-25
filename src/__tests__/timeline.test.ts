import { describe, it, expect } from "vitest";
import { simulateTimeline } from "../engine/timeline";
import type { Champion, TargetDummy } from "../data/types";
import type { Tuning } from "../engine/tuning";

const TUNING: Tuning = {
  armorK: 100,
  attackSpeedCap: 5,
  attackSpeedMultiplierCap: 2.5,
  manaPerAttack: 10,
  manaPerPremitDamageTaken: 0,
  baseCritChance: 0,
  baseCritMultiplier: 1,
  starMultipliers: { star1: 1, star2: 1.8, star3: 3.24 },
};

function champ(): Champion {
  const base = {
    health: 800, mana: 0, maxMana: 40, attackDamage: 100, attackSpeed: 1.0,
    critChance: 0, critMultiplier: 1, armor: 0, magicResist: 0, power: 0, range: 4,
  };
  return {
    apiName: "T", name: "Test", cost: 1, traits: [], set: 99,
    baseStats: { star1: { ...base }, star2: { ...base }, star3: { ...base } },
    ability: {
      apiName: "T", castCostMana: 40,
      variables: [{ name: "AbilityDamage", values: { star1: 200, star2: 300, star3: 450 } }],
      castSpec: { components: [{ variable: "AbilityDamage", damageType: "magic" }] },
    },
  };
}

const TARGET: TargetDummy = { health: 5000, armor: 0, magicResist: 0 };

describe("simulateTimeline", () => {
  it("first point is t=0 with zero damage", () => {
    const tl = simulateTimeline({
      champion: champ(), starLevel: 1, items: [], breakpoints: [],
      target: TARGET, tuning: TUNING, duration: 5, dt: 0.1,
    });
    expect(tl.points[0]).toEqual({ t: 0, cumulative: 0, dps: 0, dpsWindow: 0 });
  });

  it("auto-attack lands by t=1/attacksPerSec ≈ 1.0", () => {
    const tl = simulateTimeline({
      champion: champ(), starLevel: 1, items: [], breakpoints: [],
      target: TARGET, tuning: TUNING, duration: 5, dt: 0.05,
    });
    // First auto should have cumulative 100 at or just after t=1.0.
    const first = tl.points.find((p) => p.cumulative > 0)!;
    expect(first.t).toBeGreaterThanOrEqual(0.95);
    expect(first.t).toBeLessThanOrEqual(1.05);
    expect(first.cumulative).toBeCloseTo(100, 5);
  });

  it("4 autos at AS=1 gives 4*manaPerAttack=40 mana => first cast at t≈4", () => {
    const tl = simulateTimeline({
      champion: champ(), starLevel: 1, items: [], breakpoints: [],
      target: TARGET, tuning: TUNING, duration: 8, dt: 0.05,
    });
    expect(tl.castCount).toBeGreaterThanOrEqual(1);
    // First cast around t=4.0 (right after the 4th auto)
    expect(tl.castTimes[0]).toBeGreaterThanOrEqual(3.8);
    expect(tl.castTimes[0]).toBeLessThanOrEqual(4.2);
    const afterCast = tl.points.find((p) => p.t >= tl.castTimes[0] + 0.01)!;
    expect(afterCast.cumulative).toBeGreaterThanOrEqual(600); // 4*100 + 200
  });

  it("totalDamage and averageDps are consistent", () => {
    const tl = simulateTimeline({
      champion: champ(), starLevel: 1, items: [], breakpoints: [],
      target: TARGET, tuning: TUNING, duration: 10, dt: 0.05,
    });
    expect(tl.totalDamage).toBe(tl.points[tl.points.length - 1].cumulative);
    expect(tl.averageDps).toBeCloseTo(tl.totalDamage / 10, 4);
  });

  it("cumulative damage is monotonic", () => {
    const tl = simulateTimeline({
      champion: champ(), starLevel: 1, items: [], breakpoints: [],
      target: TARGET, tuning: TUNING, duration: 10, dt: 0.05,
    });
    for (let i = 1; i < tl.points.length; i++) {
      expect(tl.points[i].cumulative).toBeGreaterThanOrEqual(tl.points[i - 1].cumulative);
    }
  });

  it("cast markers appear on points near cast times", () => {
    const tl = simulateTimeline({
      champion: champ(), starLevel: 1, items: [], breakpoints: [],
      target: TARGET, tuning: TUNING, duration: 12, dt: 0.1,
    });
    // At least one cast in 12s (AS=1, 10 mana/auto, 40 cost)
    expect(tl.castCount).toBeGreaterThanOrEqual(2);
    // Check that `cast` appears on some point(s)
    const castPoints = tl.points.filter((p) => p.cast);
    expect(castPoints.length).toBeGreaterThanOrEqual(1);
    expect(tl.castTimes.length).toBe(castPoints.length);
  });
});