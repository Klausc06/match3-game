/**
 * PaperPlane — 纸飞机道具 (Homescapes 专属)
 *
 * 机制：
 *   1. 由 4 个图块组成 2×2 方形匹配生成
 *   2. 激活时消除以自身为中心的十字格（上下左右 + 自身）
 *   3. 飞向优先级最高的目标格子并将其消除
 *      优先级：① 障碍物格 > ② 未铺地毯的格 > ③ 随机格
 *
 * getAffectedCells 返回十字范围（起飞爆炸区域）。
 * 飞行目标通过 findTarget() 暴露，由 GameLoop 在动画层面处理。
 */

import { PowerUp } from './PowerUp.js';

export class PaperPlane extends PowerUp {
  constructor() {
    super('paperplane');
  }

  /**
   * 起飞消除：以自身为中心的十字格
   */
  getAffectedCells(r, c, board) {
    const cells = [{ r, c }]; // 自身
    // 十字：上下左右
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (board.isPlayableCell(nr, nc)) {
        cells.push({ r: nr, c: nc });
      }
    }
    return cells;
  }

  /**
   * 找到本次飞行的目标格子
   * 优先级：障碍物 > 未铺地毯的格子 > 随机格
   */
  static findTarget(r, c, board) {
    const candidates = { obstacle: [], uncarpet: [], other: [] };

    for (let row = 0; row < board.rows; row++) {
      for (let col = 0; col < board.cols; col++) {
        if (row === r && col === c) continue; // 排除自身
        // 排除十字范围内（已经被起飞消除了）
        if ((row === r && Math.abs(col - c) <= 1) ||
            (col === c && Math.abs(row - r) <= 1)) continue;

        const tile = board.getTile(row, col);
        if (!tile) continue;

        if (tile.obstacle) {
          candidates.obstacle.push({ r: row, c: col });
        } else if (board.carpetGrid && !board.carpetGrid[row][col]) {
          candidates.uncarpet.push({ r: row, c: col });
        } else {
          candidates.other.push({ r: row, c: col });
        }
      }
    }

    const pick = (arr) => arr[board.randomInt(arr.length)];
    if (candidates.obstacle.length > 0) return pick(candidates.obstacle);
    if (candidates.uncarpet.length > 0) return pick(candidates.uncarpet);
    if (candidates.other.length > 0) return pick(candidates.other);
    return null;
  }
}
