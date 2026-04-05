---
name: canvas-renderer-patterns
description: Canvas 渲染层的标准模式和图块绘制规范。在编写 Renderer.js 或任何 Canvas 绘制代码前加载。
---

# Canvas 渲染规范

## 图块绘制标准

### 颜色方案（5 种，两套主题）

### 素材方案（5 种基础消除物 + 道具，异步分模块加载）

为了极致还原 Playrix，渲染需从绘制图元进化至图片贴图，且需要保持高度的图图对应：

#### 花园主题 素材定位 (Gardenscapes)
- 0: `apple` (红苹果)
- 1: `leaf` (绿叶)
- 2: `pear` (黄梨子)
- 3: `flower` (紫花朵)
- 4: `drop` (蓝水滴)

#### 家园主题 素材定位 (Homescapes)
- 0: `book` (绿皮书)
- 1: `bowtie` (红领结)
- 2: `lamp` (黄台灯)
- 3: `cup` (蓝茶杯)
- 4: `cushion` (紫坐垫)

### 图块绘制要求 (drawImage 替代原生矩形)
```javascript
// 渲染时的范式示例:
function drawTile(ctx, x, y, size, tileData, stateOffset = {}) {
  // 1. 获取事先加载到内存中的 Image 对象
  const img = AssetLoader.getImage(tileData.theme, tileData.type);
  if (!img) return;

  // 2. 处理弹簧形变补偿 (Squash & Stretch)
  const scaleX = stateOffset.scaleX || 1;
  const scaleY = stateOffset.scaleY || 1;
  const drawW = size * scaleX;
  const drawH = size * scaleY;

  // 3. 将原点移至中心点，以便进行居中缩放或旋转
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  // 可叠加的轻微投影以体现立体感
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = size * 0.1;
  ctx.shadowOffsetY = size * 0.05;

  // 4. 绘制贴图
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}
```

## 动画规范

| 动画类型 | 时长 | 缓动函数 |
|----------|------|----------|
| 图块交换 | 220ms | easeOutBack (带有轻微回弹) |
| 点击选中缩放 | 100ms | easeOutElastic |
| 匹配消除（向中心收缩并爆裂）| 300ms | easeInBack |
| 图块落下 | 150ms/格 | easeInQuad 加速下落，落地时转为弹簧压扁恢复 |
| 落地弹簧动效 (Squash) | 120ms | 按比例 `scaleY:0.8 / scaleX:1.1` 后恢复 |
| 无效交换弹回 | 200ms | easeOutElastic (弹性震荡) |
| 全局粒子喷射 | 500-800ms | 依据重力加速度与空气阻力算法 |

## 性能要求
- 目标帧率：60fps
- 每帧 `ctx.clearRect` 清空后重绘
- 动画对象统一放入 `activeAnimations` 数组，完成后移除
- 不在渲染循环中做 DOM 操作
