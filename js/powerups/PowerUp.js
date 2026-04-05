export class PowerUp {
  constructor(type) { this.type = type; }
  getAffectedCells(r, c, board, targetColor = null) { return []; }
}
