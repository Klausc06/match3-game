/**
 * Tile - 基础图块数据类
 * 
 * 纯数据对象，表示棋盘上一个格子的状态。
 * 后续的障碍物（Ice/Box/Chain/Carpet/Suds）将通过 obstacle 属性实现，
 * 不需要继承子类——使用组合优于继承。
 * 
 * 依据: .agents/skills/architecture/SKILL.md → Tile.js 数据结构
 */

export class Tile {
  /**
   * @param {number} colorIndex - 颜色索引 (0-4)
   */
  constructor(colorIndex) {
    /** @type {number} 颜色索引 0-4 */
    this.color = colorIndex;

    /** 
     * @type {string|null} 道具类型
     * null | 'firecracker' | 'home-bomb' | 'garden-bomb' | 'dynamite' | 'tnt'
     *      | 'rocket-h' | 'rocket-v' | 'rainbow' | 'paperplane'
     * 参见 config/PowerUpTypes.js 中的 PU 常量
     */
    this.powerUp = null;

    /**
     * @type {Object|null} 障碍物信息
     * null | { type: 'ice'|'box'|'chain'|'jelly'|'carpet'|'grass'|'vase', hp: number }
     * 参见 config/PowerUpTypes.js 中的 OB 常量
     */
    this.obstacle = null;

    /** @type {boolean} 是否可以被玩家选中/交换（chain 时 false） */
    this.isMovable = true;

    /** @type {boolean} 是否已被标记为匹配（本轮将被消除） */
    this.isMatched = false;

    /** @type {boolean} 是否已被标记为待移除 */
    this.markedForRemoval = false;
  }

  /**
   * 创建一个随机颜色的图块
   * @param {number} colorCount - 颜色种类数（我们用 5）
   * @param {() => number} randomFn - 统一随机源，返回 [0,1)
   * @returns {Tile}
   */
  static random(colorCount = 5, randomFn = Math.random) {
    return new Tile(Math.floor(randomFn() * colorCount));
  }

  /**
   * 克隆当前图块（浅拷贝）
   * @returns {Tile}
   */
  clone() {
    const t = new Tile(this.color);
    t.powerUp = this.powerUp;
    t.obstacle = this.obstacle ? { ...this.obstacle } : null;
    t.isMovable = this.isMovable;
    t.isMatched = this.isMatched;
    t.markedForRemoval = this.markedForRemoval;
    return t;
  }

  /**
   * 判断是否可以参与匹配
   * - 有道具的图块仍然有颜色，可以匹配
   * - box 类型的障碍物没有颜色（不参与匹配）
   * @returns {boolean}
   */
  canMatch() {
    if (!this.obstacle) return this.color >= 0;
    // 锁链：不可移动但可以参与匹配
    if (this.obstacle.type === 'chain') return this.color >= 0;
    // 果冻/箱子/草地：不可匹配
    return false;
  }

  /**
   * 判断是否可以被交换
   * @returns {boolean}
   */
  canSwap() {
    return this.isMovable && !this.markedForRemoval;
  }
}
