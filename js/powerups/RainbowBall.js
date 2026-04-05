import { PowerUp } from './PowerUp.js';

export class RainbowBall extends PowerUp {
  constructor() {
    super('rainbow');
  }

  getAffectedCells(r, c, board, targetColor = null) {
    const cells = [];
    
    // 如果没有指定颜色，通常意味着彩虹球自己被莫名引爆（比如连消波及），随机选一个颜色或者清空周围？
    // 在我们这里，如果不指定颜色，我们将其 fallback 为只炸自己，或者随机炸。
    // 但是一般的机制是如果有颜色传入，则清除全盘该颜色的图块。
    if (targetColor === null) {
      cells.push({ r, c });
      return cells;
    }

    for (let i = 0; i < board.rows; i++) {
      for (let j = 0; j < board.cols; j++) {
        const tile = board.getTile(i, j);
        if (tile && tile.color === targetColor) {
           cells.push({ r: i, c: j });
        }
      }
    }
    
    // 彩虹球自己也要加上去
    cells.push({ r, c });

    return cells;
  }
}
