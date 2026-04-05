/**
 * GameConfig — 全局游戏配置常量
 *
 * 所有 magic number 集中在此文件管理。
 * 各模块通过 import { GameConfig } from '../config/GameConfig.js' 引用。
 * 修改任何数值只需编辑本文件，无需搜索散落在各处的硬编码。
 */

import { PU } from './PowerUpTypes.js';

export const GameConfig = Object.freeze({

  // ── 棋盘 ──
  BOARD_ROWS:   12,
  BOARD_COLS:   12,
  COLOR_COUNT:  5,

  // ── 计时 ──
  GAME_DURATION:     80,   // 秒
  WARNING_THRESHOLD: 10,   // 剩余 ≤ 此值时触发警告

  // ── 计分规则（依据 project-rules/SKILL.md 1.1 节） ──
  SCORE_MATCH_3:      100,
  SCORE_MATCH_4:      200,
  SCORE_MATCH_5:      300,
  SCORE_MATCH_6:      400,
  SCORE_MATCH_7_PLUS: 500,
  SCORE_OBSTACLE:     150,
  SCORE_POWERUP_CELL: 50,
  CASCADE_MULTIPLIER: 1.5,

  // ── 动画时长（毫秒） ──
  SWAP_DURATION:         200,
  REMOVE_DURATION:       300,
  DROP_DURATION_PER_CELL: 80,
  INVALID_SWAP_DURATION: 150,
  REFILL_SETTLE_DELAY:   100,  // 填充后等待再检测匹配的延迟

  // ── Hint 系统 ──
  HINT_IDLE_MS: 3000,  // 空闲多久触发提示

  // ── Shuffle 安全阀 ──
  MAX_SHUFFLE_ATTEMPTS: 50,

  // ── 初始关卡配置 ──
  GARDEN_THEME: {
    tiles: {
      0: { assetId: 'leaf', emoji: '🍃', name: 'green' },
      1: { assetId: 'apple', emoji: '🍎', name: 'red' },
      2: { assetId: 'pear', emoji: '🍐', name: 'yellow' },
      3: { assetId: 'drop', emoji: '💧', name: 'blue' },
      4: { assetId: 'flower', emoji: '🌸', name: 'purple' },
    },
    powerUps: {
      match4H:      PU.FIRECRACKER,  // 横向4连 → 鞭炮
      match4V:      PU.FIRECRACKER,  // 纵向4连 → 鞭炮
      match4Square: null,             // 2×2：花园不生成
      match5LT:     PU.GARDEN_BOMB,  // L/T 5连
      match6LT:     PU.DYNAMITE,     // L/T 6连
      match7LT:     PU.TNT,          // L/T 7连+
      match5Line:   PU.RAINBOW,
    },
    level: {
      rules: {
        fillMode: 'top-down',
        obstacleExpansion: 'none',
      },
      obstacles: [
        { r: 1, c: 1, type: 'box', hp: 1 },
        { r: 1, c: 10, type: 'box', hp: 1 },
        { r: 4, c: 3, type: 'grass', hp: 1 },
        { r: 4, c: 4, type: 'grass', hp: 1 },
        { r: 5, c: 3, type: 'grass', hp: 1 },
        { r: 5, c: 4, type: 'grass', hp: 1 },
        { r: 10, c: 1, type: 'box', hp: 1 },
        { r: 10, c: 10, type: 'box', hp: 1 },
        { r: 7, c: 6, type: 'grass', hp: 1 },
        { r: 7, c: 7, type: 'grass', hp: 1 },
        { r: 8, c: 6, type: 'grass', hp: 1 },
        { r: 8, c: 7, type: 'grass', hp: 1 },
      ],
    },
    boardStyle: {
      cellEven: 'rgba(144, 238, 144, 0.12)',
      cellOdd: 'rgba(144, 238, 144, 0.06)',
      border: 'rgba(34, 139, 34, 0.3)',
    },
  },

  HOME_THEME: {
    tiles: {
      0: { assetId: 'book', emoji: '📗', name: 'green' },
      1: { assetId: 'bowtie', emoji: '🎀', name: 'red' },
      2: { assetId: 'lamp', emoji: '💡', name: 'warm' },
      3: { assetId: 'cup', emoji: '☕', name: 'blue' },
      4: { assetId: 'cushion', emoji: '🧸', name: 'purple' },
    },
    powerUps: {
      match4H:      PU.ROCKET_H,     // 横向4连 → 横向火箭（清整行）
      match4V:      PU.ROCKET_V,     // 纵向4连 → 纵向火箭（清整列）
      match4Square: PU.PAPERPLANE,   // 2×2 → 纸飞机
      match5LT:     PU.HOME_BOMB,    // L/T 5连
      match6LT:     PU.HOME_BOMB,    // L/T 6连 (自动回落)
      match7LT:     PU.HOME_BOMB,    // L/T 7连+ (自动回落)
      match5Line:   PU.RAINBOW,
    },
    level: {
      rules: {
        fillMode: 'top-down',
        obstacleExpansion: 'none',
      },
      obstacles: [
        { r: 1, c: 3, type: 'chain', hp: 1 },
        { r: 1, c: 8, type: 'chain', hp: 1 },
        { r: 3, c: 2, type: 'jelly', hp: 1 },
        { r: 3, c: 9, type: 'jelly', hp: 1 },
        { r: 5, c: 1, type: 'box', hp: 1 },
        { r: 5, c: 10, type: 'box', hp: 1 },
        { r: 4, c: 4, type: 'carpet' },
        { r: 4, c: 7, type: 'carpet' },
        { r: 5, c: 4, type: 'carpet' },
        { r: 5, c: 7, type: 'carpet' },
        { r: 8, c: 2, type: 'jelly', hp: 1 },
        { r: 8, c: 9, type: 'jelly', hp: 1 },
        { r: 10, c: 3, type: 'chain', hp: 1 },
        { r: 10, c: 8, type: 'chain', hp: 1 },
        { r: 7, c: 5, type: 'carpet' },
        { r: 7, c: 6, type: 'carpet' },
      ],
    },
    boardStyle: {
      cellEven: 'rgba(255, 228, 196, 0.12)',
      cellOdd: 'rgba(255, 228, 196, 0.06)',
      border: 'rgba(205, 133, 63, 0.3)',
    },
  },
});
