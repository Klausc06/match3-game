# 架构决策记录（ADR）

## ADR-001: 限时挑战赛 vs 步数限制
**决策**：限时 90 秒，无步数限制  
**原因**：节奏更快更刺激，适合排行榜竞技  
**影响**：需要 TimerManager；不需要 MoveCounter

## ADR-002: Canvas 渲染 vs DOM
**决策**：Canvas 渲染棋盘 + DOM 做 UI 面板  
**原因**：Canvas 动画自由度最高，DOM 处理文字/按钮更方便  
**影响**：Renderer 只处理 Canvas；UIManager 只处理 DOM

## ADR-003: EventBus 作为唯一通信机制
**决策**：所有跨模块通信走 EventBus  
**原因**：解耦各模块，新增功能无需修改已有代码  
**影响**：禁止模块直接引用其他模块实例的属性

## ADR-004: 5 种图块颜色
**决策**：5 种，低于常见的 6 种  
**原因**：限时模式需要更高的匹配概率来保证节奏  
**影响**：Board.init 中 colorCount=5

## ADR-005: 使用外部高清 Sprite 素材（MVP阶段）
**决策**：放弃纯 Canvas Primitives 绘制，引入 `AssetLoader` 支持 PNG 贴图，但暂不深扣 UI/粒子动效。  
**原因**：确立图片渲染流水线架构，但优先保证核心玩法逻辑落地。  
**影响**：需要专门的 Asset 静态解析与异步加载流，Renderer 在图片准备好后通过 `ctx.drawImage` 渲染。复杂的弹簧缓动留作后续优化接口。

## ADR-006: 插件化道具和障碍物
**决策**：道具/障碍物以继承基类的方式独立文件实现  
**原因**：后续扩展只需加文件，不改已有代码（开闭原则）  
**影响**：需要 PowerUp 基类和 Tile 基类提供足够的抽象

## ADR-007: 分关卡独立排行榜
**决策**：花园和家园各维护独立排行榜  
**原因**：机制差异很大，分数不可比  
**影响**：Leaderboard 需要 levelId 参数

## ADR-008: 模块化 ES6 import
**决策**：使用 `<script type="module">` + ES6 import  
**原因**：原生支持，无需构建工具，结构清晰  
**影响**：需要 HTTP 服务器运行（不能直接双击 index.html）

## ADR-009: 严格的同步下落与输入锁死
**决策**：在消除、下落、填充动画完成前，完全锁死输入（禁止空中滑动）  
**原因**：MVP 阶段保障状态机和逻辑一致性，避免异步重力或手速过快带来的 Bug  
**影响**：`InputHandler` 必须重度依赖 `StateMachine.is('IDLE')` 校准。

## ADR-010: 独立提示系统 (Hint System)
**决策**：连续 3 秒无有效输入时高亮一个可消除组合  
**原因**：原版 Playrix 核心体验之一，引导新手  
**影响**：`InputHandler` 或 `GameLoop` 需要维护一个 idle timer，超时后轮询 `Board.findPossibleMoves()` 并发射 `ui:hint` 动画事件。
