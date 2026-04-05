import { EventBus } from '../EventBus.js';
import { E } from '../../config/Events.js';
import { OB, BLOCKING_OBSTACLES } from '../../config/PowerUpTypes.js';

const ORTHO_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export function hitAdjacentObstacles(board, r, c) {
  for (const [dr, dc] of ORTHO_DIRS) {
    const pos = { r: r + dr, c: c + dc };
    const tile = board.getTile(pos.r, pos.c);
    if (!tile || !tile.obstacle) continue;

    tile.obstacle.hp--;

    if (tile.obstacle.hp <= 0) {
      EventBus.emit(E.OBSTACLE_DESTROYED, {
        type: tile.obstacle.type,
        r: pos.r,
        c: pos.c,
      });

      const type = tile.obstacle.type;

      if (BLOCKING_OBSTACLES.includes(type)) {
        // 这些障碍物被破坏后整个格子清空
        board.grid[pos.r][pos.c] = null;
      } else if (type === OB.CHAIN || type === OB.JELLY) {
        // 覆盖层：去掉障碍，释放底部图块
        tile.isMovable = true;
        tile.obstacle = null;
      } else if (type === OB.ICE) {
        // 冰块破坏后释放图块
        tile.obstacle = null;
      } else {
        tile.obstacle = null;
      }
    } else {
      EventBus.emit(E.OBSTACLE_HIT, {
        type: tile.obstacle.type,
        r: pos.r,
        c: pos.c,
        remainingHP: tile.obstacle.hp,
      });
    }
  }
}
