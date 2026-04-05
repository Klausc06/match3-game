# Match-3 Game Changelog

此文件用于记录每次任务完成后的修改内容，便于追踪版本与日后优化。

## [2026-04-06] 程序化关卡生成 + 项目清理 (Procedural Gen & Cleanup)

### 程序化关卡生成器

- 新增 `js/config/LevelGenerator.js`：基于规则的程序化关卡生成器，替代静态 `TestLevels.js`。
- 支持 `home`（四象限对称）和 `garden`（左右镜像）两种生成规则。
- 特性：可配置密度目标（~45-50%）、加权障碍物选择、BFS 簇状放置、线性簇（溪流）、多模式对称。
- `main.js` 中 Demo 按钮改为调用 `generateLevel()` 动态生成。

### UI 图例面板

- 图例改为使用 `<img>` 标签引用 `assets/tiles/` 中的实际 PNG 贴图，与游戏 Canvas 渲染完全一致。
- 移除未实现的彩虹球图例项。
- 地毯/溪流使用 CSS 色块模拟（与 `Renderer.js` 中 Canvas 渲染效果一致）。

### 项目清理

- 删除 `js/config/TestLevels.js`（被 `LevelGenerator.js` 替代，无任何引用）。
- 删除 `tests/_screenshots/`（旧浏览器自动化截图，已过时）。
- 删除 `docs/CHANGELOG.md`（与根目录 `CHANGELOG.md` 重复且内容更旧）。
- 删除 `css/game.css` 中残留的 `.legend-rainbow-block` 样式。

### 规则文档更新

- `SKILL.md`：修复全部 markdown lint 警告（空行、代码块语言、表格间距）。
- `SKILL.md`：新增「素材一致性规则」— 图例/文档必须使用游戏实际 PNG 贴图，禁止 emoji 替代。
- `SKILL.md`：文件树同步至项目实际结构（新增 board/ 子模块、config/、AssetLoader 等）。
- `SKILL.md`：CHANGELOG 路径引用从 `docs/CHANGELOG.md` 更正为根目录 `CHANGELOG.md`。

## [2026-04-05] 全量优化收敛 (Architecture + Determinism + Level Validation)

### 架构与边界

- `GameLoop` 增加统一动画阶段执行方法 `_playAnimationStep`，减少重复等待逻辑。
- `GameLoop` 移除主题硬编码分支，回合末统一调用 `Board.runEndTurnRules()`。
- `Board` 新增规则接口：`setRuleSet`、`runEndTurnRules`。

### 可复现随机

- 新增 `js/core/Random.js`（xorshift32）。
- `Board` 支持 `setRandomSeed(seed)`、`random()`、`randomInt()`、`shuffleArrayInPlace()`。
- `Tile.random` 改为支持注入随机函数，`matching/grid/obstacles` 不再直接使用 `Math.random`。
- `main.js` 支持 URL 参数 `?seed=<number>` 进行确定性开局重放。

### 异形棋盘（mask）支持

- `Board` 新增 `maskGrid` 与 `isPlayableCell(r,c)`。
- 支持关卡配置字段：`mask`、`playableCells`、`voidCells`。
- `matching/grid/destruction/obstacles/renderer` 统一跳过不可玩格，避免 void 被下落或补充逻辑覆盖。

### 质量与测试

- 新增离线关卡可解性验证：`tools/validate-level-solvability.mjs`。
- 新增单测：
  - `tests/unit/seeded-board.test.mjs`
  - `tests/unit/board-mask.test.mjs`
- `package.json` 新增脚本：
  - `npm run validate:levels`
  - `npm run test:all` 现包含 `prompt:check + validate:levels + test`

### 契约与提示词同步

- `docs/contracts/game-contract.v1.json` 升级到 `1.1.0`，加入 Board 新公共 API 与 level 规则契约。
- 同步更新：
  - `docs/api-reference.md`
  - `docs/architecture.md`（ADR-015/ADR-016）
  - `.agents/skills/architecture/SKILL.md`
  - `.agents/skills/project-rules/SKILL.md`
  - `.agents/workflows/test-module.md`
  - `tools/validate-contract.mjs`

## [2026-04-05] 提示词体系优化 (Prompt System Optimization)

### 🧭 单一真源 (Single Source of Truth)

- 新增 `docs/contracts/game-contract.v1.json` 作为事件/API/生命周期契约唯一真源。
- `docs/api-reference.md` 改为派生视图，不再作为契约主定义。

### 🧱 提示词重构 (Constraint-First Prompts)

