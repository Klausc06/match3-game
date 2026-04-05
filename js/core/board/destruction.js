import { EventBus } from '../EventBus.js';
import { E } from '../../config/Events.js';
import { PU, basePowerUpCategory } from '../../config/PowerUpTypes.js';
import { Tile } from '../../elements/Tile.js';
import { PowerUpFactory } from '../../powerups/PowerUpFactory.js';
import { hitAdjacentObstacles } from './obstacles.js';

export function checkPowerUpInteraction(board, from, to) {
  const tileA = board.getTile(from.r, from.c);
  const tileB = board.getTile(to.r, to.c);
  if (!tileA || !tileB) return { activated: false };

  const aIsPower = Boolean(tileA.powerUp);
  const bIsPower = Boolean(tileB.powerUp);
  if (!aIsPower && !bIsPower) return { activated: false };

  let targetColor = null;
  let comboType = null;

  // 彩虹球 + 普通图块 → 获取目标颜色
  if (tileA.powerUp === PU.RAINBOW && !bIsPower && tileB.color >= 0) targetColor = tileB.color;
  if (tileB.powerUp === PU.RAINBOW && !aIsPower && tileA.color >= 0) targetColor = tileA.color;

  // 双道具组合检测
  if (aIsPower && bIsPower) {
    const types = new Set([basePowerUpCategory(tileA.powerUp), basePowerUpCategory(tileB.powerUp)]);
    const has = (...t) => t.every(x => types.has(x));

    if (has('rainbow') && types.size === 1) {
      comboType = 'rainbow+rainbow';     // 全场清除
    } else if (has('rainbow', 'bomb')) {
      comboType = 'rainbow+bomb';         // 全同色 → 炸弹
    } else if (has('rainbow', 'rocket')) {
      comboType = 'rainbow+rocket';       // 全同色 → 火箭
    } else if (has('bomb') && types.size === 1) {
      comboType = 'bomb+bomb';            // 超大爆炸 7×7
    }
    // rocket+rocket: 当前 both 模式已是十字，组合效果 = 同时开火双方向（3 行 + 3 列），
    // 暂不做特殊处理，后续需要时可扩展
  }

  return { activated: true, targetColor, comboType };
}

// _basePowerUp 已迁移至 config/PowerUpTypes.js → basePowerUpCategory()

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

/** 数值 key 编码（行×100+列），避免字符串分配 */
function _cellKey(r, c) { return r * 100 + c; }
function _fromKey(key) { return { r: (key / 100) | 0, c: key % 100 }; }

