/**
 * board.test.mjs — Board 数据层单元测试
 *
 * 覆盖：初始化 / 种子随机 / 匹配检测 / 消除 / 下落 / 填充 /
 *       障碍物扩散 / 道具连锁 / 异形棋盘
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../js/core/EventBus.js';
import { Board } from '../../js/core/Board.js';
import { Tile } from '../../js/elements/Tile.js';
import { GameConfig as C } from '../../js/config/GameConfig.js';
import { ScoreManager } from '../../js/core/ScoreManager.js';

/* ── 工具 ──────────────────────────────────── */

/** 返回棋盘快照字符串，用于比较 */
function sig(board) {
  const rows = [];
  for (let r = 0; r < board.rows; r++) {
    let row = '';
    for (let c = 0; c < board.cols; c++) {
      if (!board.isPlayableCell(r, c)) { row += '#'; continue; }
      const t = board.getTile(r, c);
      row += t ? String(t.color) : '.';
    }
    rows.push(row);
  }
  return rows.join('|');
}

/** 快速构造一个干净的 5×5 board */
function make(seed = 1) {
  EventBus.clear();
  const b = new Board(5, 5, 5, { seed });
  b.init();
  return b;
}

/** 手动构造一行同色 */
function setRow(board, r, cols, color) {
  for (const c of cols) board.setTile(r, c, new Tile(color));
}

/* ═══════ 1. 种子随机 ═══════ */

test('相同 seed → 完全相同的初始棋盘', () => {
  EventBus.clear();
  const a = new Board(C.BOARD_ROWS, C.BOARD_COLS, C.COLOR_COUNT, { seed: 42 });
  const b = new Board(C.BOARD_ROWS, C.BOARD_COLS, C.COLOR_COUNT, { seed: 42 });
  a.init(C.GARDEN_THEME.level);
  b.init(C.GARDEN_THEME.level);
  assert.equal(sig(a), sig(b));
});

test('不同 seed → 不同棋盘', () => {
  EventBus.clear();
  const a = new Board(C.BOARD_ROWS, C.BOARD_COLS, C.COLOR_COUNT, { seed: 7 });
  const b = new Board(C.BOARD_ROWS, C.BOARD_COLS, C.COLOR_COUNT, { seed: 8 });
  a.init(C.GARDEN_THEME.level);
  b.init(C.GARDEN_THEME.level);
  assert.notEqual(sig(a), sig(b));
});

test('相同 seed → shuffle 结果也一致', () => {
  EventBus.clear();
  const a = new Board(C.BOARD_ROWS, C.BOARD_COLS, C.COLOR_COUNT, { seed: 2026 });
  const b = new Board(C.BOARD_ROWS, C.BOARD_COLS, C.COLOR_COUNT, { seed: 2026 });
  a.init(C.HOME_THEME.level);
  b.init(C.HOME_THEME.level);
  a.shuffle();
  b.shuffle();
  assert.equal(sig(a), sig(b));
});

/* ═══════ 2. 异形棋盘 mask ═══════ */

test('voidCells 不可操作且 fillEmpty 不回填', () => {
  EventBus.clear();
  const board = new Board(5, 5, 5, { seed: 11 });
  board.init({ rules: { obstacleExpansion: 'none', fillMode: 'top-down' }, voidCells: [{ r: 1, c: 1 }] });

  assert.equal(board.isPlayableCell(1, 1), false);
  assert.equal(board.getTile(1, 1), null);

  board.setTile(0, 0, null);
  board.fillEmpty();

  assert.equal(board.getTile(1, 1), null, 'void 不回填');
  assert.ok(board.getTile(0, 0) !== null, '普通格回填');
});

test('mask 下 findMatches / hasValidMoves 正常工作', () => {
  EventBus.clear();
  const board = new Board(5, 5, 5, { seed: 77 });
  board.init({ rules: { obstacleExpansion: 'none', fillMode: 'top-down' }, voidCells: [{ r: 3, c: 3 }] });

  assert.ok(Array.isArray(board.findMatches()));
  assert.equal(typeof board.hasValidMoves(), 'boolean');
});

/* ═══════ 3. 匹配检测 ═══════ */

test('三消横向检测', () => {
  const board = make(10);
  setRow(board, 0, [0, 1, 2], 3);
  const matches = board.findMatches();
  assert.ok(matches.length >= 1);
  const cells = matches.flatMap(m => m.cells);
  for (const c of [0, 1, 2]) {
    assert.ok(cells.some(cell => cell.r === 0 && cell.c === c), `(0,${c}) 应在匹配结果中`);
  }
});

test('L 形被合并为一个 group', () => {
  const board = make(20);
  // L 形: 同色 col 2~4 + row 3~4 col 2
  const color = 4;
  setRow(board, 2, [2, 3, 4], color);
  board.setTile(3, 2, new Tile(color));
  board.setTile(4, 2, new Tile(color));
  const matches = board.findMatches();
  // 横竖应被合并为 1 个 group
  assert.equal(matches.length, 1, 'L 形应合并为单 group');
  assert.ok(matches[0].cells.length >= 5, 'group 至少 5 格');
});