- 重写 `.agents/skills/architecture/SKILL.md` 为硬约束短版（MUST/MUST NOT + 失败门禁）。
- 重写 `.agents/skills/project-rules/SKILL.md` 为执行版，压缩冗长叙事并保留关键规则。
- 重写 `.agents/skills/canvas-renderer/SKILL.md`，统一使用 `GameConfig` 键引用动画时序，移除漂移风险描述。

### ✅ 机器可校验 (Machine-Checkable)

- 新增 `tools/validate-contract.mjs`：校验 `Events.js` 与契约一致性、检查关键 API 与提示词引用。
- `package.json` 新增：
  - `npm run prompt:check`
  - `npm run test:all`

### 🔒 工作流门禁 (Fail-Fast Workflow)

- 重写 `.agents/workflows/pre-step-check.md`：原子流程 + 失败即中止。
- 重写 `.agents/workflows/test-module.md`：断言优先，先自动化后手工冒烟。

## [2026-04-05] 稳定性优先架构重构 (Stability-First Refactor)

### 🏗️ 架构重构 (Architecture)

- **Board 拆分为规则子域**: 将原先超大 `Board.js` 拆分为 `js/core/board/{matching,destruction,grid,obstacles}.js` 四个子模块；`Board.js` 仅保留编排职责和对外 API。
- **GameLoop 会话化执行**: 新增 `startSession()/stopSession()` 与 `sessionId` 校验机制，异步流程在每个阶段都校验会话有效性，避免过期回调继续推进状态。
- **Renderer 公共动画接口**: 新增 `play*/clear*` 公共方法（swap/remove/drop/shake），`GameLoop` 不再直接读写 `Renderer` 的内部字段。
- **移除全局 UI 注入**: 删除 `window.uiManager` 依赖，改为 `UIManager.bindRenderer(renderer)` 进行局部注入。

### 🔧 行为修复 (Behavior Fixes)

- **Hint 事件契约统一**: `ui:hint` 统一为 `{ from, to, cells }`；支持用 `{ from:null, to:null, cells:[] }` 清理提示。
- **Hint 高亮坐标准确化**: UI 层按 `renderer.gridToPixel()` + canvas/overlay 偏移计算绝对定位，解决提示框无法对齐棋盘格的问题。
- **等待机制重写**: 重写 `GameLoop._waitFor()`，移除对 `animObj.startTs` 的隐式依赖，统一使用可取消定时器，并在 `stopSession()` 时立即收敛所有 pending Promise。
- **结束态防串写**: `GAME_OVER` 后会立刻终止会话，阻断匹配链、掉落、补充、纸飞机延时效果等后续变更。
- **私有方法越界修复**: 用 `Board.removeSingleCell()` 替代外部直接调用私有障碍命中逻辑。

### 🧪 测试与工程化 (Testing & DX)

- **新增 Node 单元/集成测试**:
  - `tests/unit/hint-payload.test.mjs`
  - `tests/unit/game-loop-session.test.mjs`
- **新增断言式 E2E 脚本**: `tests/browser-automation-assert.mjs`（替代仅日志观察模式）。
- **统一测试入口**: `package.json` 新增 `npm test` 与 `npm run test:e2e`。
- **验证结果**: 本次提交已通过 `npm test`（5/5）。

## [2026-04-04] Phase 1 核心机制与架构完善

### ✨ 新增功能与机制 (Mechanics)

- **异形棋盘预留**: `Board.fillEmpty()` 现在会跳过 `grid[r][c] === null` 的格子，为未来的不规则地图（如带有镂空区域）提供底层支持。
- **匹配形状与道具生成 (Group Matching)**: 重写了 `Board.findMatches()` 为两阶段：先提取线性匹配，再按交集聚合成 `MatchGroup`。现在能够准确识别 4连销(Rocket)、5层十字/L形(Bomb)、以及 5连直线(Rainbow Ball)，并在消除时自动将普通图块替换为道具图块。
- **道具互换检测 (Power-Up Swap)**: 在 `Board.js` 中新增了 `checkPowerUpInteraction` 方法，并修改 `GameLoop.js` 的 `_handleSwap` 使得：只要发生了涉及道具的交换（无论是与普通方块还是另一道具），都不会被判定为“无效交换”，从而支持道具直接起效。
- **发呆提示系统 (Hint System)**: 在 `GameLoop.js` 初始化了空闲计时器。在 `IDLE` 状态下无玩家输入达 3 秒后，调用新增的 `Board.findPossibleMoves()` 获取建议并抛出 `ui:hint` 事件。
- **Node 黑盒测试**: 引入了孤立测试文件 `tests/test-board-3.js`，无视 Canvas 与渲染环境，以纯数据结构和 Node.js 成功验证复杂的匹配分组逻辑。

