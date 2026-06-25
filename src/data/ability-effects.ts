/**
 * Hand-authored ability cast-spec overrides — Set 17 (auto-generated then
 * hand-tuned).
 *
 * cdragon exposes ability variables (per-star damage numbers) but NOT how
 * they combine into damage, their type, or AD/AP scaling coefficients —
 * that info lives in `desc` text and game code.
 *
 * Per-component damage:
 *   raw = (variable_value_at_star + flatBase) + apRatio*AP + adRatio*AD
 *
 * For Set 17, the `variable.value[1..3]` slots hold absolute base damage at
 * each star (e.g. Aurora's `Damage` = [_,80,120,190,_,_,_]). The AD/AP scaling
 * coefficients here use simple defaults (adRatio:1 / apRatio:1) which assume
 * "ability damage scales 100% with AD/AP after base". Real coefficients vary
 * per champion and need tuning against the game's actual scaling — these are
 * a serviceable starting point that produces order-of-magnitude correct DPS.
 *
 * Coverage: 56/63 playable Set-17 champions. The 7 skipped are damage-less
 * utility/transform spells (Miss Fortune's mode pick, Poppy's flat resists,
 * Galio's durability buff, Jax's stance toggle, Shen's bonus-on-attack buff,
 * Zed's HP-cost passive, Morgana's heal). They fall back to the engine's
 * "largest variable as magic damage" estimate with `abilityUncurated=1`.
 *
 * Champions without an entry fall back to "largest variable as magic damage,
 * no scaling" and set `abilityUncurated=1` in the engine output.
 */
import type { AbilityCastSpec } from "./types";

