---
name: architecture-guide
description: 架构决策与模块接口规范。添加新模块或修改交互接口前必须加载。
---

# 架构指南

> 📋 单一真源：`docs/contracts/game-contract.v1.json`

## EventBus 事件总线 - 所有已注册事件

**命名规则**：`domain:action`，全小写，用冒号分隔。

### 棋盘事件
| 事件名 | 发射方 | 监听方 | payload 结构 |
|--------|--------|--------|-------------|
| `board:initialized` | Board | Renderer, UIManager | `{ rows, cols, grid }` |
| `board:tileSwapped` | Board | Renderer | `{ from: {r,c}, to: {r,c} }` |
| `board:matched` | Board | ScoreManager, Renderer | `{ matches: [{r,c,type}...], combo }` |
| `board:removed` | Board | Renderer | `{ removed: [{r,c}...] }` |
| `board:dropped` | Board | Renderer | `{ drops: [{from:{r,c}, to:{r,c}}...] }` |
| `board:refilled` | Board | Renderer | `{ newTiles: [{r,c,type}...] }` |
| `board:noMatches` | Board | GameLoop | `{}` |
| `board:shuffled` | Board | Renderer | `{ grid }` |

### 游戏状态事件
| 事件名 | 发射方 | 监听方 | payload 结构 |
|--------|--------|--------|-------------|
| `game:stateChange` | StateMachine | GameLoop, UIManager | `{ from, to }` |
| `game:start` | ScreenManager | GameLoop, TimerManager, ScoreManager | `{ level }` |
| `game:pause` | UIManager | GameLoop, TimerManager | `{}` |
| `game:resume` | UIManager | GameLoop, TimerManager | `{}` |
| `game:over` | TimerManager | ScreenManager, Leaderboard | `{ score, level }` |

### 计分事件
| 事件名 | 发射方 | 监听方 | payload 结构 |
|--------|--------|--------|-------------|
| `score:add` | ScoreManager | UIManager | `{ amount, total, reason }` |
| `score:combo` | ScoreManager | UIManager, Renderer | `{ level, multiplier }` |

### 计时事件
| 事件名 | 发射方 | 监听方 | payload 结构 |
|--------|--------|--------|-------------|
| `timer:tick` | TimerManager | UIManager | `{ remaining }` |
| `timer:warning` | TimerManager | UIManager, Renderer | `{ remaining }` |
| `timer:expired` | TimerManager | GameLoop | `{}` |

### 道具事件
| 事件名 | 发射方 | 监听方 | payload 结构 |
|--------|--------|--------|-------------|
| `powerup:created` | Board | Renderer | `{ type, r, c }` |
| `powerup:activated` | Board | Renderer, ScoreManager | `{ type, r, c, affectedCells }` |

### 障碍物事件
| 事件名 | 发射方 | 监听方 | payload 结构 |
|--------|--------|--------|-------------|
| `obstacle:hit` | Board | Renderer, ScoreManager | `{ type, r, c, remainingHP }` |
| `obstacle:destroyed` | Board | Renderer, ScoreManager | `{ type, r, c }` |

### 交互事件
| 事件名 | 发射方 | 监听方 | payload 结构 |
|--------|--------|--------|-------------|
| `input:select` | InputHandler | Renderer | `{ r, c }` |
| `input:swap` | InputHandler | GameLoop | `{ from: {r,c}, to: {r,c} }` |
| `input:invalidSwap` | Board | Renderer | `{ from: {r,c}, to: {r,c} }` |

### UI 事件
| 事件名 | 发射方 | 监听方 | payload 结构 |
|--------|--------|--------|-------------|
| `ui:levelSelect` | ScreenManager | GameLoop | `{ levelId }` |
| `ui:restart` | ScreenManager | GameLoop | `{}` |
| `ui:backToMenu` | ScreenManager | GameLoop | `{}` |
| `ui:hint` | InputHandler | Renderer | `{ from: {r,c}, to: {r,c} }` |

---

## 模块接口规范

