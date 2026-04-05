import { PowerUp } from './PowerUp.js';

export class Rocket extends PowerUp {
  constructor(orientation = 'both') {
    super('rocket');
    this.orientation = orientation;
  }

  getAffectedCells(r, c, board) {
    const cells = [];
    if (this.orientation !== 'vertical')
      for (let j = 0; j < board.cols; j++) cells.push({ r, c: j });
    if (this.orientation !== 'horizontal')
      for (let i = 0; i < board.rows; i++)
        if (i !== r || this.orientation === 'vertical') cells.push({ r: i, c });
    return cells;
  }
}
