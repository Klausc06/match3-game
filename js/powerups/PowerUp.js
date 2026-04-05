/**
 * PowerUp Base Class
 * 控制道具的作用范围计算。
 * 这是所有具体道具（Bomb, Rocket 等）的基类。
 */
export class PowerUp {
  constructor(type) {
    this.type = type;
  }

  /**
   * 必须被子类覆盖。返回爆炸覆盖的格子坐标组成的数组。
   * 注意：这些坐标只计算理论范围，不判断格子是否超出边界，边界校验由 Board 负责。
   * @param {number} r - 基础行坐标
   * @param {number} c - 基础列坐标
   * @param {import('../core/Board.js').Board} board - 棋盘引用，用于行列长度计算及特殊寻路
   * @param {number|null} targetColor - 如果有目标颜色（如彩虹球），传入此参数
   * @returns {Array<{r:number, c:number}>}
   */
  getAffectedCells(r, c, board, targetColor = null) {
    return [];
  }
}
