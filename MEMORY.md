# Match-3 项目长期记忆

## 项目概况
- Match-3 限时竞技赛，Canvas 2D 网页游戏，90秒模式
- 双主题：花园物语 / 家园梦想（各有专属道具映射和障碍物）
- 技术栈：原生 ES Modules + Canvas 2D + EventBus + StateMachine
- `"type": "module"`，所有 import 必须带 .js 后缀

## 架构核心
- **EventBus** 单例，全局事件总线，事件名用 `Events.js` 的 E 常量
- **StateMachine** 状态机，合法转换表控制状态流转
- **模块化**: core/ config/ elements/ powerups/ ui/
- 事件只在 constructor 绑一次，永不 clear + 重绑

## 已完成功能（Phase 1-5）
- 匹配检测（3连/L形/方形/5+直线/十字）
- 道具系统（火箭/鞭炮/炸弹/彩虹球/纸飞机）+ 连环爆炸递归算法
- 障碍物系统（冰/箱/链/泡沫蔓延/蜂蜜蔓延/花瓶/地毯）
- 计分（连消乘数 ×1.5）+ 排行榜（localStorage 按主题分开）
- Hint 系统（3秒空闲提示，但缺视觉反馈）
- AI 贴图渲染（multiply 混合模式去白底）

## 已知缺陷（2026-04-04 审查确认）
1. ~~**P0 动画空壳**: GameLoop 全部用 setTimeout 驱动状态切换，Renderer.activeAnimations 从未被使用~~ → **已修复**
2. ~~**P1 Hint 无反馈**: UIManager 未监听 UI_HINT 事件~~ → **已修复**
3. ~~**P3 payload 不匹配**: ScoreManager._onPowerUp 读 affectedCells，GameLoop 发射的是 {type,r,c,target}~~ → **已修复**
4. ~~**渲染 Bug（白纱+素材消失）**: ctx.save/restore 嵌套泄漏 + AnimSystem 边界 bug~~ → **已修复并验证通过**
5. 无音效、无粒子特效

## 已完成的重大修复（2026-04-04）
- **动画系统**: 新建 `AnimationSystem.js`，GameLoop 改为 async/await + Promise 驱动
  - 4 种动画: swap(easeOutCubic滑动) / remove(缩小淡出旋转) / drop(弹跳落地) / invalidShake(左右抖动)
  - Renderer._drawTiles 每帧读取动画插值绘制
- **Hint 视觉反馈**: UIManager 监听 UI_HINT + CSS hintPulse 脉冲高亮
- **ScoreManager 兼容修复**: _onPowerUp 同时支持 affectedCells 和 target 格式
- **渲染 Bug 修复（白纱+素材消失）**:
  - 根因1: `_drawTiles` 每格 ctx.save/restore 嵌套导致 globalAlpha 泄漏 → 移除包裹，消除动画隔离到 `_drawTileAnimated()`
  - 根因2: `render()` 每帧未重置 ctx 状态 → 开头 save+重置 globalAlpha/blendMode，结尾 restore
  - 根因3: `AnimSystem.swap.getOffsetB` 的 `fromB` 缺少 `.c` 属性 → 已修复
  - 根因4: `AnimSystem.drop([])` 空数组返回对象缺少 `getDropOffset/isNewFalling` 方法 → 已补全
  - **验证**: 3层自动化测试全部通过（Board数据层30轮 + GameLoop集成20轮 + Playwright浏览器25轮），用户确认不再复现

## 自动化测试体系（2026-04-04 建立）
- `tests/test-render-bug.mjs` — Board 数据层单元测试（Mock Canvas）
- `tests/test-game-loop-render.mjs` — GameLoop+Renderer 集成测试（Mock Canvas）
- `tests/browser-automation-test.mjs` — Playwright 真实浏览器自动化（25轮点击+截图）
- 截图输出: `tests/_screenshots/`
- 依赖: `@playwright/test` (devDependencies)

## Ontology 知识图谱（2026-04-04 初始化）
- 使用 **Ontology** skill（结构化知识图谱，JSONL 存储）
- Schema 定义在 `memory/ontology/schema.yaml`，图数据在 `memory/ontology/graph.jsonl`
- 自定义类型：Project / GameModule / Bug / Feature / Theme / Person / Phase
- 关键关系：Bug→blocks→Feature, Feature→depends_on→Feature, Bug→affects_module→GameModule
- 查询示例：`python3 ontology.py list --type Bug` / `ontology.py related --id proj_match3 --rel has_module`

## 编码规范铁律
- 文件头必须 JSDoc（职责+设计原则）
- 禁止硬编码事件名，只用 E 常量
- 所有魔法数字进 GameConfig
- 可能无限循环处必须有安全阀
- Fisher-Yates 代替 sort(random)
