import { PowerUp } from './PowerUp.js';

export class RadiusBomb extends PowerUp {
  constructor(type, radius) {
    super(type);
    this.radius = radius;
  }

  getAffectedCells(r, c) {
    const cells = [], R = this.radius;
    for (let dr = -R; dr <= R; dr++)
      for (let dc = -R; dc <= R; dc++)
        if (!(Math.abs(dr) === R && Math.abs(dc) === R))
          cells.push({ r: r + dr, c: c + dc });
    return cells;
  }
}
