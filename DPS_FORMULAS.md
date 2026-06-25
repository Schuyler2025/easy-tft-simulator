# TFT DPS 模拟器计算公式

本文记录当前引擎涉及到的主要计算公式。对应源码主要位于：

- `src/engine/modifier.ts`：有效属性计算
- `src/engine/target.ts`：目标减伤
- `src/engine/autoAttack.ts`：普攻与 on-hit DPS
- `src/engine/spell.ts`：技能伤害与施法频率
- `src/engine/timeline.ts`：DPS 时间曲线模拟
- `src/engine/tuning.ts`：常量配置

---

## 1. 有效属性

每个属性独立解算，按 4 阶段流水线：

```text
S₀ = baseStats[星级]                                      ← 来自 cdragon
S₁ = S₀ + Σ(add modifiers)                                ← 第 1 阶段：加法
S₂ = S₁ × (1 + Σ percent-add)                             ← 第 2 阶段：百分比相加
S₃ = S₂ × Π(1 + percent-mul_i)                            ← 第 3 阶段：百分比相乘
S₄ = override 中最后一个值（若有）                          ← 第 4 阶段：覆盖
```

### 星级缩放

基础 AD 和 HP 按星级倍率缩放：

```text
AD★ = AD₁★ × m★
HP★ = HP₁★ × m★

m = { 1★: 1, 2★: 1.8, 3★: 3.24 }
```

攻速不随星级缩放。技能变量直接使用 cdragon 中对应星级的数值。

### 后置裁剪

```text
AS = min(AS, AS_base × 2.5, 5.0)
critChance ∈ [0, 1]
critMultiplier ≥ 1.4
```

### 暴击期望系数

```text
E_crit = 1 + critChance × (critMultiplier - 1)
```

默认暴击率 0.25、暴击倍率 1.4 时：

```text
E_crit = 1 + 0.25 × (1.4 - 1) = 1.10
```

---

## 2. 目标减伤

物理伤害使用护甲，魔法伤害使用魔抗，真实伤害不减免。

```text
M_phys  = K / (K + armor_eff)
M_magic = K / (K + MR_eff)
M_true  = 1
```

其中：

```text
K = 100
armor_eff = armor - flatReductionPhysical
MR_eff    = magicResist - flatReductionMagic
```

负抗性会让乘区大于 1，从而放大伤害。

---

## 3. 普攻 DPS

### 普攻主体 DPS

```text
DPS_auto = AD × E_crit × M_phys × AS
```

其中：

- `AD`：有效攻击力
- `E_crit`：暴击期望系数
- `M_phys`：物理减伤乘区
- `AS`：有效攻速，单位为 attacks/sec

### on-hit 每秒伤害

每个 on-hit 效果独立计算后求和。

触发频率：

```text
every-attack       → procsPerAttack = 1
every-nth-attack n → procsPerAttack = 1 / n
stacking           → 0，属性已计入 effectiveStats
on-cast            → 0，由技能链处理
```

单次触发伤害：

```text
D_proc = (base + adRatio × AD + apRatio × AP) × M_damageType
```

每秒伤害：

```text
DPS_onHit = Σ(D_proc × procsPerAttack × AS)
```

---

## 4. 技能伤害

## 4.1 每次施法伤害

curated 英雄使用 `castSpec.components`：

```text
D_cast = Σ hitCount_c × [
  (V_c + flatBase_c)
  + adRatio_c × AD
  + apRatio_c × AP
] × M_damageType_c
```

其中：

- `V_c`：技能变量在当前星级的值
- `hitCount_c`：段数，默认 1
- `damageType_c`：physical / magic / true

未 curated 的英雄退化为：

```text
D_cast = 最大技能变量值 × M_magic
```

并标记：

```text
abilityUncurated = 1
```

---

## 4.2 施法频率

### A. 蓝量驱动模式

绝大多数英雄使用蓝量驱动：

```text
mana/s = AS × manaPerAttack + incomingDps × manaPerPremitDamageTaken
```

当前常量：

```text
manaPerAttack = 10
manaPerPremitDamageTaken = 0.01
```

施法频率：

```text
casts/s = mana/s / castCost
```

### B. proc-per-attack 模式

用于凯特琳这类零蓝被动触发技能：