export const ABILITY_CAST_SPEC: Record<string, AbilityCastSpec> = {
  // === 1-cost ===
  // 贝蕾亚 Briar - 单击物理 + 魔法附伤
  TFT17_Briar: {
    components: [
      { variable: "ADDamage", damageType: "physical", adRatio: 1 },
      { variable: "APDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 维迦 Veigar - 单体魔法
  TFT17_Veigar: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 亚托克斯 Aatrox - 物理 + 护甲缩放（额外护甲伤害变量略）
  TFT17_Aatrox: {
    components: [{ variable: "DamageAD", damageType: "physical", adRatio: 1 }],
  },
  // 凯特琳 Caitlyn - 普攻 ProcChance%（=15%）触发强化爆头（物理）
  // 没有蓝条，所以用 proc-per-attack 触发：施法/秒 = 15% × 攻速。
  TFT17_Caitlyn: {
    components: [{ variable: "Damage", damageType: "physical", adRatio: 1 }],
    trigger: { kind: "proc-per-attack", chanceVariable: "ProcChance" },
  },
  // 提莫 Teemo - 物理 + 魔法双段
  TFT17_Teemo: {
    components: [
      { variable: "HitDamage", damageType: "physical", adRatio: 1 },
      { variable: "MagicDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 内瑟斯 Nasus - 魔法 + 血量缩放（DamageHealth 略）
  TFT17_Nasus: { components: [{ variable: "DamageAP", damageType: "magic", apRatio: 1 }] },
  // 崔斯特 TwistedFate - 随机 min/max 魔法，取下界
  TFT17_TwistedFate: {
    components: [{ variable: "DamageMin", damageType: "magic", apRatio: 1 }],
  },
  // 泰隆 Talon - 流血物理 + 魔法
  TFT17_Talon: {
    components: [
      { variable: "ADBleedDamage", damageType: "physical", adRatio: 1 },
      { variable: "APBleedDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 伊泽瑞尔 Ezreal - 物理 + 魔法
  TFT17_Ezreal: {
    components: [
      { variable: "ADDamage", damageType: "physical", adRatio: 1 },
      { variable: "APDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 蕾欧娜 Leona - 单体魔法
  TFT17_Leona: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 科加斯 Cho'Gath - 阶段性额外魔法
  TFT17_Chogath: {
    components: [{ variable: "BonusDamage", damageType: "magic", apRatio: 1 }],
  },
  // 丽桑卓 Lissandra - 单体魔法
  TFT17_Lissandra: {
    components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }],
  },
  // 雷克塞 Rek'Sai - 单体魔法
  TFT17_RekSai: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },

  // === 2-cost ===
  // 卑尔维斯 Bel'Veth - 12 击, 每击物理 + 魔法
  TFT17_Belveth: {
    components: [
      { variable: "ADDamage", damageType: "physical", adRatio: 1, hitCount: 12 },
      { variable: "APDamage", damageType: "magic", apRatio: 1, hitCount: 12 },
    ],
  },
  // 阿卡丽 Akali - 5 飞镖, 主目标全伤; 折扣计入第 2..5 -> 2.6 总段数
  TFT17_Akali: {
    components: [
      { variable: "DamageAD", damageType: "physical", adRatio: 1, hitCount: 2.6 },
      { variable: "DamageAP", damageType: "magic", apRatio: 1, hitCount: 5 },
    ],
  },
  // 金克丝 Jinx - 16 火箭单目标全估
  TFT17_Jinx: {
    components: [
      { variable: "ADDamage", damageType: "physical", adRatio: 1, hitCount: 16 },
      { variable: "APDamage", damageType: "magic", apRatio: 1, hitCount: 16 },
    ],
  },
  // 纳尔 Gnar - 飞镖反复, 物理 + 魔法
  TFT17_Gnar: {
    components: [
      { variable: "DamageAD", damageType: "physical", adRatio: 1 },
      { variable: "DamageAP", damageType: "magic", apRatio: 1 },
    ],
  },
  // 派克 Pyke - 长矛物理 (AoE 不计入打桩)
  TFT17_Pyke: {
    components: [{ variable: "SpearDamage", damageType: "physical", adRatio: 1 }],
  },
  // 古拉加斯 Gragas - 范围魔法
  TFT17_Gragas: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 格温 Gwen - 单体魔法
  TFT17_Gwen: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 小木灵 IvernMinion - 单体魔法
  TFT17_IvernMinion: {
    components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }],
  },
  // 莫德凯撒 Mordekaiser - 多次小段伤害 (每 proc), 5x 累加估
  TFT17_Mordekaiser: {
    components: [{ variable: "DamagePerProc", damageType: "magic", apRatio: 1, hitCount: 5 }],
  },
  // 米利欧 Milio - 主伤害 + 弹射
  TFT17_Milio: {
    components: [
      { variable: "Damage", damageType: "magic", apRatio: 1 },
      { variable: "BounceDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 佐伊 Zoe - 单体魔法（含弹道）
  TFT17_Zoe: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 潘森 Pantheon - 锥形真实 DPS × 4s (Duration)
  TFT17_Pantheon: {
    components: [{ variable: "TrueDamagePerSecond", damageType: "true", hitCount: 4 }],
  },

  // === 3-cost ===
  // 阿萝拉 Aurora - 范围魔法 + 分摊伤害（单目标只计 Damage）
  TFT17_Aurora: {
    components: [{ variable: "Damage", damageType: "magic", apRatio: 2.5 }],
  },
  // 俄洛伊 Illaoi - 落锤魔法
  TFT17_Illaoi: {
    components: [{ variable: "Damage", damageType: "magic", apRatio: 1.5 }],
  },
  // 菲兹 Fizz - 冲撞 + 啃咬两段魔法
  TFT17_Fizz: {
    components: [
      { variable: "DashDamage", damageType: "magic", apRatio: 1 },
      { variable: "BiteDamageAP", damageType: "magic", apRatio: 1 },
    ],
  },
  // 茂凯 Maokai - 范围魔法
  TFT17_Maokai: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 卡莎 Kai'Sa - 物理 + 魔法
  TFT17_Kaisa: {
    components: [
      { variable: "ADDamage", damageType: "physical", adRatio: 1 },
      { variable: "APDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 厄加特 Urgot - 霰弹物理
  TFT17_Urgot: {
    components: [{ variable: "ShotgunDamage", damageType: "physical", adRatio: 1 }],
  },
  // 维克托 Viktor - 范围魔法
  TFT17_Viktor: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 莎弥拉 Samira - 被动 + 主动 (PassiveAD/AP)
  TFT17_Samira: {
    components: [
      { variable: "PassiveAD", damageType: "physical", adRatio: 1 },
      { variable: "PassiveAP", damageType: "magic", apRatio: 1 },
    ],
  },
  // 奥恩 Ornn - 范围魔法
  TFT17_Ornn: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 璐璐 Lulu - 范围魔法
  TFT17_Lulu: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 黛安娜 Diana - 锥形挥砍魔法
  TFT17_Diana: {
    components: [{ variable: "CleaveDamage", damageType: "magic", apRatio: 1 }],
  },
  // 拉亚斯特 Rhaast - 物理重击
  TFT17_Rhaast: {
    components: [{ variable: "Damage", damageType: "physical", adRatio: 1 }],
  },

  // === 4-cost ===
  // 库奇 Corki - 多发导弹物理 + 魔法
  TFT17_Corki: {
    components: [
      { variable: "MissileAD", damageType: "physical", adRatio: 1 },
      { variable: "MissileAP", damageType: "magic", apRatio: 1 },
    ],
  },
  // 拉莫斯 Rammus - 范围魔法 + 护甲缩放
  TFT17_Rammus: {
    components: [{ variable: "DamageAP", damageType: "magic", apRatio: 1 }],
  },
  // 千珏 Kindred - 范围物理 + 魔法
  TFT17_Kindred: {
    components: [
      { variable: "ADDamage", damageType: "physical", adRatio: 1 },
      { variable: "APDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 卡尔玛 Karma - 链式魔法
  TFT17_Karma: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 易 MasterYi - 闪击物理 + 魔法 + 被动
  TFT17_MasterYi: {
    components: [
      { variable: "DamageAD", damageType: "physical", adRatio: 1 },
      { variable: "DamageAP", damageType: "magic", apRatio: 1 },
    ],
  },
  // 奥瑞利安·索尔 AurelionSol - 持续 DPS × 持续时间不确定，简化为单点
  TFT17_AurelionSol: {
    components: [{ variable: "DamagePerSecond", damageType: "magic", apRatio: 1 }],
  },
  // 娜美 Nami - 弹射魔法
  TFT17_Nami: { components: [{ variable: "Damage", damageType: "magic", apRatio: 1 }] },
  // 努努 Nunu - 初始 + 后续魔法
  TFT17_Nunu: {
    components: [{ variable: "InitialDamage", damageType: "magic", apRatio: 1 }],
  },
  // 锐雯 Riven - 双形态适应; 取物理路径
  TFT17_Riven: {
    components: [{ variable: "PassiveDamage", damageType: "physical", adRatio: 1 }],
  },
  // 乐芙兰 Leblanc - 弹射魔法
  TFT17_Leblanc: {
    components: [{ variable: "BoltDamage", damageType: "magic", apRatio: 1 }],
  },
  // 霞 Xayah - 多目标物理 + 魔法
  TFT17_Xayah: {
    components: [
      { variable: "ADDamage", damageType: "physical", adRatio: 1 },
      { variable: "APDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 塔姆 TahmKench - 单体魔法 + 血量缩放
  TFT17_TahmKench: {
    components: [{ variable: "DamageAP", damageType: "magic", apRatio: 1 }],
  },

  // === 5-cost ===
  // 巴德 Bard - 4 秒持续 DPS, 估全程
  TFT17_Bard: {
    components: [{ variable: "DamagePerSecond", damageType: "magic", apRatio: 1, hitCount: 4 }],
  },
  // 菲奥娜 Fiora - 真伤
  TFT17_Fiora: {
    components: [{ variable: "VitalDamage", damageType: "true", adRatio: 1 }],
  },
  // 烬 Jhin - 多发物理 + 魔法
  TFT17_Jhin: {
    components: [
      { variable: "ADDamage", damageType: "physical", adRatio: 1 },
      { variable: "APDamage", damageType: "magic", apRatio: 1 },
    ],
  },
  // 布里茨 Blitzcrank - 多发闪电
  TFT17_Blitzcrank: {
    components: [{ variable: "BoltDamage", damageType: "magic", apRatio: 1 }],
  },
  // 娑娜 Sona - 范围魔法
  TFT17_Sona: {
    components: [{ variable: "DebrisDamage", damageType: "magic", apRatio: 1 }],
  },
  // 薇古丝 Vex - 主动 3 段强化打击, 用 ShadowHandMagicDamage (不是 passive 的 ShadowHandDamage)
  TFT17_Vex: {
    components: [
      { variable: "ShadowHandMagicDamage", damageType: "magic", apRatio: 1, hitCount: 3 },
    ],
  },
  // 格雷福斯 Graves - 散弹物理
  TFT17_Graves: {
    components: [{ variable: "Damage", damageType: "physical", adRatio: 1 }],
  },

  // === Skipped (no damage var / utility-only) ===
  // TFT17_MissFortune - 模式选择
  // TFT17_Poppy      - 仅赋抗性
  // TFT17_Galio      - 仅减伤 buff
  // TFT17_Jax        - 形态切换
  // TFT17_Shen       - 普攻附伤 (engine 暂未支持普攻 buff)
  // TFT17_Zed        - HP 代价被动
  // TFT17_Morgana    - 治疗
};

export function getAbilityCastSpec(apiName: string): AbilityCastSpec | undefined {
  return ABILITY_CAST_SPEC[apiName];
}
