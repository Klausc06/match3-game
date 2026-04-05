/**
 * ScoreManager — 积分 + 连消乘数
 *
 * 职责：
 *   - 监听 board:matched、obstacle:destroyed、powerup:activated 事件
 *   - 按规则计算分数（带连消乘数）
 *   - 发射 score:updated 供 UI 层更新
 *
 * 计分规则（依据 project-rules/SKILL.md 1.1 节）：
 *   基础 3 消：+100  |  4 消：+200  |  5+消：+300~500
 *   连锁每层 ×1.5 倍  |  障碍物：+150/个  |  道具波及：+50/格
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';
import { GameConfig as C } from '../config/GameConfig.js';

export class ScoreManager {
  constructor() {
    /** @type {number} 当前分数 */
    this.score = 0;
    /** @type {number} 最高连消 */
    this.maxCombo = 0;
    /** @type {number} 总消除图块数 */
    this.totalCleared = 0;

    this._bindEvents();
  }

  // ── 事件绑定（只在 constructor 中调用一次） ──

  _bindEvents() {
    EventBus.on(E.BOARD_MATCHED, (data) => this._onMatch(data));
    EventBus.on(E.OBSTACLE_DESTROYED, () => this._onObstacleDestroyed());
    EventBus.on(E.POWERUP_ACTIVATED, (data) => this._onPowerUp(data));
  }

  // ── 事件处理 ──

  /** 匹配消除计分 */
  _onMatch({ matches, combo }) {
    let baseScore = 0;
    for (const match of matches) {
      const n = match.cells.length;
      if      (n === 3) baseScore += C.SCORE_MATCH_3;
      else if (n === 4) baseScore += C.SCORE_MATCH_4;
      else if (n === 5) baseScore += C.SCORE_MATCH_5;
      else if (n === 6) baseScore += C.SCORE_MATCH_6;
      else              baseScore += C.SCORE_MATCH_7_PLUS;
    }

    const multiplier = Math.pow(C.CASCADE_MULTIPLIER, combo - 1);
    const amount = Math.floor(baseScore * multiplier);

    this.score += amount;
    this.totalCleared += matches.reduce((sum, m) => sum + m.cells.length, 0);
    if (combo > this.maxCombo) this.maxCombo = combo;

    EventBus.emit(E.SCORE_UPDATED, { score: this.score, added: amount, combo });

    if (combo >= 2) {
      EventBus.emit(E.SCORE_COMBO, { level: combo, multiplier });
    }
  }

  /** 障碍物摧毁加分 */
  _onObstacleDestroyed() {
    this.score += C.SCORE_OBSTACLE;
    EventBus.emit(E.SCORE_UPDATED, {
      score: this.score, added: C.SCORE_OBSTACLE, combo: 0,
    });
  }

  /**
   * 道具引爆加分
   * 兼容两种 payload 格式：
   *   - GameLoop 发射: { type, r, c, target }
   *   - 标准格式: { affectedCells }
   */
  _onPowerUp({ affectedCells, type, target }) {
    // 兼容两种 payload 格式
    const count = affectedCells?.length || (target ? 2 : 1);
    const amount = count * C.SCORE_POWERUP_CELL;
    if (amount <= 0) return;
    this.score += amount;
    EventBus.emit(E.SCORE_UPDATED, {
      score: this.score, added: amount, combo: 0,
    });
  }

  // ── 重置 ──

  reset() {
    this.score = 0;
    this.maxCombo = 0;
    this.totalCleared = 0;
  }
}
