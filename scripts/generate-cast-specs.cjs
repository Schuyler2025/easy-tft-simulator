// Generate castSpec entries for all Set 17 champions from real tft.json.
// Run: node scripts/generate-cast-specs.cjs
const fs = require("fs");
const raw = JSON.parse(fs.readFileSync("tft.json", "utf8"));
const s17 = raw.sets["17"];
const playable = s17.champions.filter(
  (c) =>
    c.traits &&
    c.traits.length > 0 &&
    c.ability &&
    c.ability.variables &&
    c.ability.variables.length > 0,
);

/**
 * Pick the primary damage variable(s) for a champion's ability based on its
 * variable names and desc text. This is a heuristic — produces a reasonable
 * starting point per champion; AD/AP scaling coefficients use rough defaults
 * (adRatio:1 / apRatio:1) and need to be tuned against game data later.
 *
 * Why these patterns: cdragon variable names follow conventions across the
 * set. Inspecting the 63 Set-17 champions surfaces ~20 distinct patterns,
 * which we match in priority order.
 */
function buildSpec(c) {
  const vars = {};
  for (const v of c.ability.variables) {
    vars[v.name] = v;
  }
  const d = (c.ability.desc || "").replace(/<[^>]+>/g, "");
  const cmp = [];

  // 1. Hybrid AD+AP (ADDamage + APDamage)
  if (vars["ADDamage"] && vars["APDamage"]) {
    cmp.push({ variable: "ADDamage", damageType: "physical", adRatio: 1 });
    cmp.push({ variable: "APDamage", damageType: "magic", apRatio: 1 });
  }
  // 2. Hybrid AD+AP (DamageAD + DamageAP)
  else if (vars["DamageAD"] && vars["DamageAP"]) {
    cmp.push({ variable: "DamageAD", damageType: "physical", adRatio: 1 });
    cmp.push({ variable: "DamageAP", damageType: "magic", apRatio: 1 });
  }
  // 3. AD-only carry
  else if (vars["DamageAD"]) {
    cmp.push({ variable: "DamageAD", damageType: "physical", adRatio: 1 });
  }
  // 4. AP-only caster (DamageAP)
  else if (vars["DamageAP"]) {
    cmp.push({ variable: "DamageAP", damageType: "magic", apRatio: 1 });
  }
  // 5. Missile carries
  else if (vars["MissileAD"] && vars["MissileAP"]) {
    cmp.push({ variable: "MissileAD", damageType: "physical", adRatio: 1 });
    cmp.push({ variable: "MissileAP", damageType: "magic", apRatio: 1 });
  }
  // 6. AD/AP bleed (Talon)
  else if (vars["ADBleedDamage"] && vars["APBleedDamage"]) {
    cmp.push({ variable: "ADBleedDamage", damageType: "physical", adRatio: 1 });
    cmp.push({ variable: "APBleedDamage", damageType: "magic", apRatio: 1 });
  }
  // 7. Hit + Magic (Teemo)
  else if (vars["HitDamage"] && vars["MagicDamage"]) {
    cmp.push({ variable: "HitDamage", damageType: "physical", adRatio: 1 });
    cmp.push({ variable: "MagicDamage", damageType: "magic", apRatio: 1 });
  }
  // 8. Samira passive AD+AP
  else if (vars["PassiveAD"] && vars["PassiveAP"]) {
    cmp.push({ variable: "PassiveAD", damageType: "physical", adRatio: 1 });
    cmp.push({ variable: "PassiveAP", damageType: "magic", apRatio: 1 });
  }
  // 9. Vital damage (Fiora — true damage)
  else if (vars["VitalDamage"]) {
    cmp.push({ variable: "VitalDamage", damageType: "true", adRatio: 1 });
  }
  // 10. Dash + Bite (Fizz)
  else if (vars["DashDamage"] && vars["BiteDamageAP"]) {
    cmp.push({ variable: "DashDamage", damageType: "magic", apRatio: 1 });
    cmp.push({ variable: "BiteDamageAP", damageType: "magic", apRatio: 1 });
  }
  // 11. Pyke spear (physical)
  else if (vars["SpearDamage"]) {
    cmp.push({ variable: "SpearDamage", damageType: "physical", adRatio: 1 });
  }
  // 12. Urgot shotgun (physical)
  else if (vars["ShotgunDamage"]) {
    cmp.push({ variable: "ShotgunDamage", damageType: "physical", adRatio: 1 });
  }
  // 13. Passive damage (Master Yi)
  else if (vars["PassiveDamage"]) {
    cmp.push({ variable: "PassiveDamage", damageType: "physical", adRatio: 1 });
  }
  // 14. Vex shadow hand (magic)
  else if (vars["ShadowHandDamage"]) {
    cmp.push({ variable: "ShadowHandDamage", damageType: "magic", apRatio: 1 });
  }
  // 15. Mordekaiser per-proc (magic)
  else if (vars["DamagePerProc"]) {
    cmp.push({ variable: "DamagePerProc", damageType: "magic", apRatio: 1 });
  }
  // 16. Pantheon true DPS
  else if (vars["TrueDamagePerSecond"]) {
    cmp.push({ variable: "TrueDamagePerSecond", damageType: "true", apRatio: 1 });
  }
  // 17. Blitz bolts
  else if (vars["BoltDamage"]) {
    cmp.push({ variable: "BoltDamage", damageType: "magic", apRatio: 1 });
  }
  // 18. Sona debris
  else if (vars["DebrisDamage"]) {
    cmp.push({ variable: "DebrisDamage", damageType: "magic", apRatio: 1 });
  }
  // 19. Nunu initial
  else if (vars["InitialDamage"]) {
    cmp.push({ variable: "InitialDamage", damageType: "magic", apRatio: 1 });
  }
  // 20. Diana cleave
  else if (vars["CleaveDamage"]) {
    cmp.push({ variable: "CleaveDamage", damageType: "magic", apRatio: 1 });
  }
  // 21. Leblanc basic-attack damage
  else if (vars["BasicAttackDamage"]) {
    cmp.push({ variable: "BasicAttackDamage", damageType: "magic", apRatio: 1 });
  }
  // 22. TwistedFate average of min/max
  else if (vars["DamageMin"]) {
    cmp.push({ variable: "DamageMin", damageType: "magic", apRatio: 1 });
  }
  // 23. Generic "Damage" — type from desc
  else if (vars["Damage"]) {
    const t = d.includes("物理") ? "physical" : d.includes("真实") ? "true" : "magic";
    const ratio =
      t === "physical" ? { adRatio: 1 } : t === "true" ? {} : { apRatio: 1 };
    cmp.push({ variable: "Damage", damageType: t, ...ratio });
  }
  // 24. Sustained DPS variable
  else if (vars["DamagePerSecond"]) {
    cmp.push({ variable: "DamagePerSecond", damageType: "magic", apRatio: 1 });
  }
  // 25. BonusDamage (Chogath/Caitlyn)
  else if (vars["BonusDamage"]) {
    const t = d.includes("物理") ? "physical" : "magic";
    cmp.push({
      variable: "BonusDamage",
      damageType: t,
      ...(t === "physical" ? { adRatio: 1 } : { apRatio: 1 }),
    });
  }

  if (cmp.length === 0) return null;
  return { components: cmp };
}

const entries = [];
for (const c of playable) {
  const spec = buildSpec(c);
  if (!spec) {
    console.error("// SKIPPED (no damage var):", c.apiName, c.name);
    continue;
  }
  const compStr = spec.components
    .map((comp) => {
      const parts = [];
      parts.push(`variable: "${comp.variable}"`);
      parts.push(`damageType: "${comp.damageType}"`);
      if (comp.adRatio) parts.push(`adRatio: ${comp.adRatio}`);
      if (comp.apRatio) parts.push(`apRatio: ${comp.apRatio}`);
      if (comp.flatBase) parts.push(`flatBase: ${comp.flatBase}`);
      return `{ ${parts.join(", ")} }`;
    })
    .join(", ");
  // include a name comment
  entries.push(
    `  // ${c.name} (${c.cost}费${c.role ? " · " + c.role : ""})\n` +
      `  ${c.apiName}: { components: [${compStr}] }`,
  );
}
console.log(entries.join(",\n"));
