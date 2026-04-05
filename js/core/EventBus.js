/**
 * EventBus - 全局事件总线
 * 
 * 所有跨模块通信的唯一通道。
 * 使用命名空间格式：'domain:action'
 * 
 * 用法：
 *   import { EventBus } from './EventBus.js';
 *   EventBus.on('board:matched', (data) => { ... });
 *   EventBus.emit('board:matched', { matches: [...], combo: 1 });
 *   EventBus.off('board:matched', handler);
 */

class EventBusClass {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();

    /** @type {boolean} 开启后在控制台打印所有事件 */
    this.debug = false;

    /** @type {number} 超过此数量的监听器时打印警告，帮助发现重复注册 */
    this.maxListeners = 10;
  }

  /**
   * 注册事件监听器
   * @param {string} event - 事件名（如 'board:matched'）
   * @param {Function} callback - 回调函数
   * @returns {Function} 返回取消监听的函数
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    const set = this._listeners.get(event);
    set.add(callback);

    if (set.size > this.maxListeners) {
      console.warn(
        `[EventBus] ⚠️ "${event}" 已有 ${set.size} 个监听器，可能存在重复注册。`
      );
    }

    // 返回一个 unsubscribe 函数，方便清理
    return () => this.off(event, callback);
  }

  /**
   * 注册一次性事件监听器（触发一次后自动移除）
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} 返回取消监听的函数
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * 移除事件监听器
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * 发射事件
   * @param {string} event - 事件名
   * @param {*} [data] - 传递给监听器的数据
   */
  emit(event, data) {
    if (this.debug) {
      console.log(`[EventBus] ${event}`, data);
    }

    const listeners = this._listeners.get(event);
    if (listeners) {
      // 创建副本遍历，防止回调中修改 listeners 导致问题
      for (const callback of [...listeners]) {
        try {
          callback(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  /**
   * 移除某个事件的所有监听器，或移除全部
   * @internal 仅限测试使用，项目规则禁止在游戏流程中调用
   * @param {string} [event] - 不传则清除全部
   */
  clear(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * 获取某个事件的监听器数量（调试用）
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    const listeners = this._listeners.get(event);
    return listeners ? listeners.size : 0;
  }
}

// 导出单例
export const EventBus = new EventBusClass();
