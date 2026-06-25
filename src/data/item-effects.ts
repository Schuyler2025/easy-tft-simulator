/**
 * Hand-authored item override layer — Set 17 verified.
 *
 * cdragon `effects` only encodes flat/percent stat modifiers; on-hit procs and
 * conditional passives live in the localized `desc` text. This layer adds the
 * behavioral bits keyed by item `apiName`. Pure stat modifiers (AD%, AP, AS,
 * crit, armor, MR, HP) are picked up by `normalize.ts` from `effects` and do
 * NOT need to be repeated here.
 *
 * Set 17 differences worth noting:
 *  - 海妖之怒 (RunaansHurricane) is no longer "extra bolt"; it stacks AD per
 *    attack up to a cap, then grants capstone AS. We model the *stacked end
 *    state* as a flat stat buff via `onHit: stacking`.
 *  - 鬼索的狂暴之刃 (GuinsoosRageblade) grants stacking AS per second (not
 *    per attack as in older sets).
 *  - 虚空之杖 (StatikkShiv apiName) is the magic-damage MR-shred item; no
 *    every-3rd-attack proc this set.
 */
import type { OnHitEffect } from "./types";

export interface ItemBehaviorOverride {
  onHit?: OnHitEffect[];
  /** Free-form note for items whose passive isn't directly modeled yet. */
  passive?: string;
}

// --- Stacking-to-cap stat buffs (modeled as full-stack flat bonus) ----------

/**
 * 海妖之怒: 攻击叠加 +3.5% AD / 攻击, 上限 15 层 -> 满栈 +52.5% AD, 再加 +15% 攻速。
 * 模型化为达到满栈后的稳态属性增益（短时间 DPS 计算近似有效）。
 */
const runaansStacked: OnHitEffect = {
  trigger: {
    kind: "stacking",
    maxStacks: 15,
    perStackStat: { attackDamage: 0.035 }, // 注意：这里语义是「成长性 buff」，引擎当前未模拟
  },
  damageType: "physical",
  target: "primary",
};

/**
 * 泰坦的坚决: +2% AD / +2 AP / 层, 25 层封顶, 满栈附带 +10% 伤害增幅。
 * 满栈稳态。
 */
const titansStacked: OnHitEffect = {
  trigger: {
    kind: "stacking",
    maxStacks: 25,
    perStackStat: { attackDamage: 0.02, power: 2 },
  },
  damageType: "physical",
  target: "primary",
};

// --- Mana-on-attack items (not yet modeled in the mana economy) --------------
// 朔极之矛 +5 蓝/普攻, 纳什之牙 +2 蓝/普攻 (+4 暴击), 蓝霸符 战斗开始 +20 蓝
// These need a future `manaPerAttackBonus` field on the engine. For now we
// flag them via `passive` so the UI can warn.

// --- Registry keyed by cdragon item apiName (Set 17 verified) ---------------

export const ITEM_BEHAVIOR: Record<string, ItemBehaviorOverride> = {
  // 攻击叠层
  TFT_Item_RunaansHurricane: {
    onHit: [runaansStacked],
    passive: "set17: stacks AD% per attack to cap, capstone AS",
  },
  TFT_Item_TitansResolve: {
    onHit: [titansStacked],
    passive: "stacks AD%+AP per proc to 25, capstone damage amp",
  },
  TFT_Item_GuinsoosRageblade: {
    passive: "stacking AS per second (+7%/s)",
  },

  // 特殊伤害 / 减抗 / 增幅 (engine modeling TBD)
  TFT_Item_StatikkShiv: { passive: "set17: applies MR shred via attacks/spells" },
  TFT_Item_LastWhisper: { passive: "armor break 30% for 3s on attack/spell" },
  TFT_Item_SpectralGauntlet: { passive: "armor reduction in hex range" },
  TFT_Item_MadredsBloodrazor: { passive: "damage amp vs tanks" },
  TFT_Item_RedBuff: { passive: "burn + grievous wounds in range" },
  TFT_Item_Morellonomicon: { passive: "burn + grievous wounds on attack/spell" },
  TFT_Item_IonicSpark: { passive: "MR shred + on-cast magic damage" },
  TFT_Item_RapidFireCannon: { passive: "burn + healing reduction on attack/spell" },

  // 暴击使技能可暴击 (engine: future flag)
  TFT_Item_InfinityEdge: { passive: "abilities can crit (spell-crit)" },
  TFT_Item_JeweledGauntlet: { passive: "abilities can crit (spell-crit)" },

  // 蓝量补给 (engine: future mana-per-attack bonus)
  TFT_Item_SpearOfShojin: { passive: "+5 mana per auto-attack" },
  TFT_Item_BlueBuff: { passive: "+20 starting mana, +5 mana regen; +10% ADAP per takedown" },
  TFT_Item_Leviathan: { passive: "+2 mana per auto (+4 on crit)" },

  // 大天使: 战斗中每 5s +20% AP (engine: future timed stack)
  TFT_Item_ArchangelsStaff: { passive: "+20% AP every 5s in combat" },
};

export function getItemBehavior(apiName: string): ItemBehaviorOverride | undefined {
  return ITEM_BEHAVIOR[apiName];
}
