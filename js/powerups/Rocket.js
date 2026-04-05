import { PowerUp } from './PowerUp.js';

export class Rocket extends PowerUp {
  constructor(orientation = 'both') {
    // orientation can be 'horizontal', 'vertical', or 'both'
    // 默认我们这里给十字都炸，如果严格区分家园系统的排火箭、列火箭，这里可以细化
    super('rocket');
    this.orientation = orientation; 
  }

  getAffectedCells(r, c, board, targetColor = null) {
    const cells = [];
    
    // horizontal
    if (this.orientation === 'horizontal' || this.orientation === 'both') {
      for (let j = 0; j < board.cols; j++) {
        cells.push({ r, c: j });
      }
    }
    
    // vertical
    if (this.orientation === 'vertical' || this.orientation === 'both') {
      for (let i = 0; i < board.rows; i++) {
        // avoid duplicating the center piece if 'both'
        if (i !== r || this.orientation === 'vertical') {
          cells.push({ r: i, c });
        }
      }
    }
    
    return cells;
  }
}
