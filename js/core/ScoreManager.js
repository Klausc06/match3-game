/**
 * ScoreManager — 积分 + 连消乘数 + 地毯加成
 *
 * 职责：
 *   - 监听 board:matched、obstacle:destroyed、powerup:activated 事件
 *   - 按规则计算分数（带连消乘数）
 *   - 地毯区域消除/道具触发时，积分 ×1.2 倍
 *   - 发射 score:updated 供 UI 层更新
 *
 * 计分规则（依据 project-rules/SKILL.md 1.1 节）：
 *   基础 3 消：+100  |  4 消：+200  |  5+消：+300~500
 *   连锁每层 ×1.5 倍  |  障碍物：+150/个  |  道具波及：+50/格
 *   地毯加成：在地毯格上的消除/道具得分 ×1.2
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';
import { GameConfig as C } from '../config/GameConfig.js';

/** 地毯区域积分加成倍率 */
const CARPET_BONUS = 1.2;

export class ScoreManager {
  /**
   * @param {import('./Board.js').Board} board - 棋盘实例，用于读取 carpetGrid
   */
  constructor(board) {
    /** @type {number} 当前分数 */
    this.score = 0;
    /** @type {number} 最高连消 */
    this.maxCombo = 0;
    /** @type {number} 总消除图块数 */
    this.totalCleared = 0;
    /** @type {import('./Board.js').Board} */
    this._board = board;

    this._bindEvents();
  }

  // ── 事件绑定（只在 constructor 中调用一次） ──

  _bindEvents() {
    EventBus.on(E.BOARD_MATCHED, (data) => this._onMatch(data));
    EventBus.on(E.OBSTACLE_DESTROYED, (data) => this._onObstacleDestroyed(data));
    EventBus.on(E.POWERUP_ACTIVATED, (data) => this._onPowerUp(data));
  }

  // ── 地毯加成检查 ──

  /**
   * 检查一组 cells 中有多少在地毯上，返回加权倍率
   * 如果所有 cell 都在地毯上 → ×1.2；部分在 → 按比例混合；全不在 → ×1.0
   */
  _carpetMultiplier(cells) {
    if (!this._board?.carpetGrid || !cells || cells.length === 0) return 1;
    let onCarpet = 0;
    for (const { r, c } of cells) {
      if (r >= 0 && r < this._board.carpetGrid.length &&
          c >= 0 && c < this._board.carpetGrid[0]?.length &&
          this._board.carpetGrid[r][c]) {
        onCarpet++;
      }
    }
    if (onCarpet === 0) return 1;
    // 按地毯比例计算加成：carpetRatio * (BONUS - 1) + 1
    const ratio = onCarpet / cells.length;
    return 1 + ratio * (CARPET_BONUS - 1);
  }

  // ── 事件处理 ──

  /** 匹配消除计分 */
  _onMatch({ matches, combo }) {
    let baseScore = 0;
    const allCells = [];
    for (const match of matches) {
      const n = match.cells.length;
      if      (n === 3) baseScore += C.SCORE_MATCH_3;
      else if (n === 4) baseScore += C.SCORE_MATCH_4;
      else if (n === 5) baseScore += C.SCORE_MATCH_5;
      else if (n === 6) baseScore += C.SCORE_MATCH_6;
      else              baseScore += C.SCORE_MATCH_7_PLUS;
      allCells.push(...match.cells);
    }

    const cascadeMultiplier = Math.pow(C.CASCADE_MULTIPLIER, combo - 1);
    const carpetMul = this._carpetMultiplier(allCells);
    const amount = Math.floor(baseScore * cascadeMultiplier * carpetMul);

    this.score += amount;
    this.totalCleared += allCells.length;
    if (combo > this.maxCombo) this.maxCombo = combo;

    EventBus.emit(E.SCORE_UPDATED, { score: this.score, added: amount, combo });

    if (combo >= 2) {
      EventBus.emit(E.SCORE_COMBO, { level: combo, multiplier: cascadeMultiplier });
    }
  }

  /** 障碍物摧毁加分 */
  _onObstacleDestroyed(data) {
    let bonus = C.SCORE_OBSTACLE;
    // 如果传入了位置，检查地毯加成
    if (data?.r !== undefined && data?.c !== undefined) {
      bonus = Math.floor(bonus * this._carpetMultiplier([{ r: data.r, c: data.c }]));
    }
    this.score += bonus;
    EventBus.emit(E.SCORE_UPDATED, {
      score: this.score, added: bonus, combo: 0,
    });
  }

  /**
   * 道具引爆加分
   * 兼容两种 payload 格式：
   *   - GameLoop 发射: { type, r, c, target }
   *   - 标准格式: { affectedCells }
   */
  _onPowerUp({ affectedCells, type, r, c, target }) {
    const cells = affectedCells || (r !== undefined ? [{ r, c }] : []);
    const count = cells.length || (target ? 2 : 1);
    const baseAmount = count * C.SCORE_POWERUP_CELL;
    if (baseAmount <= 0) return;

    const carpetMul = this._carpetMultiplier(cells);
    const amount = Math.floor(baseAmount * carpetMul);

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
