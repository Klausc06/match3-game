/**
 * Tile - 基础图块数据类
 *
 * 纯数据对象，表示棋盘上一个格子的状态。
 * 障碍物通过 obstacle 属性实现（组合优于继承）。
 */
export class Tile {
  constructor(colorIndex) {
    this.color = colorIndex;
    this.powerUp = null;
    this.obstacle = null;
    this.isMovable = true;
    this.isMatched = false;
  }

  static random(colorCount = 5, randomFn = Math.random) {
    return new Tile(Math.floor(randomFn() * colorCount));
  }

  clone() {
    const t = new Tile(this.color);
    t.powerUp = this.powerUp;
    t.obstacle = this.obstacle ? { ...this.obstacle } : null;
    t.isMovable = this.isMovable;
    t.isMatched = this.isMatched;
    return t;
  }

  canMatch() {
    if (!this.obstacle) return this.color >= 0;
    if (this.obstacle.type === 'chain') return this.color >= 0;
    return false;
  }

  canSwap() {
    return this.isMovable;
  }
}
