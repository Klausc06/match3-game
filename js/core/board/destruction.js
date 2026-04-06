import { EventBus } from '../EventBus.js';
import { E } from '../../config/Events.js';
import { Tile } from '../../elements/Tile.js';
import { PowerUpFactory } from '../../powerups/PowerUpFactory.js';
import { hitAdjacentObstacles } from './obstacles.js';

/**
 * 检测交换是否涉及道具（不做组合，仅判断是否触发引爆）
 */
export function checkPowerUpInteraction(board, from, to) {
  const tileA = board.getTile(from.r, from.c);
  const tileB = board.getTile(to.r, to.c);
  if (!tileA || !tileB) return { activated: false };
  if (!tileA.powerUp && !tileB.powerUp) return { activated: false };
  return { activated: true };
}

export function removeSingleCell(board, r, c, options = {}) {
  const { hitAdjacent = true, emitEvent = true } = options;
  if (!board.isPlayableCell(r, c)) return null;
  const tile = board.getTile(r, c);
  if (!tile) return null;

  if (hitAdjacent) hitAdjacentObstacles(board, r, c);
  board.setTile(r, c, null);

  const removed = { r, c, color: tile.color };
  if (emitEvent) EventBus.emit(E.BOARD_REMOVED, { removed: [{ r, c }] });
  return removed;
}

function _cellKey(r, c) { return r * 100 + c; }
function _fromKey(key) { return { r: (key / 100) | 0, c: key % 100 }; }

export function processDestruction(board, groups, powerUpTrigger = null) {
  const toDestroy = new Set();
  const newPowerUps = [];

  for (const group of groups) {
    for (const { r, c } of group.cells) toDestroy.add(_cellKey(r, c));
    if (group.powerUpToSpawn && group.spawnPoint) {
      newPowerUps.push({
        type: group.powerUpToSpawn,
        r: group.spawnPoint.r,
        c: group.spawnPoint.c,
        color: board.getTile(group.cells[0].r, group.cells[0].c)?.color,
        bombDirection: group.bombDirection || null,
      });
    }
  }

  // 道具引爆（单道具，无组合）
  const activeExplosions = [];
  if (powerUpTrigger) {
    const { from, to } = powerUpTrigger;
    toDestroy.add(_cellKey(from.r, from.c));
    toDestroy.add(_cellKey(to.r, to.c));
    const tA = board.getTile(from.r, from.c);
    const tB = board.getTile(to.r, to.c);
    if (tA?.powerUp) activeExplosions.push({ r: from.r, c: from.c, type: tA.powerUp, color: null });
    if (tB?.powerUp) activeExplosions.push({ r: to.r, c: to.c, type: tB.powerUp, color: null });
  }

  // 连锁引爆：被波及的道具也会爆炸
  const processedExplosions = new Set();
  let queueChanged = true;
  while (queueChanged) {
    queueChanged = false;
    const pending = [...toDestroy].map(_fromKey).filter(pt => {
      if (processedExplosions.has(_cellKey(pt.r, pt.c))) return false;
      if (activeExplosions.some(e => e.r === pt.r && e.c === pt.c)) return true;
      const tile = board.getTile(pt.r, pt.c);
      return Boolean(tile?.powerUp);
    });

    for (const pt of pending) {
      processedExplosions.add(_cellKey(pt.r, pt.c));
      const activeRec = activeExplosions.find(e => e.r === pt.r && e.c === pt.c);
      const type = activeRec ? activeRec.type : board.getTile(pt.r, pt.c)?.powerUp;
      const tileAtPt = board.getTile(pt.r, pt.c);
      const direction = tileAtPt?.bombDirection || null;

      for (const cell of PowerUpFactory.getAffectedCells(type, pt.r, pt.c, board, null, direction)) {
        if (!board.isPlayableCell(cell.r, cell.c)) continue;
        const key = _cellKey(cell.r, cell.c);
        if (!toDestroy.has(key)) { toDestroy.add(key); queueChanged = true; }
      }
    }
  }

  const ORTHO = [[-1,0],[1,0],[0,-1],[0,1]];
  const removed = [];
  for (const key of toDestroy) {
    const { r, c } = _fromKey(key);
    const tile = board.getTile(r, c);
    if (!tile) continue;

    hitAdjacentObstacles(board, r, c);
    removed.push({ r, c, color: tile.color });

    // 地毯扩散（仅 carpetEnabled 时生效，如 home 主题）
    if (board.ruleSet.carpetEnabled) {
      if (board.carpetGrid[r][c]) {
        const targets = ORTHO
          .map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
          .filter(p => board.isPlayableCell(p.r, p.c) && !board.carpetGrid[p.r][p.c]);
        if (targets.length > 0) {
          const t = targets[board.randomInt(targets.length)];
          board.carpetGrid[t.r][t.c] = true;
        }
      } else {
        board.carpetGrid[r][c] = true;
      }
    }

    const newPU = newPowerUps.find(p => p.r === r && p.c === c);
    if (newPU) {
      const outTile = new Tile(newPU.color);
      outTile.powerUp = newPU.type;
      if (newPU.bombDirection) outTile.bombDirection = newPU.bombDirection;
      outTile.isMatched = false;
      board.grid[r][c] = outTile;
      EventBus.emit(E.POWERUP_CREATED, { type: newPU.type, r, c });
    } else {
      board.grid[r][c] = null;
    }
  }

  board.lastSwap = null;
  if (removed.length > 0) EventBus.emit(E.BOARD_REMOVED, { removed });
  return removed;
}