export function processDestruction(board, groups, powerUpTrigger = null) {
  const toDestroy = new Set();
  const newPowerUps = [];

  for (const group of groups) {
    for (const { r, c } of group.cells) {
      toDestroy.add(_cellKey(r, c));
    }
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

  const activeExplosions = [];
  if (powerUpTrigger) {
    const { from, to, interaction } = powerUpTrigger;
    toDestroy.add(_cellKey(from.r, from.c));
    toDestroy.add(_cellKey(to.r, to.c));

    const tA = board.getTile(from.r, from.c);
    const tB = board.getTile(to.r, to.c);
    const combo = interaction.comboType;

    if (combo === 'rainbow+rainbow') {
      // 全场清除
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          if (board.isPlayableCell(r, c) && board.getTile(r, c)) {
            toDestroy.add(_cellKey(r, c));
          }
        }
      }
    } else if (combo === 'rainbow+bomb') {
      // 全同色 → 炸弹效果：找 rainbow 配对颜色，全场该颜色格子各引爆炸弹
      const color = tA?.powerUp === PU.RAINBOW ? tB?.color : tA?.color;
      // 使用参与组合的实际炸弹类型
      const bombType = tA?.powerUp !== PU.RAINBOW ? tA?.powerUp : tB?.powerUp;
      if (color >= 0) {
        for (let r = 0; r < board.rows; r++) {
          for (let c = 0; c < board.cols; c++) {
            const t = board.getTile(r, c);
            if (t && t.color === color) {
              activeExplosions.push({ r, c, type: bombType, color: null });
              toDestroy.add(_cellKey(r, c));
            }
          }
        }
      }
    } else if (combo === 'rainbow+rocket') {
      // 全同色 → 火箭效果：该颜色格子各引爆十字火箭
      const color = tA?.powerUp === PU.RAINBOW ? tB?.color : tA?.color;
      if (color >= 0) {
        for (let r = 0; r < board.rows; r++) {
          for (let c = 0; c < board.cols; c++) {
            const t = board.getTile(r, c);
            if (t && t.color === color) {
              activeExplosions.push({ r, c, type: 'rocket', color: null });
              toDestroy.add(_cellKey(r, c));
            }
          }
        }
      }
    } else if (combo === 'bomb+bomb') {
      // 超大爆炸 5×5（半径 2）以中点为中心
      const cr = from.r, cc = from.c;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = cr + dr, nc = cc + dc;
          if (board.isPlayableCell(nr, nc)) {
            toDestroy.add(_cellKey(nr, nc));
          }
        }
      }
    } else {
      // 普通道具引爆（非特殊组合）
      if (tA && tA.powerUp) {
        activeExplosions.push({ r: from.r, c: from.c, type: tA.powerUp, color: interaction.targetColor });
      }
      if (tB && tB.powerUp) {
        activeExplosions.push({ r: to.r, c: to.c, type: tB.powerUp, color: interaction.targetColor });
      }
    }
  }

  const processedExplosions = new Set();
  let queueChanged = true;

  while (queueChanged) {
    queueChanged = false;

    const pendingPowerUps = [...toDestroy]
      .map(_fromKey)
      .filter((pt) => {
        if (processedExplosions.has(_cellKey(pt.r, pt.c))) return false;
        if (activeExplosions.some((e) => e.r === pt.r && e.c === pt.c)) return true;
        const tile = board.getTile(pt.r, pt.c);
        return Boolean(tile && tile.powerUp);
      });

    for (const pt of pendingPowerUps) {
      processedExplosions.add(_cellKey(pt.r, pt.c));

      let type;
      let targetColor = null;
      const activeRec = activeExplosions.find((e) => e.r === pt.r && e.c === pt.c);
      if (activeRec) {
        type = activeRec.type;
        targetColor = activeRec.color;
      } else {
        const tile = board.getTile(pt.r, pt.c);
        type = tile?.powerUp;
      }

      // 读取炸弹方向（从 tile 或 activeExplosions 记录中获取）
      let direction = null;
      const tileAtPt = board.getTile(pt.r, pt.c);
      if (tileAtPt?.bombDirection) direction = tileAtPt.bombDirection;

      const affected = PowerUpFactory.getAffectedCells(type, pt.r, pt.c, board, targetColor, direction);
      for (const cell of affected) {
        if (!board.isPlayableCell(cell.r, cell.c)) continue;
        const key = _cellKey(cell.r, cell.c);
        if (toDestroy.has(key)) continue;
        toDestroy.add(key);
        queueChanged = true;
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

    // ── 地毯逻辑（原版 Gardenscapes 机制）──
    // 消除已有地毯的格子 → 地毯扩散到一个相邻无毯可操作格
    // 消除没有地毯的格子 → 该格铺上地毯
    if (board.carpetGrid[r][c]) {
      const spreadTargets = ORTHO
        .map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
        .filter(pos =>
          board.isPlayableCell(pos.r, pos.c) &&
          !board.carpetGrid[pos.r][pos.c]
        );
      if (spreadTargets.length > 0) {
        // 随机选一个扩散目标（与原版随机扩散一致）
        const t = spreadTargets[board.randomInt(spreadTargets.length)];
        board.carpetGrid[t.r][t.c] = true;
      }
    } else {
      board.carpetGrid[r][c] = true;
    }

    const newPU = newPowerUps.find((p) => p.r === r && p.c === c);
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
