/**
 * main.js — 游戏主入口（组装器）
 *
 * 职责：
 *   1. 实例化所有模块（Board, Renderer, GameLoop, ScoreManager, TimerManager ...）
 *   2. 绑定 DOM 按钮事件
 *   3. 定义 startGame / endGame 两个顶层流程函数
 *
 * 设计原则：
 *   - 事件只注册一次（在模块 constructor 和本文件顶层），绝不使用 EventBus.clear()
 *   - 本文件 < 120 行，UI 操作委托给 UIManager
 */

// ── 全局错误捕获（开发调试用）──
window.onerror = (msg, src, line, col, err) => {
  console.error(`[GLOBAL ERROR] ${msg} at ${src}:${line}:${col}`, err);
};
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED REJECTION]', e.reason);
});

import { EventBus } from './core/EventBus.js';
import { E } from './config/Events.js';
import { GameConfig } from './config/GameConfig.js';
import { generateLevel } from './config/LevelGenerator.js';
import { StateMachine } from './core/StateMachine.js';
import { Board } from './core/Board.js';
import { Renderer } from './core/Renderer.js';
import { InputHandler } from './core/InputHandler.js';
import { GameLoop } from './core/GameLoop.js';
import { ScoreManager } from './core/ScoreManager.js';
import { TimerManager } from './core/TimerManager.js';
import { Leaderboard } from './core/Leaderboard.js';
import { Assets } from './core/AssetLoader.js';
import { UIManager } from './ui/UIManager.js';

// ═══════════════════════════════════════════════════════
//  模块实例化（只做一次，生命周期与页面等同）
// ═══════════════════════════════════════════════════════

const board        = new Board(GameConfig.BOARD_ROWS, GameConfig.BOARD_COLS, GameConfig.COLOR_COUNT);
const stateMachine = new StateMachine();
const leaderboard  = new Leaderboard();
const scoreManager = new ScoreManager();
const timerManager = new TimerManager(GameConfig.GAME_DURATION);
const ui           = new UIManager();
const runtimeSeed = (() => {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
})();

// Canvas 大小自适应
function resizeCanvas() {
  const maxSize = Math.min(window.innerWidth - 24, window.innerHeight - 140, 540);
  ui.canvas.width  = maxSize;
  ui.canvas.height = maxSize;
}
resizeCanvas();

const renderer     = new Renderer(ui.canvas, board, { theme: 'garden' });
ui.bindRenderer(renderer);
const inputHandler = new InputHandler(ui.canvas, renderer, stateMachine, board);
const gameLoop     = new GameLoop(board, renderer, stateMachine);
gameLoop.setTimerManager(timerManager);
// ═══════════════════════════════════════════════════════
//  事件注册（只注册一次，永不重复）
// ═══════════════════════════════════════════════════════

// 计时器到期 → 结束游戏
EventBus.on(E.TIMER_EXPIRED, () => endGame());

// ═══════════════════════════════════════════════════════
//  素材预加载
// ═══════════════════════════════════════════════════════

const btnStart = document.getElementById('btnStart');
const originalText = btnStart.textContent;
btnStart.textContent = 'Loading Assets...';
btnStart.disabled = true;

Assets.loadAll((progress) => {
  btnStart.textContent = `Loading... ${Math.round(progress * 100)}%`;
}).then(() => {
  btnStart.textContent = originalText;
  btnStart.disabled = false;
});

// ═══════════════════════════════════════════════════════
//  DOM 按钮绑定（只绑一次）
// ═══════════════════════════════════════════════════════

let selectedTheme = 'garden';

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTheme = btn.dataset.theme;
    leaderboard.setTheme(selectedTheme);
  });
});

document.getElementById('btnStart').addEventListener('click', startGame);
document.getElementById('btnReplay').addEventListener('click', startGame);
document.getElementById('btnBackToStart').addEventListener('click', () => ui.showScreen('start'));

document.getElementById('btnShowLeaderboard').addEventListener('click', () => {
  ui.renderLeaderboard(leaderboard.getEntries());
  ui.showModal('leaderboardModal');
});

document.getElementById('btnDemoHome').addEventListener('click', () => {
  const level = generateLevel('home', GameConfig.BOARD_ROWS, GameConfig.BOARD_COLS);
  startGame(true, 'home', level);
});

document.getElementById('btnDemoGarden').addEventListener('click', () => {
  const level = generateLevel('garden', GameConfig.BOARD_ROWS, GameConfig.BOARD_COLS);
  startGame(true, 'garden', level);
});

document.getElementById('btnEndLeaderboard').addEventListener('click', () => {
  ui.renderLeaderboard(leaderboard.getEntries());
  ui.showModal('leaderboardModal');
});

document.getElementById('btnCloseLeaderboard').addEventListener('click', () => {
  ui.hideModal('leaderboardModal');
});

document.getElementById('btnClearLeaderboard').addEventListener('click', () => {
  if (confirm('确定清空排行榜？')) {
    leaderboard.clear();
    ui.renderLeaderboard(leaderboard.getEntries());
  }
});

window.addEventListener('resize', () => {
  resizeCanvas();
  renderer.resize(ui.canvas.width, ui.canvas.height);
});

// ═══════════════════════════════════════════════════════
//  游戏流程
// ═══════════════════════════════════════════════════════

function startGame(isDemo = false, demoTheme = null, demoLevelConfig = null) {
  try {
    // 重置各模块状态（不清除事件！）
    stateMachine.reset();
    scoreManager.reset();
    timerManager.reset(GameConfig.GAME_DURATION);
    if (runtimeSeed !== null) board.setRandomSeed(runtimeSeed);

    // 获取当前主题配置
    let currentTheme = selectedTheme;
    if (isDemo) currentTheme = demoTheme;
    
    const themeConfig = currentTheme === 'home'
      ? GameConfig.HOME_THEME
      : GameConfig.GARDEN_THEME;

    // 设置主题
    renderer.setTheme(currentTheme, themeConfig);
    leaderboard.setTheme(currentTheme);

    // 初始化棋盘（传入主题专属关卡配置，如果是Demo则传传传入特定布局）
    let loadConfig = themeConfig.level;
    if (isDemo) {
        loadConfig = demoLevelConfig;
        timerManager.reset(GameConfig.GAME_DURATION); 
    }
    board.init(loadConfig);

    // 更新 GameLoop 的主题配置（用于道具映射等）
    gameLoop.setTheme(themeConfig);

    // 调整画布
    resizeCanvas();
    renderer.resize(ui.canvas.width, ui.canvas.height);

    // 重置 HUD
    ui.resetHUD(GameConfig.GAME_DURATION);
    ui.showScreen('game');
    ui.hideModal('leaderboardModal');

    // 启动游戏循环与计时器
    gameLoop.start();
    if (!isDemo) timerManager.start();
  } catch (e) {
    console.error('[startGame ERROR]', e);
    alert('启动游戏出错: ' + e.message + '\n' + e.stack);
  }
}

function endGame() {
  // 统一入口：状态机 → GAME_OVER + 取消会话 + 停止循环
  gameLoop.handleGameOver();
  timerManager.pause();

  const playerName = ui.getPlayerName();
  const rank = leaderboard.submit(playerName, scoreManager.score, scoreManager.maxCombo);

  ui.showEndScreen(scoreManager.score, scoreManager.maxCombo, scoreManager.totalCleared, rank);
}
