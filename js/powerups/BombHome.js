import { PowerUp } from './PowerUp.js';

export class BombHome extends PowerUp {
  constructor() {
    super('home-bomb');
  }

  /**
   * 炸弹效果范围：横向 3×5 + 纵向 5×3 的叠加十字形
   * 即：以自身为中心，横向覆盖 5 列 × 3 行，纵向覆盖 3 列 × 5 行
   * 两者合并后形成一个大十字区域
   *
   * @param {number} r
   * @param {number} c
   * @param {object} board
   */
  getAffectedCells(r, c, board, targetColor = null, direction = null) {
    const set = new Set();
    const add = (row, col) => set.add(`${row},${col}`);

    // 横向 band: 5列 × 3行 (r-1..r+1, c-2..c+2)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        add(r + dr, c + dc);
      }
    }

    // 纵向 band: 3列 × 5行 (r-2..r+2, c-1..c+1)
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        add(r + dr, c + dc);
      }
    }

    return [...set].map(key => {
      const [row, col] = key.split(',').map(Number);
      return { r: row, c: col };
    });
  }
}
