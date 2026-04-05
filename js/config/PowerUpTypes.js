/**
 * PowerUpTypes — 道具类型常量
 *
 * 所有道具类型字符串集中在此定义，杜绝散落在各文件中的魔法字符串。
 * 任何新增/重命名道具类型，只需改这一个文件。
 *
 * 用法:
 *   import { PU, basePowerUpCategory } from '../config/PowerUpTypes.js';
 *   if (type === PU.RAINBOW) { ... }
 */

export const PU = Object.freeze({
  // ── 炸弹系 ──
  FIRECRACKER:  'firecracker',   // 1-tile radius cross (花园)
  HOME_BOMB:    'home-bomb',     // 2-tile radius (家园)
  GARDEN_BOMB:  'garden-bomb',   // 2-tile radius (花园)
  DYNAMITE:     'dynamite',      // 3-tile radius (花园)
  TNT:          'tnt',           // 4-tile radius (花园)

  // ── 火箭系 ──
  ROCKET_H:     'rocket-h',      // 横向火箭（清整行）
  ROCKET_V:     'rocket-v',      // 纵向火箭（清整列）

  // ── 特殊系 ──
  RAINBOW:      'rainbow',       // 彩虹球（清一色）
  PAPERPLANE:   'paperplane',    // 纸飞机（飞向随机目标）
});

/**
 * 障碍物类型常量
 */
export const OB = Object.freeze({
  ICE:     'ice',
  BOX:     'box',
  CHAIN:   'chain',
  CARPET:  'carpet',
  JELLY:   'jelly',
  GRASS:   'grass',
  VASE:    'vase',
});

/**
 * 将具体道具类型归一化为基础类别（用于组合检测）
 *
 * - rocket-h / rocket-v  → 'rocket'
 * - home-bomb / garden-bomb / dynamite / tnt → 'bomb'
 * - 其余返回原值
 *
 * @param {string} type - 具体道具类型
 * @returns {string} 归一化后的基础类别
 */
export function basePowerUpCategory(type) {
  switch (type) {
    case PU.ROCKET_H:
    case PU.ROCKET_V:
      return 'rocket';

    case PU.HOME_BOMB:
    case PU.GARDEN_BOMB:
    case PU.DYNAMITE:
    case PU.TNT:
    case PU.FIRECRACKER:
      return 'bomb';

    default:
      return type;
  }
}

/**
 * 占位型障碍物（无颜色、不可移动）
 */
export const BLOCKING_OBSTACLES = Object.freeze([OB.BOX, OB.GRASS, OB.VASE]);
