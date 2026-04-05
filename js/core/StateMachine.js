/**
 * StateMachine - 游戏状态机
 * 
 * 管理游戏的状态流转，只允许合法的状态转换。
 * 
 * 状态流转图：
 *   IDLE → SWAP_ANIM → MATCHING → REMOVE_ANIM → DROP_ANIM → REFILL → (回到 IDLE 或 MATCHING)
 *   IDLE → SHUFFLE（无可用匹配时）
 *   SHUFFLE → IDLE
 *   任何状态 → GAME_OVER（时间结束时）
 * 
 * 用法：
 *   import { StateMachine, GameState } from './StateMachine.js';
 *   const sm = new StateMachine(eventBus);
 *   sm.transition(GameState.SWAP_ANIM);
 *   sm.is(GameState.IDLE); // false
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';

/** 所有合法的游戏状态 */
export const GameState = Object.freeze({
  IDLE:        'IDLE',
  SWAP_ANIM:   'SWAP_ANIM',
  MATCHING:    'MATCHING',
  REMOVE_ANIM: 'REMOVE_ANIM',
  DROP_ANIM:   'DROP_ANIM',
  REFILL:      'REFILL',
  SHUFFLE:     'SHUFFLE',
  GAME_OVER:   'GAME_OVER',
});

/**
 * 合法的状态转换表。
 * key: 当前状态, value: 可以转换到的目标状态集合
 */
const TRANSITIONS = {
  [GameState.IDLE]:        [GameState.SWAP_ANIM, GameState.SHUFFLE, GameState.GAME_OVER],
  [GameState.SWAP_ANIM]:   [GameState.MATCHING, GameState.IDLE, GameState.GAME_OVER],
  // SWAP_ANIM → IDLE: 无效交换弹回后恢复
  [GameState.MATCHING]:    [GameState.REMOVE_ANIM, GameState.IDLE, GameState.GAME_OVER],
  // MATCHING → IDLE: 没有找到匹配时
  [GameState.REMOVE_ANIM]: [GameState.DROP_ANIM, GameState.GAME_OVER],
  [GameState.DROP_ANIM]:   [GameState.REFILL, GameState.GAME_OVER],
  [GameState.REFILL]:      [GameState.MATCHING, GameState.IDLE, GameState.GAME_OVER],
  // REFILL → MATCHING: 检查新图块是否引发连消
  // REFILL → IDLE: 没有新匹配，回到等待玩家操作
  [GameState.SHUFFLE]:     [GameState.IDLE, GameState.GAME_OVER],
  [GameState.GAME_OVER]:   [], // 终态，不可转出
};

export class StateMachine {
  constructor() {
    /** @type {string} */
    this._state = GameState.IDLE;

    /** @type {string|null} 前一个状态 */
    this._previousState = null;
  }

  /**
   * 获取当前状态
   * @returns {string}
   */
  get state() {
    return this._state;
  }

  /**
   * 获取前一个状态
   * @returns {string|null}
   */
  get previousState() {
    return this._previousState;
  }

  /**
   * 检查当前是否处于指定状态
   * @param {string} state
   * @returns {boolean}
   */
  is(state) {
    return this._state === state;
  }

  /**
   * 检查是否可以转换到指定状态
   * @param {string} newState
   * @returns {boolean}
   */
  canTransitionTo(newState) {
    const allowed = TRANSITIONS[this._state];
    return allowed ? allowed.includes(newState) : false;
  }

  /**
   * 执行状态转换
   * @param {string} newState - 目标状态（必须是 GameState 中的值）
   * @returns {boolean} 转换是否成功
   */
  transition(newState) {
    // 相同状态不需要转换
    if (this._state === newState) {
      return true;
    }

    if (!this.canTransitionTo(newState)) {
      console.warn(
        `[StateMachine] Invalid transition: ${this._state} → ${newState}. ` +
        `Allowed: [${TRANSITIONS[this._state]?.join(', ') || 'none'}]`
      );
      return false;
    }

    const from = this._state;
    this._previousState = from;
    this._state = newState;

    EventBus.emit(E.GAME_STATE_CHANGE, { from, to: newState });

    return true;
  }

  /**
   * 强制重置到 IDLE 状态（仅用于游戏重新开始）
   */
  reset() {
    this._previousState = this._state;
    this._state = GameState.IDLE;
    EventBus.emit(E.GAME_STATE_CHANGE, { from: this._previousState, to: GameState.IDLE });
  }
}