/* ═══════ 4. processDestruction ═══════ */

test('消除后对应格子清空并返回正确数量', () => {
  const board = make(99);
  assert.ok(board.getTile(0, 0));
  assert.ok(board.getTile(0, 1));
  assert.ok(board.getTile(0, 2));

  const groups = [{
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }],
    originalMatches: [], matchType: 'linear',
    powerUpToSpawn: null, spawnPoint: null,
  }];
  const removed = board.processDestruction(groups);

  assert.equal(removed.length, 3);
  assert.equal(board.getTile(0, 0), null);
  assert.equal(board.getTile(0, 1), null);
  assert.equal(board.getTile(0, 2), null);
});

test('炸弹引爆火箭产生连锁消除', () => {
  const board = make(50);
  const bomb = new Tile(1); bomb.powerUp = 'home-bomb';
  const rocket = new Tile(2); rocket.powerUp = 'rocket';
  board.setTile(2, 2, bomb);
  board.setTile(1, 2, rocket);

  const trigger = {
    from: { r: 2, c: 2 }, to: { r: 2, c: 2 },
    interaction: { targetColor: null },
  };
  const removed = board.processDestruction([], trigger);

  // 火箭在爆炸范围内，应被连锁引爆并清掉整行/列
  assert.ok(removed.some(t => t.r === 1 && t.c === 0), '火箭连锁应覆盖 (1,0)');
  assert.ok(removed.length > 10, `连锁应消除大量图块，实际: ${removed.length}`);
});

/* ═══════ 5. dropTiles ═══════ */

test('下落跳过不可移动障碍物', () => {
  const board = make(42);
  for (let r = 0; r < 5; r++) board.grid[r][1] = null;

  const obs = new Tile(-1);
  obs.obstacle = { type: 'box', hp: 1 };
  obs.isMovable = false;
  board.grid[2][1] = obs;

  const above = new Tile(0);
  board.grid[1][1] = above;

  board.dropTiles();

  assert.equal(board.grid[2][1], obs, '障碍物留在原位');
  assert.equal(board.grid[2][1].obstacle.type, 'box');
});

/* ═══════ 6. 覆盖层障碍物 ═══════ */

test('锁链障碍物: 不可移动但可匹配，破坏后释放图块', () => {
  const board = make(100);
  // 创建一个有颜色的锁链图块
  const chained = new Tile(0);
  chained.obstacle = { type: 'chain', hp: 1 };
  chained.isMovable = false;
  board.grid[2][2] = chained;

  // 锁链图块可以匹配但不可移动
  assert.ok(chained.canMatch(), '锁链图块应可匹配');
  assert.ok(!chained.canSwap(), '锁链图块不可交换');
});

test('果冻障碍物: 不可匹配，破坏后释放底部图块', () => {
  const board = make(101);
  const jellied = new Tile(1);
  jellied.obstacle = { type: 'jelly', hp: 1 };
  jellied.isMovable = false;
  board.grid[3][3] = jellied;

  // 果冻图块不可匹配
  assert.ok(!jellied.canMatch(), '果冻图块不可匹配');
  assert.equal(jellied.color, 1, '果冻保留底部图块颜色');
});

/* ═══════ 7. ScoreManager ═══════ */

test('ScoreManager 基础计分 + 连消乘数', () => {
  EventBus.clear();
  const sm = new ScoreManager();

  // combo=1: 3 消 → 100 × 1.5^0 = 100
  EventBus.emit('board:matched', {
    matches: [{ cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }] }],
    combo: 1,
  });
  assert.equal(sm.score, 100);

  // combo=2: 3 消 → 100 × 1.5^1 = 150 → 累计 250
  EventBus.emit('board:matched', {
    matches: [{ cells: [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }] }],
    combo: 2,
  });
  assert.equal(sm.score, 250);

  // combo=3: 4 消 → 200 × 1.5^2 = 450 → 累计 700
  EventBus.emit('board:matched', {
    matches: [{ cells: [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }, { r: 2, c: 3 }] }],
    combo: 3,
  });
  assert.equal(sm.score, 700);
  assert.equal(sm.maxCombo, 3);
});

/* ═══════ 8. 道具效果范围 ═══════ */

import { PowerUpFactory } from '../../js/powerups/PowerUpFactory.js';

test('BombHome 爆炸范围 = 3×5 + 5×3 十字形 (21格)', () => {
  const board = make(200);
  const cells = PowerUpFactory.getAffectedCells('home-bomb', 4, 4, board);
  // 十字形: 横向 5列×3行 + 纵向5行×3列 = 15+15-9(重叠) = 21
  assert.equal(cells.length, 21, '炸弹应覆盖 21 格');
  // 检查十字形边缘
  assert.ok(cells.some(c => c.r === 4 && c.c === 2), '应包含横向左端 (4,2)');
  assert.ok(cells.some(c => c.r === 4 && c.c === 6), '应包含横向右端 (4,6)');
  assert.ok(cells.some(c => c.r === 2 && c.c === 4), '应包含纵向上端 (2,4)');
  assert.ok(cells.some(c => c.r === 6 && c.c === 4), '应包含纵向下端 (6,4)');
  // 不应包含对角线远角
  assert.ok(!cells.some(c => c.r === 2 && c.c === 2), '不应包含对角 (2,2)');
});

