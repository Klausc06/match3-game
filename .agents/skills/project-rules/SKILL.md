---
name: match3-project-rules
description: 核心项目规则与决策记录。在开始编写任何代码模块之前必须加载并遵守此文件。
---

# 🎮 Match-3 限时竞技游戏 — 项目规则与系统级提示词

> 📋 单一真源：`docs/contracts/game-contract.v1.json`

**在开始任何编码任务之前，必须先阅读此文件和 `docs/api-reference.md`。**

---

## 一、已确认的设计决策（不可更改，除非用户明确要求）

### 1.1 游戏模式
- **模式**：限时挑战赛，每局 **90 秒**（1分30秒）
- **无步数限制**，玩家在时间内尽可能多消除
- **计分规则**：
  - 基础 3 消：+100 分
  - 4 消（生成道具）：+200 分
  - 5 消及以上：+300~500 分
  - 连锁消除（cascade）：每层 ×1.5 倍乘数
  - 消除障碍物：+150 分/个
  - 道具引爆单格：+50 分/个

### 1.2 图块颜色
- **只使用 5 种颜色**（不是 6 种），在 9×9 棋盘上匹配机会更多，节奏更快

### 1.3 两个关卡（主题独立，机制各有差异）

#### 花园关卡（Gardenscapes 风格）
**道具**（生成型）：
1. Firecracker（鞭炮）- 4消生成，清除十字小范围
2. Bomb（炸弹）- 5消生成，清除半径2范围
3. TNT（TNT桶）- 7+消生成，清除半径4范围

**障碍物**（关卡内置）：
1. Ice（冰块）- 格子带冰层属性，相邻消除-1层
2. Box（箱子）- 静止障碍，旁边消除一次销毁
3. Chain（链子）- 锁住图块不能被选中，旁边消除解锁

#### 家园关卡（Homescapes 风格）
**道具**（生成型）：
1. Paper Airplane（纸飞机）- 2×2正方形消除生成，消除十字格后飞至随机目标消除
2. Rocket（火箭）- 4连消生成，竖直匹配→水平火箭，横向匹配→垂直火箭
3. Bomb（炸弹）- 5+非一线消除生成，横向3×5 + 纵向5×3 十字形范围
4. Rainbow Ball（彩虹球）- 横向5连消生成，消除场上所有同色图块

**障碍物**（关卡内置）：
1. Carpet（地毯）- 通常为关卡目标，与地毯上图块匹配即可铺开
2. Chain（锁链）- 无法移动，可以匹配，一次消除解锁
3. Jelly（果冻）- 无法移动，不可匹配，旁边消除/道具可破坏
4. Box（箱子）- 无法移动，无法匹配，旁边消除一次销毁
5. Grass（草地）- 无法移动，无法匹配，旁边消除一次销毁

### 1.4 视觉与系统原则（MVP 阶段开发侧重点）
- **核心目标**: 这是一个基于机制（Mechanics）的 Demo。首要任务是**实现完整可玩的关卡逻辑**（原版道具互换、障碍物消除、异形棋盘适配）。
- **画面与动效暂缓**: 使用基础的高清贴图即可，**所有复杂的弹簧动画、光效粒子、精美背景留作日后优化**。但代码结构（特别是 `Renderer.js` 的解耦）必须为后续接入粒子系统和补间动画留好接口。
- **完全剔除音效**: 不关注音频表现，不使用 Web Audio API，只关注核心盘面逻辑的视觉呈现。
- **严格的状态同步**: 维持同步消除。**不允许空中滑动或异步重力掉落**，图块在下落、消除动画彻底播放完毕前，完全锁死玩家输入。
- **提示系统（Hint）**: 玩家停滞 3 秒未操作时，引擎须自动高亮/抖动一个可消除组合。
- 排行榜：`localStorage` 存储，花园/家园分开记录

---

## 二、架构原则（绝对不可违反）

### 2.1 模块通信：EventBus 唯一通道
```
❌ 禁止：boardInstance.score += 100;
✅ 正确：EventBus.emit('score:add', { amount: 100, reason: 'match3' });
```
所有跨模块通信必须通过 `js/core/EventBus.js` 的 `emit/on/off` 方法。

### 2.2 数据与渲染严格分离
```
Board.js     ← 只管棋盘数据数组，不知道 Canvas 存在
Renderer.js  ← 只管绘制，从 Board 读数据，不改数据
```

### 2.3 新功能扩展原则（开闭原则）
- 新障碍物 = 新建 `js/elements/XxxTile.js`（继承 `Tile.js`），不改旧文件
- 新道具 = 新建 `js/powerups/Xxx.js`（继承 `PowerUp.js`），不改旧文件
- 新关卡 = 新建 `levels/xxx-level.json`，注册到 `LevelManager.js`

### 2.4 游戏状态机（StateMachine）
状态流转顺序，只有在正确的状态下才允许特定操作：
```
IDLE → SWAP_ANIM → MATCHING → REMOVE_ANIM → DROP_ANIM → REFILL → IDLE
                                                                   ↓ (无可用匹配)
                                                              SHUFFLE
                                                                   ↓ (时间结束)
                                                           GAME_OVER
```
- **玩家只能在 `IDLE` 状态下交换图块**
- 动画期间任何点击均忽略

---

## 三、技术栈（已锁定）

