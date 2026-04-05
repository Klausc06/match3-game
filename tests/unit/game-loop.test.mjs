/**
 * game-loop.test.mjs — GameLoop 流程层单元测试
 *
 * 覆盖：会话管理 / 取消安全 / hint payload / game over
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../js/core/EventBus.js';
import { E } from '../../js/config/Events.js';
import { GameConfig as C } from '../../js/config/GameConfig.js';
import { GameLoop } from '../../js/core/GameLoop.js';
import { GameState } from '../../js/core/StateMachine.js';

globalThis.requestAnimationFrame ??= (() => 0);
globalThis.cancelAnimationFrame ??= (() => {});

/* ── 共享 mock ──────────────────────────────── */

function mockSM(initial = GameState.IDLE) {
  let state = initial;
  return {
    is: s => state === s,
    transition: s => { state = s; return true; },
    get state() { return state; },
  };
}

const NOOP_RENDERER = {
  render() {},
  playSwapAnimation() {}, clearSwapAnimation() {},
  playRemoveAnimation() {}, clearRemoveAnimation() {},
  playDropAnimation() {}, clearDropAnimation() {},
  playShakeAnimation() {}, clearShakeAnimation() {},
  clearTransientAnimations() {},
};

/* ═══════ 1. 会话管理 ═══════ */

test('waitFor: 活跃会话 → resolve true', async () => {
  EventBus.clear();
  const loop = new GameLoop({}, NOOP_RENDERER, mockSM());
  loop._running = true;
  loop._sessionId = 1;
  assert.equal(await loop._waitFor(10, 1), true);
  assert.equal(loop._pendingTimeouts.size, 0);
});

test('waitFor: 会话取消 → resolve false', async () => {
  EventBus.clear();
  const loop = new GameLoop({}, NOOP_RENDERER, mockSM());
  loop._running = true;
  loop._sessionId = 2;
  const p = loop._waitFor(200, 2);
  loop.stopSession();
  assert.equal(await p, false);
});

/* ═══════ 2. game over 安全 ═══════ */

test('handleGameOver 在 processDestruction 前取消管线', async () => {
  EventBus.clear();
  let destructionCalls = 0;

  const board = {
    processDestruction() { destructionCalls++; return []; },
    dropTiles: () => [], fillEmpty() {}, findMatches: () => [],
    clearMatchFlags() {}, runEndTurnRules() {},
    hasValidMoves: () => true,
  };

  const sm = mockSM();
  const loop = new GameLoop(board, NOOP_RENDERER, sm);
  loop._running = true;
  loop.startSession();
  const sid = loop._sessionId;

  const inflight = loop._processMatches(
    [{ cells: [{ r: 0, c: 0 }], powerUpToSpawn: null }], null, sid
  );
  loop.handleGameOver();
  await inflight;

  assert.equal(sm.state, GameState.GAME_OVER);
  assert.equal(destructionCalls, 0, 'processDestruction 不应被调用');
});

/* ═══════ 3. hint 契约 ═══════ */

test('ui:hint payload 包含 { from, to, cells }', () => {
  EventBus.clear();
  const move = { from: { r: 1, c: 2 }, to: { r: 1, c: 3 } };
  const board = { findPossibleMoves: () => move };
  const loop = new GameLoop(board, NOOP_RENDERER, mockSM());
  loop._running = true;
  loop._sessionId = 1;
  loop._lastActiveTime = 0;

  let payload;
  const off = EventBus.on(E.UI_HINT, d => { payload = d; });
  loop._tick(C.HINT_IDLE_MS + 1);
  off();

  assert.deepEqual(payload, {
    from: move.from, to: move.to,
    cells: [move.from, move.to],
  });
});

test('input:active 清除 hint（空 payload）', () => {
  EventBus.clear();
  const loop = new GameLoop(
    { findPossibleMoves: () => null },
    NOOP_RENDERER, mockSM()
  );

  let payload;
  const off = EventBus.on(E.UI_HINT, d => { payload = d; });
  EventBus.emit(E.INPUT_ACTIVE, {});
  off();

  assert.deepEqual(payload, { from: null, to: null, cells: [] });
  assert.equal(loop._hintTriggered, false);
});
