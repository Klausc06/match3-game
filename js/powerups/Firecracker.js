import { PowerUp } from './PowerUp.js';

export class Firecracker extends PowerUp {
  constructor() {
    super('firecracker');
  }

  getAffectedCells(r, c, board, targetColor = null) {
    // 花园爆竹：以自身为中心的 1格半径十字形 (+)
    return [
      { r, c },
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 }
    ];
  }
}
