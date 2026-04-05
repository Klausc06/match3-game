export const PU = Object.freeze({
  FIRECRACKER:  'firecracker',
  HOME_BOMB:    'home-bomb',
  GARDEN_BOMB:  'garden-bomb',
  DYNAMITE:     'dynamite',
  TNT:          'tnt',
  ROCKET_H:     'rocket-h',
  ROCKET_V:     'rocket-v',
  RAINBOW:      'rainbow',
  PAPERPLANE:   'paperplane',
});

export const OB = Object.freeze({
  ICE:     'ice',
  BOX:     'box',
  CHAIN:   'chain',
  CARPET:  'carpet',
  JELLY:   'jelly',
  GRASS:   'grass',
  VASE:    'vase',
});

/** 占位型障碍物（无颜色、不可移动、破坏后清空格子） */
export const BLOCKING_OBSTACLES = Object.freeze([OB.BOX, OB.GRASS, OB.VASE]);
