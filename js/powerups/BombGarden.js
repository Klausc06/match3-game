import { PowerUp } from './PowerUp.js';

export class BombGarden extends PowerUp {
  constructor() {
    super('garden-bomb');
  }

  getAffectedCells(r, c, board, targetColor = null, direction = null) {
    const cells = [];
    const radius = 2;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        // 切除四角 (如果行列绝对值同时等于半径，则是角)
        if (Math.abs(dr) === radius && Math.abs(dc) === radius) continue;
        cells.push({ r: r + dr, c: c + dc });
      }
    }
    return cells;
  }
}
