/**
 * Integration test against the real cdragon `tft.json` dump.
 * Confirms the normalizer extracts Set 17 correctly and the engine runs on
 * real data end-to-end without crashing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import process from "node:process";
import { normalizeTftJson } from "../data/normalize";
import { computeDps } from "../engine";

const TFT_JSON = process.cwd() + "/tft.json";
const hasFixture = existsSync(TFT_JSON);

describe.skipIf(!hasFixture)("real Set 17 cdragon data", () => {
  const raw = JSON.parse(readFileSync(TFT_JSON, "utf8"));
  const data = normalizeTftJson(raw, { setNumber: 17 });

  it("extracts Set 17 champion count", () => {
    expect(data.setNumber).toBe(17);
    expect(data.champions.length).toBeGreaterThan(60);
  });

  it("Briar (TFT17_Briar) has expected stats and traits", () => {
    const briar = data.champions.find((c) => c.apiName === "TFT17_Briar")!;
    expect(briar).toBeDefined();
    expect(briar.cost).toBe(1);
    expect(briar.baseStats.star1.attackDamage).toBe(35);
    expect(briar.baseStats.star1.health).toBe(650);
    expect(briar.baseStats.star1.attackSpeed).toBeCloseTo(0.75, 4);
    expect(briar.ability.castCostMana).toBe(40);
    // localized "幻灵战队" -> "TFT17_AnimaSquad"
    expect(briar.traits).toContain("TFT17_AnimaSquad");
    expect(briar.traits).toContain("TFT17_Primordian");
    expect(briar.traits).toContain("TFT17_AssassinTrait");
  });

  it("Bard (TFT17_Bard, 5-cost) ability variable star slots", () => {
    const bard = data.champions.find((c) => c.apiName === "TFT17_Bard")!;
    const dps = bard.ability.variables.find((v) => v.name === "DamagePerSecond")!;
    // raw value[1..3] = 240, 360, 3000
    expect(dps.values.star1).toBe(240);
    expect(dps.values.star2).toBe(360);
    expect(dps.values.star3).toBe(3000);
  });

  it("trait 挑战者 has 4 breakpoints with team-wide AS%", () => {
    const challenger = data.traits.find((t) => t.apiName === "TFT17_ASTrait")!;
    expect(challenger.breakpoints).toHaveLength(4);
    // 2-piece TeamwideAS=0.10, AttackSpeedPercent=0.15 -> summed: 0.25
    expect(challenger.breakpoints[0].minUnits).toBe(2);
    expect(challenger.breakpoints[0].variables.attackSpeed).toBeCloseTo(0.25, 4);
    // 5-piece: TeamwideAS=0.10 + AttackSpeedPercent=0.55 = 0.65
    expect(challenger.breakpoints[3].minUnits).toBe(5);
    expect(challenger.breakpoints[3].variables.attackSpeed).toBeCloseTo(0.65, 4);
  });

  it("items: 海妖之怒 (RunaansHurricane) has correct stats and merged override", () => {
    const runaans = data.items.find((i) => i.apiName === "TFT_Item_RunaansHurricane")!;
    expect(runaans).toBeDefined();
    expect(runaans.statModifiers.percentAdditive.attackDamage).toBeCloseTo(0.1, 4);
    expect(runaans.statModifiers.percentAdditive.attackSpeed).toBeCloseTo(0.1, 4);
    expect(runaans.statModifiers.flat.magicResist).toBe(20);
    expect(runaans.onHit?.length).toBeGreaterThan(0);
  });

  it("items: 朔极之矛 (SpearOfShojin) gives AD% AP and ManaRegen", () => {
    const shojin = data.items.find((i) => i.apiName === "TFT_Item_SpearOfShojin")!;
    expect(shojin.statModifiers.percentAdditive.attackDamage).toBeCloseTo(0.15, 4);
    expect(shojin.statModifiers.flat.power).toBe(15);
  });

  it("end-to-end: Briar 2★ with BF Sword + Recurve Bow vs 100-armor dummy yields plausible DPS", () => {
    const briar = data.champions.find((c) => c.apiName === "TFT17_Briar")!;
    const bf = data.items.find((i) => i.apiName === "TFT_Item_BFSword")!;
    const recurve = data.items.find((i) => i.apiName === "TFT_Item_RecurveBow")!;

    const out = computeDps({
      champion: briar,
      starLevel: 2,
      items: [bf, recurve],
      breakpoints: [],
      target: { health: 2000, armor: 100, magicResist: 0 },
    });

    // sanity: base AD 35 * 1.8 = 63; +10% AD = 69.3; AS 0.75 * 1.10 = 0.825
    // critExpect 1 + 0.25*(1.4-1) = 1.10; physical = 69.3 * 1.10 * 0.5 * 0.825 ≈ 31.4
    expect(out.effectiveStats.attackDamage).toBeCloseTo(69.3, 1);
    expect(out.effectiveStats.attackSpeed).toBeCloseTo(0.825, 3);
    expect(out.autoAttackDps.physical).toBeGreaterThan(25);
    expect(out.autoAttackDps.physical).toBeLessThan(40);
    expect(out.combinedDps).toBeGreaterThan(out.autoAttackDps.physical);
  });

  it("end-to-end: Aurora 2★ casts ability (curated spec, AP scaling)", () => {
    const aurora = data.champions.find((c) => c.apiName === "TFT17_Aurora")!;
    const out = computeDps({
      champion: aurora,
      starLevel: 2,
      items: [],
      breakpoints: [],
      target: { health: 5000, armor: 30, magicResist: 30 },
    });
    // castSpec is curated; abilityUncurated should be 0.
    expect(out.spellDps.abilityUncurated).toBe(0);
    expect(out.spellDps.perCast).toBeGreaterThan(0);
  });

  it("castSpec coverage: ≥85% of playable champions are curated", () => {
    // Skipped 7 utility-only champions (no damage variable):
    // MissFortune, Poppy, Galio, Jax, Shen, Zed, Morgana.
    const playable = data.champions.filter(
      (c) =>
        c.traits.length > 0 &&
        c.ability.variables.length > 0 &&
        c.ability.castCostMana > 0,
    );
    const curated = playable.filter((c) => c.ability.castSpec).length;
    const coverage = curated / playable.length;
    expect(coverage).toBeGreaterThanOrEqual(0.85);
    // The 7 skipped utility-only champions: tolerate a few uncovered.
    expect(playable.length - curated).toBeLessThanOrEqual(10);
  });

  it("hitCount multiplies per-cast damage (Bel'Veth 12-slash)", () => {
    const belveth = data.champions.find((c) => c.apiName === "TFT17_Belveth")!;
    const target = { health: 5000, armor: 0, magicResist: 0 };
    const out = computeDps({
      champion: belveth,
      starLevel: 2,
      items: [],
      breakpoints: [],
      target,
    });
    // star2 ADDamage=33, AD ~47*1.8=84.6, hitCount 12, magic 0-armor mult 1.0:
    // physical contribution = 12 * (33 + 84.6) ≈ 1411
    expect(out.spellDps.perCast).toBeGreaterThan(1000);
  });

  it("proc-per-attack ability (Caitlyn) yields nonzero spell DPS despite mana=0", () => {
    // Caitlyn has no mana bar: her "spell" is a 15% chance per auto-attack
    // to fire a bonus-damage headshot. The mana-driven path would give 0
    // casts/sec — proc-per-attack mode must route around that.
    const cait = data.champions.find((c) => c.apiName === "TFT17_Caitlyn")!;
    expect(cait.ability.castCostMana).toBe(0);
    expect(cait.ability.castSpec?.trigger?.kind).toBe("proc-per-attack");

    const out = computeDps({
      champion: cait,
      starLevel: 2,
      items: [],
      breakpoints: [],
      target: { health: 2000, armor: 0, magicResist: 0 },
    });
    // star2 base AD 65*1.8=117, Damage var star2=190, adRatio 1 ⇒ perCast ≈ 307
    expect(out.spellDps.perCast).toBeGreaterThan(250);
    // 15% × attackSpeed 0.55 ≈ 0.0825 casts/sec
    expect(out.spellDps.castsPerSec).toBeCloseTo(0.15 * 0.55, 4);
    expect(out.spellDps.total).toBeGreaterThan(20);
    expect(out.combinedDps).toBeGreaterThan(out.autoAttackDps.total);
  });
});
