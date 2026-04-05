/**
 * Events — 全局事件名常量
 *
 * 所有 EventBus 事件名集中在此定义，杜绝拼写错误和名称不一致。
 * 事件名格式: 'domain:action'
 *
 * 用法:
 *   import { E } from '../config/Events.js';
 *   EventBus.on(E.BOARD_MATCHED, handler);
 *   EventBus.emit(E.SCORE_UPDATED, payload);
 */

export const E = Object.freeze({

  // ── Board 棋盘事件 ──
  BOARD_INITIALIZED: 'board:initialized',
  BOARD_TILE_SWAPPED: 'board:tileSwapped',
  BOARD_MATCHED:      'board:matched',
  BOARD_REMOVED:      'board:removed',
  BOARD_DROPPED:      'board:dropped',
  BOARD_REFILLED:     'board:refilled',
  BOARD_SHUFFLED:     'board:shuffled',
  BOARD_NO_MATCHES:   'board:noMatches',

  // ── Input 输入事件 ──
  INPUT_SELECT:       'input:select',
  INPUT_SWAP:         'input:swap',
  INPUT_ACTIVE:       'input:active',
  INPUT_INVALID_SWAP: 'input:invalidSwap',

  // ── Score 计分事件 ──
  SCORE_UPDATED:      'score:updated',
  SCORE_COMBO:        'score:combo',

  // ── Timer 计时事件 ──
  TIMER_TICK:         'timer:tick',
  TIMER_WARNING:      'timer:warning',
  TIMER_EXPIRED:      'timer:expired',

  // ── Game 游戏流程事件 ──
  GAME_START:         'game:start',
  GAME_RESET:         'game:reset',
  GAME_PAUSE:         'game:pause',
  GAME_RESUME:        'game:resume',
  GAME_STATE_CHANGE:  'game:stateChange',

  // ── UI 界面事件 ──
  UI_HINT:            'ui:hint',

  // ── PowerUp 道具事件 ──
  POWERUP_CREATED:    'powerup:created',
  POWERUP_ACTIVATED:  'powerup:activated',
  INPUT_TAP_POWERUP:  'input:tapPowerUp',

  // ── Obstacle 障碍物事件 ──
  OBSTACLE_HIT:       'obstacle:hit',
  OBSTACLE_DESTROYED: 'obstacle:destroyed',
  OBSTACLE_SPAWNED:   'obstacle:spawned',

  // ── Leaderboard 排行榜事件 ──
  LEADERBOARD_UPDATED: 'leaderboard:updated',
});
