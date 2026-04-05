/**
 * TimerManager — 倒计时管理器
 *
 * 职责：
 *   - 精确的 requestAnimationFrame 倒计时
 *   - 发射 timer:tick / timer:warning / timer:expired 事件
 *   - 支持 pause / resume / reset
 *
 * 事件 payload：
 *   timer:tick    { remaining: number, ratio: number }
 *   timer:warning { remaining: number }  — 剩余 ≤ WARNING_THRESHOLD 时
 *   timer:expired {}
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';
import { GameConfig as C } from '../config/GameConfig.js';

export class TimerManager {
  /**
   * @param {number} [duration] - 游戏总时间（秒），默认从 GameConfig 读取
   */
  constructor(duration = C.GAME_DURATION) {
    this.total     = duration;
    this.remaining = duration;
    this._running       = false;
    this._lastTimestamp  = null;
    this._expired        = false;
    this._warningSent    = false;

    this._bindEvents();
  }

  // ── 事件绑定（只在 constructor 中调用一次） ──

  _bindEvents() {
    EventBus.on(E.GAME_PAUSE,  () => this.pause());
    EventBus.on(E.GAME_RESUME, () => this.resume());
  }

  // ── 公开控制方法 ──

  start() {
    if (this._running) return;
    this._running      = true;
    this._expired      = false;
    this._warningSent   = false;
    this._lastTimestamp = null;
  }

  pause() {
    this._running = false;
  }

  resume() {
    if (this._running || this._expired) return;
    this._running      = true;
    this._lastTimestamp = null;
  }

  reset(duration) {
    this._running = false;
    if (duration !== undefined) this.total = duration;
    this.remaining    = this.total;
    this._expired     = false;
    this._warningSent = false;
  }

  // ── 内部帧循环 ──

  /**
   * 由 GameLoop 每帧调用，传入 RAF 时间戳
   * @param {number} timestamp - requestAnimationFrame 提供的时间戳
   */
  tick(timestamp) {
    if (!this._running) return;

    if (this._lastTimestamp !== null) {
      const deltaSec = (timestamp - this._lastTimestamp) / 1000;
      this.remaining -= deltaSec;

      if (this.remaining <= 0) {
        this.remaining = 0;
        this._running  = false;
        this._expired  = true;
        EventBus.emit(E.TIMER_TICK, { remaining: 0, ratio: 0 });
        EventBus.emit(E.TIMER_EXPIRED, {});
        return;
      }

      EventBus.emit(E.TIMER_TICK, {
        remaining: this.remaining,
        ratio: this.remaining / this.total,
      });

      if (this.remaining <= C.WARNING_THRESHOLD && !this._warningSent) {
        this._warningSent = true;
        EventBus.emit(E.TIMER_WARNING, { remaining: this.remaining });
      }
    }

    this._lastTimestamp = timestamp;
  }

  // ── 工具方法 ──

  getFormattedTime() {
    const secs = Math.ceil(this.remaining);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  get isExpired() {
    return this._expired;
  }
}