| 项目 | 选择 | 原因 |
|------|------|------|
| 结构 | 原生 HTML5 | 无框架，轻量 |
| 脚本 | Vanilla JS ES6+（type="module"） | 模块化，无构建工具 |
| 渲染 | HTML5 Canvas + 图片渲染 | 高清 Sprite 贴图，预留高级动效接口 |
| UI/样式 | Vanilla CSS | 基础交互面板即可，后期再做深度拟物 |
| 音效 | 🚨 剔除 | 本期 Demo 坚决不带入音效系统 |
| 存储 | localStorage | 排行榜持久化 |
| 服务 | `python3 -m http.server 8080` 或 `npx serve .` | 本地开发 |

---

## 四、文件结构（已确定）

```
match3-game/
├── index.html                    # 入口（主菜单/关卡选择/游戏/排行榜）
├── css/
│   ├── style.css                 # 全局基础样式
│   ├── game.css                  # 游戏界面样式
│   └── themes.css                # 花园/家园主题 CSS Variables
├── js/
│   ├── core/
│   │   ├── EventBus.js           # 全局事件总线（模块通信唯一通道）
│   │   ├── StateMachine.js       # 游戏状态机
│   │   ├── Board.js              # 棋盘纯数据管理
│   │   ├── GameLoop.js           # requestAnimationFrame 主循环
│   │   ├── Renderer.js           # Canvas 绘制层
│   │   ├── ScoreManager.js       # 积分 + 连消乘数
│   │   ├── TimerManager.js       # 倒计时 90 秒
│   │   └── Leaderboard.js        # localStorage 排行榜
│   ├── elements/
│   │   ├── Tile.js               # 基础图块基类
│   │   ├── IceTile.js            # 冰块障碍
│   │   ├── BoxTile.js            # 箱子障碍
│   │   ├── ChainTile.js          # 链子障碍
│   │   ├── CarpetTile.js         # 地毯（家园）
│   │   └── SudsTile.js           # 泡沫（家园）
│   ├── powerups/
│   │   ├── PowerUp.js            # 道具基类
│   │   ├── Firecracker.js        # 鞭炮（花园）
│   │   ├── Bomb.js               # 炸弹（两关共用）
│   │   ├── TNT.js                # TNT桶（花园）
│   │   ├── Rocket.js             # 火箭（家园）
│   │   └── RainbowBall.js        # 彩虹球（家园）
│   ├── levels/
│   │   └── LevelManager.js       # 加载关卡 JSON，注册元素/道具
│   ├── ui/
│   │   ├── UIManager.js          # DOM UI 刷新（分数/时间/目标）
│   │   └── ScreenManager.js      # 界面切换（菜单/游戏/结算）
│   └── main.js                   # 入口，组装所有模块
├── levels/
│   ├── garden-level.json         # 花园关卡配置
│   └── home-level.json           # 家园关卡配置
├── docs/
│   ├── api-reference.md          # 📌 所有事件名/接口定义（写代码前必须查）
│   └── architecture.md           # 架构决策记录
└── .agents/
    ├── skills/                   # 本项目技能文件
    └── workflows/                # 工作流
```

---

## 五、防幻觉规则（Anti-Hallucination Rules）

1. **写新模块前必须查 `docs/api-reference.md`**，确认事件名和接口是否已定义
2. **每个模块独立完成后先测试，再写下一个**，绝不一次性写完所有文件
3. **不确定某个 API 是否存在时，查文件而不是猜测**
4. **EventBus 事件名使用命名空间**，格式：`domain:action`，如 `score:add`、`timer:tick`、`board:matched`
5. **修改已有模块前，先读该模块的完整代码**，不依赖记忆

---

## 六、开发顺序（已确定）

```
Phase 1 - 核心引擎（每步完成后单独测试）：
  Step 1: EventBus + StateMachine
  Step 2: Board（棋盘数据）+ 基础 Tile
  Step 3: Renderer（Canvas 绘制）
  Step 4: GameLoop（主循环）+ 交互（点击/滑动）
  Step 5: 匹配算法（findMatches/removeMatches/dropTiles/fillBoard）

Phase 2 - 游戏系统：
  Step 6: ScoreManager + TimerManager
  Step 7: UIManager + ScreenManager
  Step 8: Leaderboard

Phase 3 - 关卡内容：
  Step 9:  道具系统（PowerUp 基类 + 各道具）
  Step 10: 障碍物系统（Tile 子类）
  Step 11: LevelManager + 关卡 JSON

Phase 4 - 完善（暂缓）：
  Step 12: 预留高级动效接口（重力错步掉落等）
  Step 13: 接入完整的精灵图贴图

---

## 七、标准工作流与任务日志规范 (Workflow & Logging)

1. **强制留下任务日志 (Task Logging)**
   - 每次重构、新增功能或完成一个 Step 后，必须更新 `docs/CHANGELOG.md`。
   - 记录格式应包含：日期、被修改的模块/文件、具体实现了什么机制、是否存在需要后续优化的已知问题（Pending Issues）。
2. **核心逻辑隔离测试 (Isolated Testing)**
   - 对于纯机制逻辑（如 `Board.js` 里的组合特判、道具生成、连锁引爆算法），在将其连接到 Canvas 或 `InputHandler` 前，先在完全解耦的黑盒环境下（如编写独立的 JS 测试脚本当地运行）确保数据不出错。这极大提高了排错效率。
3. **稳步推进，不要一揽子修改**
   - 单次只开发一个最小验证闭环（例如：先只做一种特殊消除规则），测试通过并记录日志后，再做下一种。
