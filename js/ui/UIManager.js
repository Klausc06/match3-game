/**
 * UIManager — 界面管理器
 *
 * 职责：
 *   - DOM 元素缓存与操作
 *   - 屏幕切换（start / game / end）
 *   - 模态框开关
 *   - HUD 数据更新（计时、得分、连消）
 *   - Combo 浮动文字动画
 *   - 排行榜列表渲染
 *
 * 设计原则：
 *   - 只做 UI 展示，不引用 Board / GameLoop 等逻辑模块
 *   - 通过 EventBus 被动监听数据变化，不主动拉取
 */

import { EventBus } from '../core/EventBus.js';
import { E } from '../config/Events.js';

/** DOM 元素选择器缓存 */
const $ = (id) => document.getElementById(id);

export class UIManager {
  constructor() {
    // ── 屏幕容器 ──
    this.screens = {
      start: $('startScreen'),
      game:  $('gameScreen'),
      end:   $('endScreen'),
    };

    // ── HUD 元素 ──
    this.timerDisplay  = $('timerDisplay');
    this.timerBar      = $('timerBar');
    this.scoreDisplay  = $('scoreDisplay');
    this.comboDisplay  = $('comboDisplay');
    this.comboOverlay  = $('comboOverlay');

    // ── 结算界面 ──
    this.finalScore    = $('finalScore');
    this.finalCombo    = $('finalCombo');
    this.finalCleared  = $('finalCleared');
    this.endRank       = $('endRank');
    this.rankNumber    = $('rankNumber');

    // ── 其他 ──
    this.playerName       = $('playerName');
    this.canvas           = $('gameCanvas');
    this.leaderboardModal = $('leaderboardModal');
    this.leaderboardList  = $('leaderboardList');
    this.renderer         = null;

    this._bindEvents();
  }

  bindRenderer(renderer) {
    this.renderer = renderer;
  }

  // ═══════════════════════════════════════════
  //  EventBus 监听（只注册一次，永不重复绑定）
  // ═══════════════════════════════════════════

  _bindEvents() {
    EventBus.on(E.SCORE_UPDATED, ({ score, added, combo }) => {
      this.updateScore(score, combo);
      if (combo >= 2 && added > 0) {
        this.showComboFloat(combo, added);
      }
    });

    EventBus.on(E.TIMER_TICK, ({ remaining, ratio }) => {
      this.updateTimer(remaining, ratio);
    });

    // Hint 提示：高亮建议交换的两个格子
    EventBus.on(E.UI_HINT, (payload = {}) => {
      this.showHint(this._resolveHintCells(payload));
    });
  }

  // ═══════════════════════════════════════════
  //  屏幕与模态框
  // ═══════════════════════════════════════════