### 🚨 已知问题与待办 (Pending Issues)

- `_processMatches` 目前遇到 `powerUpTrigger` 仅发出对应的事件，并未从盘面移除被炸毁的关联图块，完整的“道具爆炸波及算法”（如 Bomb 消除 2x2 或 Rainbow 消除同色）将在 Phase 2 “具体道具系统” 中详细展开。
- 原版的道具合成时，新道具应向玩家滑动的目的地偏移，虽然在 `spawnPoint` 逻辑里加入了基于 `lastSwap` 的推断，但在极其复杂的连锁反应下，生成点暂时会默认取匹配集合的第 0 个或交叉点。

---

## [2026-04-04] Phase 2 道具爆炸系统 (Power-Ups Implementation)

### ✨ 新增功能与机制 (Mechanics)

- **基类与抽象工厂**: 创建了 `PowerUp.js` 基类与 `PowerUpFactory.js`，通过工厂模式按类型字符串动态实例化并计算受害影响范围（`getAffectedCells`）。
- **具体道具逻辑满配**: 
  - `Bomb.js`：真正的半径 2 圆形爆炸扩散范围（Chebyshev 距离去四角）。
  - `Rocket.js` / `Firecracker.js`：灵活配置朝向（行/列/十字爆炸）。
  - `RainbowBall.js`：同色全屏清除逻辑验证。
- **连环爆炸与级联摧毁 (Chain Detonations)**: 深度重写了 `Board.processDestruction`，全面处理所有引发的破坏：
  - 支持 **递归破坏**：Rocket 若经过了 Bomb，Bomb 会被波及，Bomb 若波及了别的 Rocket 也将引发链式大爆炸。底层采用了 While(queueChanged) 检测循环完美解决。
- **孤立黑盒节点测试**: 跑通了 `tests/test-powerups.js`，验证了 1 个 Bomb 波及了 1 个 Rocket 后，以极高效率抹除了 5x5 测试盘面整整 21 块砖，连环爆炸逻辑完美。

### 🚨 已知问题与待办 (Pending Issues)

- 虽然引擎和数据层已经能实现并反馈各种连环爆炸，但 UI 动画层（`Renderer.js`）暂定仅接收 `board:removed` 等事件并做简单的清空。为了原味，这里日后需要加极大规模的粒子抛射、画面缩放震动、和特效 Sprite。

---

## [2026-04-04] Phase 3 环境与障碍物系统 (Obstacles)

### ✨ 新增功能与机制 (Mechanics)

- **底层障碍物生命周期 (HP & Armor)**: 利用组合优于继承的设计方案，在原图块附加了 `.obstacle` 属性，实现了 `Ice` (可穿透冰块) 与 `Chain` (阻断锁链)。相邻消除或遭受爆炸波及会使其 HP-1，彻底击碎后释放底部普通图块。
- **动态衍生型障碍物 (Suds)**: 实现了会繁殖的泡沫系统！加入 `sudsDestroyedThisTurn` 计数器。若在一次由玩家触发的整个回合（包含多重连消和瀑布掉落）中，**完全没有成功清扫到任何泡沫**，回合归于 `IDLE` 时，将会触发泡沫随机吞噬旁边 1 个正常图块进行增生繁殖。
- **环境背景属性 (Carpet)**: 将 `carpetGrid` 从实体图块中剥离为二维布尔地形数组，确保地毯不会随图块“掉落”。当任何携带地毯的格子在匹配消除中被消去时，地毯属性会顺理成章地延展到该组合的其余图块坐标上！
- **实体障碍结构校验**: 使用 `Box` (箱子) 测试了完全阻断掉落的实体逻辑。孤立测试脚本 `tests/test-obstacles.js` 完美无误地输出。

### 🚨 已知问题与待办 (Pending Issues)

- 现已彻底完成《梦幻家园》级别的复杂数据流交互。目前的断层在于，游戏逻辑只能在控制台打印字符来查看，UI层面仍在呈现之前极其粗糙的纯色Emoji。下阶段的渲染焕新极其紧迫！

---

## [2026-04-04] Phase 5 架构优化 (Architecture Optimization)

### 🏗️ 架构重构 (Architecture)