```text
casts/s = procChance × AS
```

例如凯特琳：

```text
procChance = 15% = 0.15
casts/s = 0.15 × AS
```

---

## 4.3 技能 DPS

```text
DPS_spell = D_cast × casts/s
```

---

## 5. 总 DPS

```text
DPS_total = DPS_auto + DPS_onHit + DPS_spell
```

即：

```text
DPS_total = 普攻主体 DPS + 装备/效果 on-hit DPS + 技能 DPS
```

---

## 6. DPS 时间曲线

时间曲线使用离散模拟，当前步长：

```text
dt = 0.05s
```

初始化：

```text
t = 0
mana = stats.mana          ← 起始蓝
attackCooldown = 1 / AS
cumulative = 0
```

每个 tick：

```text
attackCooldown -= dt

while attackCooldown ≤ 0:
    cumulative += D_auto_per_hit
    cumulative += D_onHit_every_attack
    cumulative += Σ D_onHit_every_nth_attack

    if proc-per-attack:
        cumulative += procChance × D_cast

    if castCost is finite:
        mana += manaPerAttack

    attackCooldown += 1 / AS

if castCost is finite:
    mana += incomingDps × manaPerPremitDamageTaken × dt

if mana ≥ castCost:
    cumulative += D_cast
    mana -= castCost          ← 溢出蓝量保留
```

### 每次普攻伤害

```text
D_auto_per_hit = AD × E_crit × M_phys
```

### 平均 DPS 曲线

```text
DPS_avg(t) = cumulative(t) / t
```

### 1 秒窗口瞬时 DPS

```text
DPS_window(t) = [cumulative(t) - cumulative(t - 1s)] / 1s
```

当前默认图表展示的是累计平均 DPS 曲线。

---

## 7. A/B 装备方案对比

A/B 对比不会改变公式，只是对两套装备分别跑同一套流程。

```text
stats_A     = computeEffectiveStats(champion, items_A, traits, target)
breakdown_A = computeDps(stats_A)
timeline_A  = simulateTimeline(stats_A)

stats_B     = computeEffectiveStats(champion, items_B, traits, target)
breakdown_B = computeDps(stats_B)
timeline_B  = simulateTimeline(stats_B)
```

对比差值：

```text
delta = DPS_B - DPS_A
percentDelta = delta / DPS_A × 100%
```

图表颜色固定绑定 loadout：

```text
方案 A：金色累计伤害区域 + 蓝色平均 DPS 虚线
方案 B：青色累计伤害线 + 品红平均 DPS 虚线
```

切换 active loadout 只影响属性表、DPS 拆分、技能详情展示，不改变图表颜色。

---

## 8. 关键常量

| 常量 | 值 | 说明 |
|---|---:|---|
| `armorK` | 100 | 护甲/魔抗减伤公式常数 |
| `attackSpeedCap` | 5.0 | 攻速硬上限 |
| `attackSpeedMultiplierCap` | 2.5 | 有效攻速不得超过基础攻速的 2.5 倍 |
| `baseCritChance` | 0.25 | Set 17 基础暴击率，已核对 |
| `baseCritMultiplier` | 1.4 | Set 17 基础暴击倍率，已核对 |
| `manaPerAttack` | 10 | 每次普攻获得蓝量 |
| `manaPerPremitDamageTaken` | 0.01 | 每点承受的未减免伤害获得蓝量 |
| `starMultipliers.star1` | 1 | 1★ AD/HP 倍率 |
| `starMultipliers.star2` | 1.8 | 2★ AD/HP 倍率 |
| `starMultipliers.star3` | 3.24 | 3★ AD/HP 倍率 |

---

## 9. 当前模型简化

1. 暴击使用期望值，不进行随机采样。
2. on-hit 副目标按主目标同样减伤计算，不建模多个目标。
3. 攻速上限 5.0 和 2.5 倍基础攻速属于当前假设值。
4. 起始蓝只在时间曲线模拟中体现；稳态 DPS 公式按长期均摊计算。
5. stacking 类效果按满层后的属性处理，不模拟爬坡过程。
6. 部分斩杀、血量阈值、随时间 ramp 的 buff 尚未完整建模。
7. 未 curated 技能使用最大变量作为魔法伤害估算，准确性低于手写 castSpec。