### Board.js 公开方法
```javascript
class Board {
  constructor(rows, cols, colorCount)
  init(levelConfig)           // 初始化棋盘
  getTile(r, c)               // 获取指定位置图块
  setTile(r, c, tile)         // 设置指定位置图块
  swap(from, to)              // 交换两个图块（纯数据）
  findMatches()               // 返回所有匹配组 [{cells, type}...]
  removeMatches(matches)      // 移除匹配的图块
  dropTiles()                 // 下落填补空位，返回移动记录
  fillEmpty()                 // 填充顶部空位
  hasValidMoves()             // 是否还有可行交换
  findPossibleMoves()         // 寻找一个可消除交换 {from, to}，供提示系统用
  shuffle()                   // 打乱棋盘
}
```

### Tile.js 数据结构
```javascript
class Tile {
  constructor(colorIndex) {
    this.color = colorIndex;  // 0-4
     this.powerUp = null;      // null | 'firecracker' | 'bomb' | 'rocket' | 'rocket-h' | 'rocket-v' | 'rainbow' | 'paperplane'
    this.obstacle = null;     // null | { type: 'ice'|'box'|'chain'|'jelly'|'carpet'|'grass', hp: n }
    this.isMovable = true;    // chain 时 false
    this.isMatched = false;
    this.markedForRemoval = false;
  }
}
```

### StateMachine.js
```javascript
class StateMachine {
  constructor()
  transition(newState)        // 切换状态（带校验）
  is(state)                   // 查询当前状态
  canTransitionTo(state)      // 能否切换到指定状态
}
// 合法状态列表: IDLE, SWAP_ANIM, MATCHING, REMOVE_ANIM, DROP_ANIM, REFILL, SHUFFLE, GAME_OVER
```

### PowerUp.js 基类
```javascript
class PowerUp {
  constructor(type)
  getAffectedCells(r, c, board)  // 返回受影响的格子坐标 [{r,c}...]
  static shouldCreate(matchSize, matchShape)  // 判断是否应创建此道具
}
```

---

## 双游戏元素归属参考

> 两款游戏共用引擎但必须体现各自的视觉和机制身份。

### 基础图块

| 色号 | 🌸 花园物语 (Gardenscapes) | 🛋️ 家园梦想 (Homescapes) |
|------|---------------------------|---------------------------|
| 0 | 🍃 树叶 (leaf) | 📗 书本 (book) |
| 1 | 🍎 苹果 (apple) | 🎀 蝴蝶结 (bowtie) |
| 2 | 🍐 梨 (pear) | 💡 台灯 (lamp) |
| 3 | 💧 水滴 (drop) | ☕ 茶杯 (cup) |
| 4 | 🌸 花朵 (flower) | 🧸 坐垫 (cushion) |

### 道具差异

| 触发条件 | 🌸 花园物语 | 🛋️ 家园梦想 |
|----------|-----------|-----------|
| 4消直线 | 🧨 爆竹 Firecracker（小范围爆炸） | 🚀 火箭 Rocket（清一行/列） |
| 4消方形 | ❌ 无 | ✈️ 纸飞机 Paper Plane（飞向目标） |
| 5消L/T形 | 💣 炸弹 Bomb | 💣 炸弹 Bomb |
| 5消直线 | 🌈 彩虹爆破 Rainbow Blast | 🌈 彩虹球 Rainbow Ball |
| 6消L/T形 | 🧨 雷管 Dynamite（大范围） | ❌ 归入炸弹 |
| 7+消 | 🧱 TNT（超大范围） | ❌ 归入炸弹 |

### 障碍物归属

| 障碍物 | 花园 | 家园 | 说明 |
|--------|:----:|:----:|------|
| Ice ❄️ | ✅ | ✅ | 共有，覆盖层 |
| Chain ⛓️ | ✅ | ✅ | 共有，覆盖层，可匹配不可移动 |
| Box 📦 | ✅ | ✅ | 共有，占位型，旁边消除销毁 |
| Jelly 🍮 | ❌ | ✅ | 家园独有，覆盖层，不可匹配 |
| Carpet 🟥 | ❌ | ✅ | 家园独有，铺开目标 |
| Grass 🌱 | ✅ | ❌ | 花园独有，占位型 |

### 视觉风格

| 维度 | 花园物语 | 家园梦想 |
|------|---------|---------|
| 色调 | 自然绿 / 泥土棕 / 阳光暖黄 | 木色 / 奶油白 / 家居暖橘 |
| 棋盘格 | 浅绿/深绿交替 | 米白/暖灰交替 |
| 地毯 | N/A | 红色波斯地毯 |