- **[Critical] 消灭 EventBus.clear() 反模式**: 删除 `EventBus.clear()` + `rebindAllEvents()` 全局清空重绑策略。所有事件监听改为只在模块 constructor 中注册一次，生命周期与页面等同。游戏重玩只需调用各模块 `reset()` 方法。
- **新增 `js/config/GameConfig.js`**: 集中管理所有 magic number（棋盘尺寸、计时、计分规则、动画时长、Hint 延迟、Shuffle 安全阀、初始关卡配置）。
- **新增 `js/config/Events.js`**: 以 `E` 常量对象统一导出所有 EventBus 事件名（30+ 个），彻底杜绝拼写错误和命名不一致（如之前的 `score:add` vs `score:updated` bug）。
- **新增 `js/ui/UIManager.js`**: 将 main.js 中 200+ 行的 DOM 操作、屏幕路由、HUD 更新、Combo 浮动文字、排行榜渲染等全部迁移。main.js 从 334 行精简至 ~120 行纯组装器角色。

### 🔧 Bug 修复 (Bug Fixes)

- **[Major] 双重事件注册**: `rebindAllEvents()` 导致 `timer:expired → endGame()` 在首次 startGame 后与初始 `EventBus.on` 共存，连续两局会触发两次 `endGame()`。根因已随反模式消灭而彻底解决。
- **[Major] shuffle() 无限递归**: 原实现在不满足条件时递归调用自身，若颜色数太少或障碍物过多会导致栈溢出。改为 for 循环 + `MAX_SHUFFLE_ATTEMPTS` 安全阀。
- **[Minor] expandSuds() 分布偏差**: `Array.sort(Math.random)` 不保证均匀随机分布。改为 Fisher-Yates 洗牌算法。
- **[Minor] `_clearMatchFlags` 封装违背**: `GameLoop` 直接调用 `Board._clearMatchFlags()`（私有方法）。改为公开方法 `clearMatchFlags()`。

### 🧹 代码质量 (Code Quality)

- 全部 10 个 JS 文件完成 Events 常量迁移（零残留字符串事件名）。
- Board.js / ScoreManager.js / TimerManager.js 计分/计时常量统一从 GameConfig 读取。
- 文件头 JSDoc 注释统一格式：职责描述 + 公开方法清单。
- StateMachine / Leaderboard 同步使用 Events 常量。

---

## [2026-04-04] Phase 4 代码审计与渲染器重构 (Codebase Audit & Renderer Overhaul)

### ✨ 新增功能与机制 (Mechanics)

- **AssetLoader 预加载系统**: 新建 `js/core/AssetLoader.js`，通过 Promise 管线批量加载 8 张 AI 生成的高清 PNG 贴图（叶子、苹果、梨、水滴、花朵、炸弹、火箭、冰块），启动按钮显示实时加载进度。
- **Canvas Image 渲染引擎**: 彻底重写 `Renderer._drawTile()`，使用 `ctx.drawImage()` + `globalCompositeOperation = 'multiply'` 混合模式，在不需要抠图的前提下过滤白色背景，实现透明融合效果。
- **障碍物视觉升级**: Ice 使用真实冰块贴图覆盖；Box 保留木纹渐变手绘风格；Carpet 以半透明绿色地垫渲染在棋盘背景层。
- **道具视觉区分**: 道具图块使用对应 AI 贴图 + 金色发光环边框区分于普通图块。

### 🔧 Bug 修复 (Bug Fixes)

- **[Critical] Timer NaN:NaN**: `TimerManager.start()` 直接调用 `_tick()` 不传参数，导致 `_lastTimestamp = undefined`，后续帧 `deltaMs = timestamp - undefined = NaN`。修复：改用 `requestAnimationFrame()` 发起首帧。
- **[Critical] Score 永远为 0**: `ScoreManager` 发射 `score:add` 事件，但 `main.js` 监听 `score:updated`，事件名不匹配导致 UI 永远收不到计分。修复：统一为 `score:updated` 并规范 payload 为 `{ score, added, combo }`。
- **[Major] dropTiles 障碍物穿透**: `writePos` 遇到不可移动障碍物时未重置为 `r - 1`，导致上方图块可能"穿过"箱子/泡沫下落。修复：遇到 immovable obstacle 时 `writePos = r - 1`。

### 🧹 清理与优化 (Cleanup)

- 删除 `test-step1.html` ~ `test-step4.html` 4 个过期测试页面。
- 删除 `docs/backups_phase1/` 整个旧版备份目录。
- 规范化 `assets/tiles/` 文件命名（去除时间戳后缀）。

---

## [未发布]

- 初始创建任务日志文件
