# Match-3 Game Changelog

此文件用于记录每次任务完成后的修改内容，便于追踪版本与日后优化。

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
## [2026-04-04] Phase 6 多主题引擎与极客打磨 (Multi-Theme & Polish)

### ✨ 新增功能与机制 (Mechanics)
- **双主题架构 (Multi-Theme Engine)**: 实现了基础逻辑与主题数据的彻底解耦。支持按主题动态加载资产 (`AssetLoader.js`)，并根据 `GameConfig` 实时调整棋盘风格、道具类型及障碍物逻辑。
- **家园专属：纸飞机 (Paper Plane)**:
  - **2x2 正方形识别**: `Board.findMatches` 扩展支持方形匹配检测。
  - **智能寻敌制导**: `PaperPlane.js` 提供策略算法，优先攻击：障碍物 > 未铺地毯格 > 随机格。
  - **高级飞行动画**: `Renderer.js` 引入了基于三次贝塞尔曲线的飞行路径，支持动态旋转、白色粒子尾迹以及与数据层的完美同步。
- **差异化障碍物逻辑完善**:
  *   **花园 (Gardenscapes)**: 木箱、锁链、**蜂蜜 (Honey)** (具备回合制自动扩张逻辑)。
  *   **家园 (Homescapes)**: 花瓶 (Vase, 具备多级 HP)、泡沫 (Suds, 具备自动扩张逻辑)、**地毯 (Carpet)** (随消除行为蔓延的地形系统)。
- **道具映射系统**: 通过 `themeConfig` 实现 4连消道具的动态映射（花园: Firecracker / 家园: Rocket）。

### 🏗️ 架构与优化 (Architecture & Optimization)
- **资源目录化加载**: `AssetLoader` 支持多层级目录结构，显著提升了多主题资产管理的规范性。
- **Renderer 统一接口**: 引入 `_drawSolidObstacle` 方法，统一了多种格点障碍物的渲染管线。
- **GameLoop 状态机同步**: 优化了 `REMOVE_ANIM` 阶段，通过回调机制确保物理消除发生在动画撞击瞬间。

### 🔧 Bug 修复 (Bug Fixes)
- **[Major] 激活逻辑缺失**: 修复了手动交换/点击纸飞机时，因元数据未传递导致飞机“原地蒸发”且无后续飞行效果的 Bug。
- **[Minor] 粒子渲染可见性**: 修正了 `Renderer` 中粒子 fillStyle 缺失导致的动画不可见问题。
- **[Minor] 道具覆盖渲染**: 修复了某些障碍物（如 Honey）没有正确触发 `_drawSolidObstacle` 导致显示为普通方块的渲染偏差。

---
## [2026-04-04] Phase 7 视觉呈现强化 (Visual Polish & Effects)

### ✨ 新增特效 (VFX)
- **粒子系统 (Particle System)**:
  - 引入了轻量级双层粒子发生模块（物理层+渲染层），支持重力、摩擦力及旋转插值。
  - **基于主题的微颗粒设计**：花园主题采用飘落的叶片/花瓣（低重力）；家园主题采用几何闪烁碎片。
  - **颜色采集技术**：消除时动态提取图块定义的 `name`，转换为对应的 HEX 色值注入到消除粒子中，保证消除动画颜色严格贴合环境。
- **动态画面演出 (Screen Shake)**: 实现了与粒子绑定的屏幕震动效果。
  - 小型连消及障碍物打击触发轻微震动。
  - Bomb 和 5连全屏炸弹等触发大型震动爆发 (`shakeAmount: 12-15`)。

### 🏗️ 架构与优化 (Architecture & Optimization)
- **EventBus 挂载**: 深度重构 `Renderer.js` 的 `_bindEvents` 方法，实时侦听 `E.BOARD_REMOVED`, `E.POWERUP_ACTIVATED`, `E.OBSTACLE_HIT` 等数据层事件，无缝连接物理状态与前端特效。
- **解耦设计**: `Board.js` 在爆炸时不再需要调用繁杂的前端代码，而是静默发送涵盖坐标（r, c）、产生原因（type）的 `POWERUP_ACTIVATED` 信号，确保引擎整洁度。

---
## [未发布]

- 初始创建任务日志文件
