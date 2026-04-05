# API Reference — Match-3 限时竞技游戏

> ⚠️ **写代码前必须读此文件**。所有 EventBus 事件名和模块接口以此文档为准。
>
> 📋 **单一真源**：`docs/contracts/game-contract.v1.json`

---

## EventBus 事件清单

详见 `.agents/skills/architecture/SKILL.md` 中的完整表格。

### 快速查阅（事件名 → 用途）

```
board:initialized    棋盘初始化完成
board:tileSwapped    图块交换完毕（纯数据）
board:matched        发现匹配组
board:removed        匹配图块已移除
board:dropped        图块已下落
board:refilled       空位已填充新图块
board:noMatches      棋盘无可用匹配
board:shuffled       棋盘已打乱重排

game:stateChange     状态机切换
game:start           游戏开始
game:pause           暂停
game:resume          继续
game:over            游戏结束

score:add            加分
score:combo          连消倍数触发

timer:tick           计时器每秒回调
timer:warning        剩余时间 ≤ 10 秒警告
timer:expired        时间耗尽

powerup:created      道具生成
powerup:activated    道具被引爆

obstacle:hit         障碍物被命中（hp-1）
obstacle:destroyed   障碍物被摧毁

input:select         玩家选中一个图块
input:swap           玩家交换两个图块
input:invalidSwap    交换无效（无匹配）

ui:levelSelect       选择关卡
ui:restart           重新开始
ui:backToMenu        返回主菜单
ui:hint              触发连续 3 秒空闲提示动画
```

---

## 模块接口速查

### Board.js
```
init(levelConfig)             → void
getTile(r, c)                 → Tile | null
setTile(r, c, tile)           → void
swap({r,c}, {r,c})            → boolean
findMatches()                 → Match[]
removeMatches(Match[])        → RemovedTile[]
dropTiles()                   → DropRecord[]
fillEmpty()                   → NewTile[]
hasValidMoves()               → boolean
shuffle()                     → void
findPossibleMoves()           → {from, to} | null
```

### Tile 数据结构
```
{
  color: 0-4,
  powerUp: null | string,
  obstacle: null | { type: string, hp: number },
  isMovable: boolean,
  isMatched: boolean,
  markedForRemoval: boolean
}
```

### StateMachine 状态列表
```
IDLE → SWAP_ANIM → MATCHING → REMOVE_ANIM → DROP_ANIM → REFILL → IDLE
                                                                   ↓
                                                              SHUFFLE
                                                                   ↓
                                                             GAME_OVER
```

### PowerUp 子类注册
```
每个道具必须实现:
- getAffectedCells(r, c, board) → [{r,c}...]
- static shouldCreate(matchSize, matchShape) → boolean
- static TYPE → string
```

### 障碍物 Tile 子类注册
```
每个障碍物必须实现:
- hit() → boolean (是否被摧毁)
- canBeSwapped() → boolean
- canBeFallenThrough() → boolean
```