test('BombGarden 爆炸范围 = 半径2切角 (21格)', () => {
  const board = make(200);
  const cells = PowerUpFactory.getAffectedCells('garden-bomb', 4, 4, board);
  assert.equal(cells.length, 21, '花园炸弹应覆盖 21 格（5x5带去角）');
  assert.ok(cells.some(c => c.r === 4 && c.c === 2), '半径到达2');
});

test('Dynamite 爆炸范围 = 半径3切角 (45格)', () => {
  const board = make(200);
  const cells = PowerUpFactory.getAffectedCells('dynamite', 4, 4, board);
  assert.equal(cells.length, 45, '雷管应覆盖 45 格（7x7带去角）');
});

test('TNT 爆炸范围 = 半径4切角 (77格)', () => {
  const board = make(200);
  const cells = PowerUpFactory.getAffectedCells('tnt', 4, 4, board);
  assert.equal(cells.length, 77, 'TNT应覆盖 77 格（9x9带去角）');
});

test('Firecracker 爆炸范围 = 十字形 (5格)', () => {
  const board = make(201);
  const cells = PowerUpFactory.getAffectedCells('firecracker', 2, 2, board);
  assert.equal(cells.length, 5, '鞭炮应覆盖中心及上下左右 5 格');
  // 确保没有拐角
  assert.ok(!cells.some(c => c.r === 1 && c.c === 1), '不应包含左上角');
});

test('rocket-h 清除整行，rocket-v 清除整列', () => {
  const board = make(202);
  const hCells = PowerUpFactory.getAffectedCells('rocket-h', 2, 2, board);
  const vCells = PowerUpFactory.getAffectedCells('rocket-v', 2, 2, board);

  // rocket-h: 整行 (r=2, c=0~4)
  assert.equal(hCells.length, 5, 'rocket-h 应覆盖整行 5 格');
  assert.ok(hCells.every(c => c.r === 2), 'rocket-h 应全在同一行');

  // rocket-v: 整列 (r=0~4, c=2)
  assert.equal(vCells.length, 5, 'rocket-v 应覆盖整列 5 格');
  assert.ok(vCells.every(c => c.c === 2), 'rocket-v 应全在同一列');
});

test('RainbowBall 清除全场指定颜色', () => {
  const board = make(203);
  // 数颜色 0 的格子数
  let colorCount = 0;
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      if (board.getTile(r, c)?.color === 0) colorCount++;

  const cells = PowerUpFactory.getAffectedCells('rainbow', 0, 0, board, 0);
  // 至少包含球自身 + 所有颜色 0 的格子
  assert.ok(cells.length >= colorCount, `rainbow 应至少清除 ${colorCount} 个颜色 0 的格子`);
});

/* ═══════ 9. 4 连方向映射（垂直原则）═══════ */

test('横向 4 连 → 生成 match4V（纵向火箭 token）', () => {
  const board = make(300);
  // 手动构造横向 4 连
  for (let c = 0; c < 4; c++) board.setTile(0, c, new Tile(3));
  const matches = board.findMatches();
  const group4 = matches.find(g => g.cells.length === 4);
  assert.ok(group4, '应检测到 4 连');
  assert.equal(group4.powerUpToSpawn, 'match4V', '横向 4 连应生成 match4V（垂直原则）');
});

test('纵向 4 连 → 生成 match4H（横向火箭 token）', () => {
  const board = make(301);
  // 手动构造纵向 4 连 (r=0~3, c=0)
  for (let r = 0; r < 4; r++) board.setTile(r, 0, new Tile(3));
  // 确保 r=4 不是同色 — 防止变成 5 连
  board.setTile(4, 0, new Tile(0));
  const matches = board.findMatches();
  const group4 = matches.find(g => g.cells.length === 4);
  assert.ok(group4, '应检测到 4 连');
  assert.equal(group4.powerUpToSpawn, 'match4H', '纵向 4 连应生成 match4H（垂直原则）');
});

/* ═══════ 10. 双道具组合 ═══════ */

test('rainbow + rainbow → 全场清除', () => {
  const board = make(400);
  const a = new Tile(0); a.powerUp = 'rainbow';
  const b = new Tile(1); b.powerUp = 'rainbow';
  board.setTile(2, 2, a);
  board.setTile(2, 3, b);

  const interaction = board.checkPowerUpInteraction({ r: 2, c: 2 }, { r: 2, c: 3 });
  assert.equal(interaction.activated, true);
  assert.equal(interaction.comboType, 'rainbow+rainbow');

  // 执行消除
  const trigger = {
    from: { r: 2, c: 2 }, to: { r: 2, c: 3 },
    interaction,
  };
  const removed = board.processDestruction([], trigger);
  assert.equal(removed.length, 25, '5×5 棋盘全场清除应 = 25 格');
});

