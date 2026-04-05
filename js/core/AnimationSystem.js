/**
 * AnimationSystem — 图块动画系统
 *
 * 职责：
 *   - 提供各类图块动画的工厂方法（Swap / Remove / Drop / Refill / InvalidShake）
 *   - 每个动画对象是一个 { update(timestamp, ctx, renderer) → boolean } 函数
 *   - 使用 ease-out / bounce 等缓动曲线确保手感流畅
 *   - 动画完成后自动从 Renderer.activeAnimations 中移除
 *
 * 设计原则：
 *   - 动画是纯视觉层，不修改 Board 数据
 *   - 所有时长从 GameConfig 读取，禁止魔法数字
 *   - 支持并行动画（多个格子同时运动）
 */

import { GameConfig as C } from '../config/GameConfig.js';

// ═══════════════════════════════════════════
//  缓动函数库
// ═══════════════════════════════════════════

const Easing = {
  /** 二次 ease-out: 快→慢，适合下落 */
  easeOutQuad(t) { return t * (2 - t); },
  /** 三次 ease-out：更平滑的减速 */
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  /** 弹跳效果，适合落地 */
  bounce(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  /** 线性 */
  linear(t) { return t; },
};

// ═══════════════════════════════════════════
//  动画工厂函数
// ═══════════════════════════════════════════

export class AnimSystem {

  /**
   * 创建交换动画（两个格子滑动到对方位置）
   * @param {{r:number,c:number}} fromA 格子A起点
   * @param {{r:number,c:number}} toA   格子A终点
   * @param {{r:number,c:number}} fromB 格子B起点
   * @param {{r:number,c:number}} toB   格子B终点
   * @param {number} [duration] 时长ms，默认 C.SWAP_DURATION
   * @returns {Object} 动画对象
   */
  static swap(fromA, toA, fromB, toB, duration = C.SWAP_DURATION) {
    const startTs = performance.now();
    const onCompleteCallbacks = [];

    return {
      type: 'swap',
      update(ts) {
        if (ts < startTs) return false;
        const elapsed = ts - startTs;
        if (elapsed >= duration) return true; // 完成

        const progress = Easing.easeOutCubic(elapsed / duration);
        return false;
      },
      /** 获取 A 在当前帧应偏移的像素值 */
      getOffsetA(renderer, ts) {
        if (ts < startTs) return { dx: 0, dy: 0 };
        const progress = Math.min(Easing.easeOutCubic((ts - startTs) / duration), 1);
        const pxA = renderer.gridToPixel(fromA.r, fromA.c);
        const pxA2 = renderer.gridToPixel(toA.r, toA.c);
        return {
          dx: (pxA2.x - pxA.x) * progress,
          dy: (pxA2.y - pxA.y) * progress,
        };
      },
      /** 获取 B 在当前帧应偏移的像素值 */
      getOffsetB(renderer, ts) {
        if (ts < startTs) return { dx: 0, dy: 0 };
        const progress = Math.min(Easing.easeOutCubic((ts - startTs) / duration), 1);
        const pxB = renderer.gridToPixel(fromB.r, fromB.c);
        const pxB2 = renderer.gridToPixel(toB.r, toB.c);
        return {
          dx: (pxB2.x - pxB.x) * progress,
          dy: (pxB2.y - pxB.y) * progress,
        };
      },
      get progress() { return Math.min((performance.now() - startTs) / duration, 1); },
      get isDone() { return performance.now() - startTs >= duration; },
      onComplete(cb) { onCompleteCallbacks.push(cb); return this; },
      _onComplete() { onCompleteCallbacks.forEach(fn => fn()); },
    };
  }

  /**
   * 创建消除动画（缩小+淡出+旋转）
   * @param {Array<{r:number,c:number}>} cells 要消除的格子列表
   * @param {number} [duration] 时长ms，默认 C.REMOVE_DURATION
   * @returns {Object} 动画对象
   */
  static remove(cells, duration = C.REMOVE_DURATION) {
    const startTs = performance.now();
    const cellSet = new Set(cells.map(c => c.r * 100 + c.c));

    return {
      type: 'remove',
      cells,
      update(ts) {
        return ts - startTs >= duration;
      },
      /** 某个格子是否正在消除中 */
      isRemoving(r, c) {
        return cellSet.has(r * 100 + c);
      },
      /** 获取格子的缩放比例和透明度 */
      getTransform(ts) {
        if (ts < startTs) return { scale: 1, alpha: 1, rotation: 0 };
        const progress = Math.min((ts - startTs) / duration, 1);
        // 先慢后快：scale 从 1→0, alpha 从 1→0
        const scale = 1 - Easing.easeOutQuad(progress);     // 1 → 0
        const alpha = 1 - progress;                           // 1 → 0
        const rotation = progress * Math.PI * 0.15;           // 微微旋转
        return { scale: Math.max(scale, 0), alpha: Math.max(alpha, 0), rotation };
      },
      get progress() { return Math.min((performance.now() - startTs) / duration, 1); },
      get isDone() { return performance.now() - startTs >= duration; },
    };
  }

  /**
   * 创建下落动画（加速落下+弹跳落地）
   * @param {Array<{from:{r:number,c:number},to:{r:number,c:number}>} drops 下落信息数组
   * @returns {Object} 动画对象
   */
  static drop(drops) {
    if (!drops || drops.length === 0) {
      // 无下落时立即完成 — 保持与正常 drop 对象相同的方法签名
      const done = {
        type: 'drop', drops: [], maxDist: 0, totalDuration: 0,
        update: () => true, isDone: true, progress: 1,
        getDropOffset: () => null,
        isNewFalling: () => false,
      };
      return done;
    }

    // 根据最大距离计算总时长
    const maxDist = drops.reduce((max, d) => Math.max(max, d.to.r - d.from.r), 0);
    const totalDuration = Math.max(maxDist * C.DROP_DURATION_PER_CELL, 100);
    const startTs = performance.now();

    // 建立 (r,c) → dropInfo 的映射
    const dropMap = new Map();
    for (const d of drops) {
      dropMap.set(d.to.r * 100 + d.to.c, d);
    }

    return {
      type: 'drop',
      drops,
      dropMap,
      maxDist,
      totalDuration,
      update(ts) {
        return ts - startTs >= totalDuration;
      },
      /** 获取某个格子在当前帧应该绘制的偏移位置（像素） */
      getDropOffset(r, c, renderer, ts) {
        const key = r * 100 + c;
        const info = dropMap.get(key);
        if (!info) return null; // 这个格子没有参与下落

        if (ts < startTs) return { dx: 0, dy: 0 };

        const dist = info.to.r - info.from.r;
        const cellDuration = dist > 0 ? dist * C.DROP_DURATION_PER_CELL : 50;
        const localProgress = Math.min((ts - startTs) / cellDuration, 1);

        // 弹跳曲线
        const eased = Easing.bounce(localProgress);

        const fromPx = renderer.gridToPixel(info.from.r, info.from.c);
        const toPx = renderer.gridToPixel(info.to.r, info.to.c);
        const totalDy = toPx.y - fromPx.y;

        return {
          dx: 0,
          dy: totalDy * eased - totalDy, // 偏移量（正=向下）
        };
      },
      /** 判断某格子是否是新填充的（从屏幕外掉入） */
      isNewFalling(r, c) {
        const key = r * 100 + c;
        const info = dropMap.get(key);
        return info && info.from.r < 0;
      },
      get progress() { return Math.min((performance.now() - startTs) / totalDuration, 1); },
      get isDone() { return performance.now() - startTs >= totalDuration; },
    };
  }

  /**
   * 创建无效交换抖动动画
   * @param {{r:number,c,number}} pos 抖动的格子位置
   * @param {number} [duration] 时长ms
   * @returns {Object} 动画对象
   */
  static invalidShake(pos, duration = C.INVALID_SWAP_DURATION) {
    const startTs = performance.now();

    return {
      type: 'shake',
      pos,
      update(ts) {
        return ts - startTs >= duration;
      },
      /** 获取当前帧的抖动偏移 */
      getShakeOffset(ts) {
        if (ts < startTs) return 0;
        const progress = (ts - startTs) / duration;
        if (progress >= 1) return 0;
        // 左右快速抖动，振幅逐渐衰减
        const amplitude = 6 * (1 - progress);
        const phase = progress * Math.PI * 8; // 4 个周期
        return Math.sin(phase) * amplitude;
      },
      get progress() { return Math.min((performance.now() - startTs) / duration, 1); },
      get isDone() { return performance.now() - startTs >= duration; },
    };
  }
}

/** 默认导出工厂实例 */
export default AnimSystem;
