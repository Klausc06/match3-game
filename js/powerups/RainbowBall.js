import { PowerUp } from './PowerUp.js';

export class RainbowBall extends PowerUp {
  constructor() { super('rainbow'); }

  getAffectedCells(r, c, board, targetColor = null) {
    if (targetColor === null) return [{ r, c }];
    const cells = [{ r, c }];
    for (let i = 0; i < board.rows; i++)
      for (let j = 0; j < board.cols; j++) {
        const tile = board.getTile(i, j);
        if (tile?.color === targetColor) cells.push({ r: i, c: j });
      }
    return cells;
  }
}
