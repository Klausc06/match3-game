/**
 * GameLoop — requestAnimationFrame 主循环 + 可取消回合会话
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';
import { GameConfig as C } from '../config/GameConfig.js';
import { GameState } from './StateMachine.js';
import { PaperPlane } from '../powerups/PaperPlane.js';
import { AnimSystem } from './AnimationSystem.js';

export class GameLoop {
  constructor(board, renderer, stateMachine, timerManager = null) {
    this.board = board;
    this.renderer = renderer;
    this.stateMachine = stateMachine;
    this.timerManager = timerManager;

    this.themeConfig = C.GARDEN_THEME;

    this._rafId = null;
    this._running = false;
    this._comboCount = 0;
    this._lastActiveTime = 0;
    this._hintTriggered = false;
    this._sessionId = 0;
    this._pendingTimeouts = new Map();

    this._bindEvents();
  }

  setTimerManager(timerManager) {
    this.timerManager = timerManager;
  }

  setTheme(themeConfig) {
    this.themeConfig = themeConfig;
  }

  _bindEvents() {
    EventBus.on(E.INPUT_SWAP, (data) => this._handleSwap(data));
    EventBus.on(E.INPUT_TAP_POWERUP, (data) => this._handleTapPowerUp(data));
    EventBus.on(E.INPUT_ACTIVE, () => {
      this._lastActiveTime = performance.now();
      this._hintTriggered = false;
      EventBus.emit(E.UI_HINT, { from: null, to: null, cells: [] });
    });
  }

  startSession() {
    this._sessionId += 1;
    return this._sessionId;
  }

  stopSession() {
    this._running = false;
    this._sessionId += 1;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    for (const [timeoutId, resolve] of this._pendingTimeouts.entries()) {
      clearTimeout(timeoutId);
      resolve(false);
    }
    this._pendingTimeouts = new Map();
    this.renderer.clearTransientAnimations();
  }

  _isSessionActive(sessionId) {
    return this._running
      && this._sessionId === sessionId
      && !this.stateMachine.is(GameState.GAME_OVER);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._comboCount = 0;
    this._lastActiveTime = performance.now();
    this._hintTriggered = false;
    this.startSession();
    this.renderer.clearTransientAnimations();
    this._tick(performance.now());
  }

  stop() {
    this.stopSession();
  }

  _tick(timestamp = performance.now()) {
    if (!this._running) return;
    const sessionId = this._sessionId;

    if (this.stateMachine.is(GameState.IDLE)) {
      if (!this._hintTriggered && timestamp - this._lastActiveTime > C.HINT_IDLE_MS) {
        const hintMove = this.board.findPossibleMoves();
        if (hintMove) {
          EventBus.emit(E.UI_HINT, {
            from: hintMove.from,
            to: hintMove.to,
            cells: [hintMove.from, hintMove.to],
          });
          this._hintTriggered = true;
        }
      }
    } else {
      this._lastActiveTime = timestamp;
      this._hintTriggered = false;
    }

    // 单一 RAF 循环驱动定时器，保证时间戳一致
    if (this.timerManager) this.timerManager.tick(timestamp);

    this.renderer.render(timestamp);
    this._rafId = requestAnimationFrame((ts) => {
      if (this._sessionId !== sessionId) return;
      this._tick(ts);
    });
  }

  _waitFor(duration, sessionId) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this._pendingTimeouts.delete(timeoutId);
        resolve(this._isSessionActive(sessionId));
      }, duration);
      this._pendingTimeouts.set(timeoutId, resolve);
    });
  }

  async _playAnimationStep({
    animation,
    playMethod,
    clearMethod,
    duration,
    sessionId,
    playArgs = [],
  }) {
    this.renderer[playMethod](animation, ...playArgs);
    const ok = await this._waitFor(duration, sessionId);
    this.renderer[clearMethod]();
    return ok;
  }

  async _handleSwap({ from, to }) {
    const sessionId = this._sessionId;
    try {
      if (!this.stateMachine.is(GameState.IDLE)) return;
      if (!this._isSessionActive(sessionId)) return;

      if (!this.board.isInBounds(from.r, from.c) || !this.board.isInBounds(to.r, to.c)) return;
      const tileA = this.board.getTile(from.r, from.c);
      const tileB = this.board.getTile(to.r, to.c);
      if (!tileA || !tileB || !tileA.canSwap() || !tileB.canSwap()) return;
      if (!this.board.isAdjacent(from, to)) return;

      this.stateMachine.transition(GameState.SWAP_ANIM);
      this._comboCount = 0;
      this.board.swap(from, to);

      const swapAnim = AnimSystem.swap(from, to, to, from);
      const swapOk = await this._playAnimationStep({
        animation: swapAnim,
        playMethod: 'playSwapAnimation',
        clearMethod: 'clearSwapAnimation',
        duration: C.SWAP_DURATION,
        sessionId,
        playArgs: [from, to],
      });
      if (!swapOk) return;

      if (!this._isSessionActive(sessionId)) return;
      this.stateMachine.transition(GameState.MATCHING);

      const puInteraction = this.board.checkPowerUpInteraction(from, to);
      const matches = this.board.findMatches();

      if (matches.length > 0 || puInteraction.activated) {
        const trigger = puInteraction.activated ? { from, to, interaction: puInteraction } : null;
        await this._processMatches(matches, trigger, sessionId);
      } else {
        this.board.undoSwap(from, to);
        EventBus.emit(E.INPUT_INVALID_SWAP, { from, to });

        const shakeAnim = AnimSystem.invalidShake(from);
        const shakeOk = await this._playAnimationStep({
          animation: shakeAnim,
          playMethod: 'playShakeAnimation',
          clearMethod: 'clearShakeAnimation',
          duration: C.INVALID_SWAP_DURATION,
          sessionId,
          playArgs: [from],
        });
        if (!shakeOk) return;

        if (this._isSessionActive(sessionId)) {
          this.stateMachine.transition(GameState.IDLE);
        }
      }
    } catch (err) {
      console.error('[GameLoop] _handleSwap 异常:', err);
      console.error(err.stack);
      this.renderer.clearTransientAnimations();
      if (this._isSessionActive(sessionId)) {
        this.stateMachine.transition(GameState.IDLE);
      }
    }
  }

  /**
   * 单击激活道具：原地引爆，无需交换
   */
  async _handleTapPowerUp({ pos }) {
    const sessionId = this._sessionId;
    try {
      if (!this.stateMachine.is(GameState.IDLE)) return;
      if (!this._isSessionActive(sessionId)) return;

      const tile = this.board.getTile(pos.r, pos.c);
      if (!tile || !tile.powerUp) return;

      this.stateMachine.transition(GameState.MATCHING);
      this._comboCount = 0;

      // 构造一个合成的 powerUpTrigger — 原地引爆
      const trigger = {
        from: pos,
        to: pos,
        interaction: { activated: true, targetColor: null, comboType: null },
      };

      EventBus.emit(E.POWERUP_ACTIVATED, { type: tile.powerUp, r: pos.r, c: pos.c });
      await this._processMatches([], trigger, sessionId);
    } catch (err) {
      console.error('[GameLoop] _handleTapPowerUp 异常:', err);
      this.renderer.clearTransientAnimations();
      if (this._isSessionActive(sessionId)) {
        this.stateMachine.transition(GameState.IDLE);
      }
    }
  }

  async _processMatches(matches, powerUpTrigger = null, sessionId = this._sessionId) {
    try {
      if (!this._isSessionActive(sessionId)) return;
      this._comboCount++;

      for (const group of matches) {
        if (group.powerUpToSpawn === 'match4H') {
          group.powerUpToSpawn = this.themeConfig.powerUps.match4H || null;
        } else if (group.powerUpToSpawn === 'match4V') {
          group.powerUpToSpawn = this.themeConfig.powerUps.match4V || null;
        } else if (group.powerUpToSpawn === 'match4Square') {
          group.powerUpToSpawn = this.themeConfig.powerUps.match4Square || null;
        } else if (group.powerUpToSpawn === 'match5LT') {
          group.powerUpToSpawn = this.themeConfig.powerUps.match5LT || null;
        } else if (group.powerUpToSpawn === 'match6LT') {
          group.powerUpToSpawn = this.themeConfig.powerUps.match6LT || this.themeConfig.powerUps.match5LT || null;
        } else if (group.powerUpToSpawn === 'match7LT') {
          group.powerUpToSpawn = this.themeConfig.powerUps.match7LT || this.themeConfig.powerUps.match6LT || this.themeConfig.powerUps.match5LT || null;
        } else if (group.powerUpToSpawn === 'match5Line') {
          group.powerUpToSpawn = this.themeConfig.powerUps.match5Line || null;
        }
      }

      EventBus.emit(E.BOARD_MATCHED, {
        matches,
        combo: this._comboCount,
        powerUpTrigger,
      });

      this.stateMachine.transition(GameState.REMOVE_ANIM);

      const allRemovedCells = [];
      for (const g of matches) {
        for (const cell of g.cells || []) {
          allRemovedCells.push({ r: cell.r, c: cell.c });
        }
      }

      const removeAnim = AnimSystem.remove(allRemovedCells);
      const removeOk = await this._playAnimationStep({
        animation: removeAnim,
        playMethod: 'playRemoveAnimation',
        clearMethod: 'clearRemoveAnimation',
        duration: C.REMOVE_DURATION,
        sessionId,
      });
      if (!removeOk) return;

      if (!this._isSessionActive(sessionId)) return;
      this.board.processDestruction(matches, powerUpTrigger);
      this._applyPaperPlaneEffects(matches);

      this.stateMachine.transition(GameState.DROP_ANIM);
      const drops = this.board.dropTiles();

      const dropAnim = AnimSystem.drop(drops);
      const maxDist = drops.reduce((max, d) => Math.max(max, d.to.r - d.from.r), 0);
      const dropDuration = Math.max(maxDist * C.DROP_DURATION_PER_CELL, 100);
      const dropOk = await this._playAnimationStep({
        animation: dropAnim,
        playMethod: 'playDropAnimation',
        clearMethod: 'clearDropAnimation',
        duration: dropDuration,
        sessionId,
      });
      if (!dropOk) return;

      if (!this._isSessionActive(sessionId)) return;
      this.stateMachine.transition(GameState.REFILL);
      this.board.fillEmpty();

      const settleOk = await this._waitFor(C.REFILL_SETTLE_DELAY, sessionId);
      if (!settleOk) return;

      if (!this._isSessionActive(sessionId)) return;
      this.stateMachine.transition(GameState.MATCHING);
      const newMatches = this.board.findMatches();

      if (newMatches.length > 0) {
        await this._processMatches(newMatches, null, sessionId);
        return;
      }

      this.board.clearMatchFlags();
      this.board.runEndTurnRules();

      // ── 溪流移动：整个回合结束后，溪流路径上图块沿方向移动一格 ──
      if (!this._isSessionActive(sessionId)) return;
      const streamMoves = this.board.applyStreamFlow();
      if (streamMoves.length > 0) {
        await this._waitFor(200, sessionId);
        if (!this._isSessionActive(sessionId)) return;

        // 溪流移动后检查是否产生新匹配
        const streamMatches = this.board.findMatches();
        if (streamMatches.length > 0) {
          await this._processMatches(streamMatches, null, sessionId);
          return;
        }
        this.board.clearMatchFlags();
      }

      if (!this.board.hasValidMoves()) {
        this.stateMachine.transition(GameState.SHUFFLE);
        this.board.shuffle();
        EventBus.emit(E.BOARD_NO_MATCHES);
      }
      if (this._isSessionActive(sessionId)) {
        this.stateMachine.transition(GameState.IDLE);
      }
    } catch (err) {
      console.error('[GameLoop] _processMatches 异常:', err);
      console.error(err.stack);
      this.renderer.clearTransientAnimations();
      if (this._isSessionActive(sessionId)) {
        this.stateMachine.transition(GameState.IDLE);
      }
    }
  }

  /**
   * 同步执行纸飞机飞行效果（在 processDestruction 之后、dropTiles 之前）
   * 十字消除已由 getAffectedCells 在 processDestruction 中处理，
   * 此方法只负责飞行到目标并消除降落点。
   */
  _applyPaperPlaneEffects(matches) {
    for (const group of matches) {
      if (group.powerUpToSpawn !== 'paperplane' || !group.spawnPoint) continue;
      const { r, c } = group.spawnPoint;
      const target = PaperPlane.findTarget(r, c, this.board);
      if (!target) continue;

      // 添加飞行轨迹特效
      this.renderer.addPlaneTrail({ r, c }, target);

      const removed = this.board.removeSingleCell(target.r, target.c, {
        hitAdjacent: true,
        emitEvent: true,
      });
      if (!removed) continue;
      EventBus.emit(E.POWERUP_ACTIVATED, {
        type: 'paperplane',
        r,
        c,
        target,
        affectedCells: [{ r: target.r, c: target.c }],
      });
    }
  }

  handleGameOver() {
    this.stateMachine.transition(GameState.GAME_OVER);
    this.stopSession();
  }
}