  /** 切换到指定屏幕（'start' | 'game' | 'end'） */
  showScreen(name) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    this.screens[name].classList.add('active');
  }

  showModal(id) {
    document.getElementById(id).classList.add('active');
  }

  hideModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  // ═══════════════════════════════════════════
  //  HUD 更新
  // ═══════════════════════════════════════════

  /** 更新计时器显示 */
  updateTimer(remaining, ratio) {
    const secs = Math.ceil(remaining);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    this.timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    this.timerBar.style.width = `${ratio * 100}%`;

    // 颜色预警
    this.timerBar.classList.remove('warning', 'critical');
    if (ratio < 0.15)      this.timerBar.classList.add('critical');
    else if (ratio < 0.33) this.timerBar.classList.add('warning');
  }

  /** 更新得分与连消显示 */
  updateScore(score, combo) {
    this.scoreDisplay.textContent = score.toLocaleString();
    if (combo > 0) {
      this.comboDisplay.textContent = combo;
    }
  }

  /** 重置 HUD 到初始状态 */
  resetHUD(durationSecs) {
    this.scoreDisplay.textContent = '0';
    this.comboDisplay.textContent = '0';
    const m = Math.floor(durationSecs / 60);
    const s = durationSecs % 60;
    this.timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    this.timerBar.style.width = '100%';
    this.timerBar.classList.remove('warning', 'critical');
    this.comboOverlay.innerHTML = '';
    this.clearHint();
  }

  // ═══════════════════════════════════════════
  //  Hint 提示高亮
  // ═══════════════════════════════════════════

  /** Hint 脉冲闪烁高亮 */
  _hintTimer = null;

  _resolveHintCells(payload) {
    if (Array.isArray(payload.cells)) return payload.cells;
    if (payload.from && payload.to) return [payload.from, payload.to];
    return [];
  }

  showHint(cells) {
    this.clearHint();
    if (!cells || cells.length < 2) return;
    if (!this.renderer) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const overlayRect = this.comboOverlay.getBoundingClientRect();
    const canvasOffsetLeft = canvasRect.left - overlayRect.left;
    const canvasOffsetTop = canvasRect.top - overlayRect.top;
    const tileSize = this.renderer.tileSize;

    cells.forEach(({ r, c }) => {
      const { x, y } = this.renderer.gridToPixel(r, c);
      const el = document.createElement('div');
      el.className = 'hint-pulse';
      el.dataset.hintCell = `${r}-${c}`;
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.left = `${canvasOffsetLeft + x}px`;
      el.style.top = `${canvasOffsetTop + y}px`;
      el.style.width = `${tileSize}px`;
      el.style.height = `${tileSize}px`;
      el.style.border = '3px solid rgba(255, 220, 100, 0.9)';
      el.style.borderRadius = `${Math.max(8, Math.round(tileSize * 0.18))}px`;
      el.style.boxShadow = '0 0 15px rgba(255, 200, 50, 0.6), inset 0 0 10px rgba(255, 200, 50, 0.2)';
      el.style.animation = 'hintPulse 0.8s ease-in-out infinite alternate';
      el.style.zIndex = '10';
      this.comboOverlay.appendChild(el);
    });

    // 3秒后自动清除（与 GameLoop IDLE_HINT_DELAY 对应）
    this._hintTimer = setTimeout(() => this.clearHint(), 3000);
  }

  clearHint() {
    if (this._hintTimer) {
      clearTimeout(this._hintTimer);
      this._hintTimer = null;
    }
    this.comboOverlay?.querySelectorAll('.hint-pulse').forEach(el => el.remove());
  }

  // ═══════════════════════════════════════════
  //  Combo 浮动文字
  // ═══════════════════════════════════════════

  showComboFloat(combo, score) {
    const el = document.createElement('div');
    el.className = 'combo-text';
    el.textContent = `×${combo} Combo! +${score}`;
    el.style.left = `${30 + Math.random() * 40}%`;
    el.style.top  = `${40 + Math.random() * 20}%`;
    this.comboOverlay.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ═══════════════════════════════════════════
  //  结算界面
  // ═══════════════════════════════════════════

  /** 填入结算数据 */
  showEndScreen(score, maxCombo, totalCleared, rank) {
    this.finalScore.textContent   = score.toLocaleString();
    this.finalCombo.textContent   = maxCombo;
    this.finalCleared.textContent = totalCleared;

    if (rank > 0) {
      this.endRank.style.display = 'block';
      this.rankNumber.textContent = rank;
    } else {
      this.endRank.style.display = 'none';
    }
    this.showScreen('end');
  }

  // ═══════════════════════════════════════════
  //  排行榜
  // ═══════════════════════════════════════════

  renderLeaderboard(entries, highlightRank = -1) {
    if (!entries || entries.length === 0) {
      this.leaderboardList.innerHTML = '<div class="leaderboard-empty">暂无记录</div>';
      return;
    }

    this.leaderboardList.innerHTML = entries.map((entry, i) => {
      const rank = i + 1;
      const rankClass = rank <= 3 ? `lb-rank-${rank}` : '';
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
      const hlClass = rank === highlightRank ? 'highlight' : '';
      return `
        <div class="leaderboard-entry ${hlClass}">
          <div class="lb-rank ${rankClass}">${medal}</div>
          <div class="lb-info">
            <div class="lb-name">${entry.name}</div>
            <div class="lb-date">${entry.date} | 最高×${entry.combo}连消</div>
          </div>
          <div class="lb-score">${entry.score.toLocaleString()}</div>
        </div>
      `;
    }).join('');
  }

  /** 获取玩家输入的名字 */
  getPlayerName() {
    return this.playerName.value.trim() || 'Player';
  }
}
