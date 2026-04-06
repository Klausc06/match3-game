# Match-3 引擎元素/障碍物全面分析

## 障碍物分配

| 障碍物 | Home 🏠 | Garden 🌿 | 说明 |
|--------|---------|-----------|------|
| 箱子 (box) | ✅ weight:6 | ✅ weight:3 | 两主题共有，打击可破坏 |
| 锁链 (chain) | ✅ weight:5 | ✅ weight:4 | 两主题共有，锁定下方图块 |
| 果冻 (jelly) | ✅ weight:3 | ❌ | Home 独有 |
| 地毯 (carpet) | ✅ weight:4 | ❌ | Home 独有，会扩散 |
| 草地 (grass) | ❌ | ✅ weight:7 | Garden 独有 |
| 溪流 (stream) | ❌ | ✅ 1~2条 | Garden 独有，蜿蜒路径 |

## 道具分配

| 触发条件 | Home 🏠 | Garden 🌿 |
|---------|---------|-----------|
| 横向4消 | 🚀 火箭(横) | 🧨 鞭炮 |
| 纵向4消 | 🚀 火箭(纵) | 🧨 鞭炮 |
| 2×2方块 | ✈️ 纸飞机 | — |
| L/T-5消 | 💣 炸弹(Home) | 💣 炸弹(Garden) |
| L/T-6消 | 💣 炸弹(Home) | 🧨 炸雷 |
| L/T-7消 | 💣 炸弹(Home) | 💥 TNT |
| 5连线 | 🌈 彩虹 | 🌈 彩虹 |

## 本轮修复清单

| 项目 | 状态 | 修改文件 |
|------|------|---------|
| 花园去掉地毯 | ✅ 完成 | Board.js, destruction.js, Renderer.js, LevelGenerator.js |
| 溪流改蜿蜒路径 | ✅ 完成 | LevelGenerator.js, Board.js |
| 溪流不被对称打散 | ✅ 完成 | LevelGenerator.js |
| 障碍物密度降5% | ✅ 完成 | LevelGenerator.js (0.55→0.50) |
| 溪流移动触发时机 | ✅ 完成 | GameLoop.js (回合结束时触发一次) |
