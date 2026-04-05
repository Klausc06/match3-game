import { PowerUp } from './PowerUp.js';

export class BombHome extends PowerUp {
  constructor() {
    super('home-bomb');
  }

  /** 横向 3×5 + 纵向 5×3 叠加十字形 */
  getAffectedCells(r, c) {
    const cells = [];
    const seen = new Set();
    const add = (row, col) => {
      const key = row * 100 + col;
      if (!seen.has(key)) { seen.add(key); cells.push({ r: row, c: col }); }
    };
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -2; dc <= 2; dc++) add(r + dr, c + dc);
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc);
    return cells;
  }
}
