# TFT DPS 模拟器

英雄联盟云顶之弈（TFT）单英雄 DPS 模拟器桌面客户端。计算一个英雄（含技能施放循环）对可配置目标假人的有效 DPS。

当前阶段：**数据层 + 计算引擎框架**（UI 下一期）。

## 架构

- **引擎 + 数据层**：TypeScript（`src/data`、`src/engine`）。纯函数、可单测、数据驱动。
- **桌面壳**：Tauri v2（`src-tauri`）。Rust 仅负责拉取 cdragon JSON + 本地缓存，返回原始 JSON，归一化在 TS 完成。

### 核心设计

- **三层物品/技能模型**：cdragon `effects` 只给扁平属性修正，不编码 on-hit/技能段数。因此通用属性走修正管线，行为效果（飓风/静电/泰坦/技能施法规格）走手写覆盖层 `item-effects.ts` / `ability-effects.ts`，赛季常量集中在 `engine/tuning.ts`。
- **四阶段属性修正管线**：`add → percent-add → percent-mul → override`，每 stat 按阶段分组施加，最后钳制（攻速上限、暴击率≤1）。
- **DPS = 普攻 DPS + 技能 DPS**：普攻含 on-hit；技能 = 单次伤害 × 每秒施放次数（蓝量经济驱动）。

## 目录

```
src/data/        归一化数据模型、cdragon 拉取/归一化、手写覆盖层
src/engine/      属性修正、目标减免、普攻/技能 DPS、tuning 常量
src/__tests__/   vitest 黄金用例
src-tauri/       Tauri 桌面壳（Rust fetch + 缓存）
```

## 开发

```bash
npm install
npm test          # 跑单测
npm run typecheck # 类型检查
npm run dev       # Vite 开发（http://localhost:5173）
npm run tauri dev # 桌面壳（首次需 Rust 工具链 + 几分钟编译）
```

### 数据来源

`tft.json` 放在仓库根目录（可手动从 [CommunityDragon](https://raw.communitydragon.org/latest/cdragon/tft/zh_cn/tft.json) 下载更新）。Vite 把它当作静态资源从 `public/tft.json` 提供给前端，桌面壳同样通过相对 URL 加载——所以 Web/Desktop 用同一条加载路径，IPC 不被卷入大对象传输。

Rust 端（`src-tauri/`）保留了 `load_or_fetch_tft` / `refresh_tft` 命令，用于将来的"运行时拉取最新 Set"功能；当前未在启动时调用。

### Rust 工具链备注

- 在 Windows + MinGW GNU 工具链下需要 `crate-type = ["rlib"]`（已配置）。MSVC 工具链无此限制。
- `.cargo/config.toml` 强制使用 tuna sparse 索引，规避全局 Git 镜像配置的慢同步问题。

## 待办

- 拿真实 cdragon `tft.json` 核对 `tuning.ts` / 覆盖层中所有标 `[ASSUMPTION]` 的常量与 apiName。
- UI（选英雄/装备/羁绊/目标，展示 `DpsBreakdown`）。
- on-hit 伤害类型拆分进 `detail`（目前 onHit 计入 physical）。
