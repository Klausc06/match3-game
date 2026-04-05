/**
 * Board — 棋盘数据编排层
 *
 * 职责：
 *   - 持有棋盘状态（grid/carpetGrid/maskGrid/lastSwap）
 *   - 管理统一随机源（可注入 seed）
 *   - 管理规则策略（fillMode/obstacleExpansion）
 *   - 提供统一的公开 API
 *   - 将匹配、销毁、障碍、掉落等规则委托给 board/* 子域模块
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';
import { OB, BLOCKING_OBSTACLES } from '../config/PowerUpTypes.js';
import { createSeededRandom, randomInt, shuffleInPlace } from './Random.js';
import { createNonMatchingTile, findMatches, findPossibleMoves, hasValidMoves, clearMatchFlags } from './board/matching.js';
import { processDestruction, checkPowerUpInteraction, removeSingleCell } from './board/destruction.js';
import { dropTiles, fillEmpty, shuffle } from './board/grid.js';
import { hitAdjacentObstacles } from './board/obstacles.js';

const DEFAULT_RULE_SET = Object.freeze({
  fillMode: 'top-down',
  obstacleExpansion: 'none', // 'none' (spreading obstacles removed)
});
const MAX_INIT_ATTEMPTS = 40;

export class Board {
  constructor(rows = 9, cols = 9, colorCount = 5, options = {}) {
    this.rows = rows;
    this.cols = cols;
    this.colorCount = colorCount;

    this.grid = [];
    this.carpetGrid = [];
    this.streamGrid = [];
    this.maskGrid = [];
    this.lastSwap = null;
    this.ruleSet = { ...DEFAULT_RULE_SET };



    this._seed = Number.isFinite(options.seed) ? Number(options.seed) : null;
    if (typeof options.random === 'function') {
      this._random = options.random;
    } else if (this._seed !== null) {
      this._random = createSeededRandom(this._seed);
    } else {
      this._random = Math.random;
    }
  }

  init(levelConfig = null) {
    this.maskGrid = this._buildMaskGrid(levelConfig);

    this.lastSwap = null;
    this.setRuleSet(levelConfig?.rules || null);

    this._buildStableOpening(levelConfig);

    EventBus.emit(E.BOARD_INITIALIZED, {
      rows: this.rows,
      cols: this.cols,
      grid: this.grid,
      maskGrid: this.maskGrid,
    });
  }

  _buildStableOpening(levelConfig) {
    const t0 = performance.now();
    for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt++) {
      this._populateGrid(levelConfig);
      const hasImmediateMatches = this.findMatches().length > 0;
      this.clearMatchFlags();
      const hasMoves = this.hasValidMoves();
      if (!hasImmediateMatches && hasMoves) {
        console.log(`[Board] init 成功，尝试 ${attempt} 次，耗时 ${(performance.now() - t0).toFixed(1)}ms`);
        return;
      }
    }
    console.warn(`[Board] init 达到最大尝试次数，耗时 ${(performance.now() - t0).toFixed(1)}ms，接受当前开局`);
  }

  _populateGrid(levelConfig = null) {
    this.grid = [];
    this.carpetGrid = [];

    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      this.carpetGrid[r] = [];
      this.streamGrid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = this.isPlayableCell(r, c) ? createNonMatchingTile(this, r, c) : null;
        this.carpetGrid[r][c] = false;
        this.streamGrid[r][c] = false;
      }
    }

    if (levelConfig?.obstacles) {
      for (const obs of levelConfig.obstacles) {
        // 越界校验
        if (obs.r < 0 || obs.r >= this.rows || obs.c < 0 || obs.c >= this.cols) {
          console.warn(`[Board] 障碍物越界，已跳过: r=${obs.r}, c=${obs.c}, type=${obs.type}`);
          continue;
        }
        if (!this.isPlayableCell(obs.r, obs.c)) continue;

        if (obs.type === OB.CARPET || obs.type === 'carpet') {
          this.carpetGrid[obs.r][obs.c] = true;
          continue;
        }

        if (obs.type === 'stream') {
          this.streamGrid[obs.r][obs.c] = true;
          continue;
        }

        const tile = this.getTile(obs.r, obs.c);
        if (!tile) continue;

        tile.obstacle = { type: obs.type, hp: obs.hp || 1 };

        // 纯占位障碍物：无颜色，不可移动
        if (BLOCKING_OBSTACLES.includes(obs.type)) {
          tile.color = -1;
          tile.isMovable = false;
        }
        // 果冻：覆盖层，保留底部图块颜色但不可匹配不可移动
        if (obs.type === OB.JELLY) {
          tile.isMovable = false;
        }
        // 锁链：覆盖层，保留颜色，可匹配但不可移动
        if (obs.type === OB.CHAIN) {
          tile.isMovable = false;
        }
      }
    }
  }

  _buildMaskGrid(levelConfig = null) {
    const maskGrid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => true)
    );

    if (Array.isArray(levelConfig?.mask) && Array.isArray(levelConfig.mask[0])) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const value = levelConfig.mask?.[r]?.[c];
          if (typeof value === 'boolean') {
            maskGrid[r][c] = value;
          }
        }
      }
    }

    if (Array.isArray(levelConfig?.playableCells) && levelConfig.playableCells.length > 0) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          maskGrid[r][c] = false;
        }
      }
      for (const cell of levelConfig.playableCells) {
        if (this.isInBounds(cell.r, cell.c)) {
          maskGrid[cell.r][cell.c] = true;
        }
      }
    }

    if (Array.isArray(levelConfig?.voidCells)) {
      for (const cell of levelConfig.voidCells) {
        if (this.isInBounds(cell.r, cell.c)) {
          maskGrid[cell.r][cell.c] = false;
        }
      }
    }

    return maskGrid;
  }

  getTile(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.grid[r][c];
  }

  setTile(r, c, tile) {
    if (this.isPlayableCell(r, c)) {
      this.grid[r][c] = tile;
    }
  }

  isInBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  isPlayableCell(r, c) {
    if (!this.isInBounds(r, c)) return false;
    return this.maskGrid[r]?.[c] !== false;
  }

  setRuleSet(ruleSet = null) {
    this.ruleSet = {
      ...DEFAULT_RULE_SET,
      ...(ruleSet || {}),
    };
    return this.ruleSet;
  }

  setRandomSource(randomFn) {
    if (typeof randomFn !== 'function') return;
    this._random = randomFn;
    this._seed = null;
  }

  setRandomSeed(seed) {
    this._seed = Number(seed);
    this._random = createSeededRandom(this._seed);
  }

  random() {
    return this._random();
  }

  randomInt(maxExclusive) {
    return randomInt(this._random, maxExclusive);
  }

  shuffleArrayInPlace(items) {
    return shuffleInPlace(this._random, items);
  }

  isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  swap(from, to) {
    if (!this.isPlayableCell(from.r, from.c) || !this.isPlayableCell(to.r, to.c)) return false;
    const tileA = this.getTile(from.r, from.c);
    const tileB = this.getTile(to.r, to.c);
    if (!tileA || !tileB) return false;
    if (!tileA.canSwap() || !tileB.canSwap()) return false;
    if (!this.isAdjacent(from, to)) return false;

    this.grid[from.r][from.c] = tileB;
    this.grid[to.r][to.c] = tileA;
    this.lastSwap = { from, to };
    EventBus.emit(E.BOARD_TILE_SWAPPED, { from, to });
    return true;
  }

  undoSwap(from, to) {
    const tileA = this.grid[from.r][from.c];
    const tileB = this.grid[to.r][to.c];
    this.grid[from.r][from.c] = tileB;
    this.grid[to.r][to.c] = tileA;
  }

  findMatches() {
    return findMatches(this);
  }

  processDestruction(groups, powerUpTrigger = null) {
    return processDestruction(this, groups, powerUpTrigger);
  }

  dropTiles() {
    return dropTiles(this);
  }

  fillEmpty() {
    return fillEmpty(this);
  }

  hasValidMoves() {
    return hasValidMoves(this);
  }

  findPossibleMoves() {
    return findPossibleMoves(this);
  }

  checkPowerUpInteraction(from, to) {
    return checkPowerUpInteraction(this, from, to);
  }

  shuffle() {
    return shuffle(this);
  }

  runEndTurnRules() {
    // 当前无蔓延障碍物，预留接口供未来扩展
    return null;
  }

  clearMatchFlags() {
    return clearMatchFlags(this);
  }

  removeSingleCell(r, c, options = {}) {
    return removeSingleCell(this, r, c, options);
  }
}
