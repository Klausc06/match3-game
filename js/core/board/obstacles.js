import { EventBus } from '../EventBus.js';
import { E } from '../../config/Events.js';
import { BLOCKING_OBSTACLES } from '../../config/PowerUpTypes.js';

const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function hitAdjacentObstacles(board, r, c) {
  for (const [dr, dc] of ORTHO) {
    const nr = r + dr, nc = c + dc;
    const tile = board.getTile(nr, nc);
    if (!tile?.obstacle) continue;

    tile.obstacle.hp--;

    if (tile.obstacle.hp <= 0) {
      EventBus.emit(E.OBSTACLE_DESTROYED, { type: tile.obstacle.type, r: nr, c: nc });
      if (BLOCKING_OBSTACLES.includes(tile.obstacle.type)) {
        board.grid[nr][nc] = null;
      } else {
        tile.isMovable = true;
        tile.obstacle = null;
      }
    } else {
      EventBus.emit(E.OBSTACLE_HIT, {
        type: tile.obstacle.type, r: nr, c: nc,
        remainingHP: tile.obstacle.hp,
      });
    }
  }
}
