/**
 * InputHandler — 处理玩家在 Canvas 上的点击和滑动操作
 *
 * 将鼠标/触摸事件转换为棋盘坐标，发射 input:select 和 input:swap 事件。
 * 只在 StateMachine 处于 IDLE 状态时才允许交互。
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';
import { GameState } from './StateMachine.js';

export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./Renderer.js').Renderer} renderer
   * @param {import('./StateMachine.js').StateMachine} stateMachine
   * @param {import('./Board.js').Board} board
   */
  constructor(canvas, renderer, stateMachine, board) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.stateMachine = stateMachine;
    this.board = board;

    /** @type {{r:number,c:number}|null} 第一个选中的图块 */
    this._firstSelected = null;

    /** @type {{x:number,y:number}|null} 鼠标/触摸按下的像素坐标 */
    this._pointerStart = null;

    /** @type {boolean} 是否正在拖拽 */
    this._isDragging = false;

    /** @type {number} 最小滑动距离（像素），超过此值视为滑动而非点击 */
    this.swipeThreshold = 20;

    this._bindEvents();
  }

  /**
   * 绑定所有交互事件
   */
  _bindEvents() {
    // 鼠标事件
    this.canvas.addEventListener('mousedown', (e) => this._onPointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onPointerMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onPointerUp(e));

    // 触摸事件
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._onPointerDown(e.touches[0]);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this._onPointerMove(e.touches[0]);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._onPointerUp(e.changedTouches[0]);
    }, { passive: false });
  }

  /**
   * 获取相对于 canvas 的坐标
   */
  _getCanvasXY(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  /**
   * 指针按下
   */
  _onPointerDown(e) {
    if (!this.stateMachine.is(GameState.IDLE)) return;

    EventBus.emit(E.INPUT_ACTIVE);

    const { x, y } = this._getCanvasXY(e);
    const gridPos = this.renderer.pixelToGrid(x, y);
    if (!gridPos) return;

    this._pointerStart = { x, y };
    this._isDragging = true;
  }

  /**
   * 指针移动（检测滑动手势）
   */
  _onPointerMove(e) {
    if (!this._isDragging || !this._pointerStart) return;
    if (!this.stateMachine.is(GameState.IDLE)) return;

    const { x, y } = this._getCanvasXY(e);
    const dx = x - this._pointerStart.x;
    const dy = y - this._pointerStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.swipeThreshold) {
      // 确定滑动方向
      const fromPos = this.renderer.pixelToGrid(this._pointerStart.x, this._pointerStart.y);
      if (!fromPos) {
        this._resetPointer();
        return;
      }

      let toPos;
      if (Math.abs(dx) > Math.abs(dy)) {
        // 水平滑动
        toPos = { r: fromPos.r, c: fromPos.c + (dx > 0 ? 1 : -1) };
      } else {
        // 垂直滑动
        toPos = { r: fromPos.r + (dy > 0 ? 1 : -1), c: fromPos.c };
      }

      this._emitSwap(fromPos, toPos);
      this._resetPointer();
    }
  }

  /**
   * 指针释放（处理点击选择）
   */
  _onPointerUp(e) {
    if (!this._isDragging) return;

    const { x, y } = this._getCanvasXY(e);

    // 如果没有明显滑动，视为点击
    if (this._pointerStart) {
      const dx = x - this._pointerStart.x;
      const dy = y - this._pointerStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.swipeThreshold) {
        this._handleClick(x, y);
      }
    }

    this._resetPointer();
  }

  /**
   * 处理点击：选中 → 再选中相邻图块 → 触发交换
   */
  _handleClick(x, y) {
    if (!this.stateMachine.is(GameState.IDLE)) return;

    const gridPos = this.renderer.pixelToGrid(x, y);
    if (!gridPos) return;

    // ── 单击道具：直接原地引爆 ──
    const tile = this.board.getTile(gridPos.r, gridPos.c);
    if (tile && tile.powerUp) {
      EventBus.emit(E.INPUT_TAP_POWERUP, { pos: gridPos });
      this._firstSelected = null;
      this.renderer.clearSelection();
      return;
    }

    if (this._firstSelected === null) {
      // 首次选中
      this._firstSelected = gridPos;
      EventBus.emit(E.INPUT_SELECT, gridPos);
    } else {
      // 第二次选中
      const from = this._firstSelected;
      const to = gridPos;

      if (from.r === to.r && from.c === to.c) {
        // 点击同一个 → 取消选中
        this._firstSelected = null;
        this.renderer.clearSelection();
      } else if (Math.abs(from.r - to.r) + Math.abs(from.c - to.c) === 1) {
        // 相邻 → 尝试交换
        this._emitSwap(from, to);
        this._firstSelected = null;
        this.renderer.clearSelection();
      } else {
        // 不相邻 → 改选新图块
        this._firstSelected = gridPos;
        EventBus.emit(E.INPUT_SELECT, gridPos);
      }
    }
  }

  /**
   * 发射交换事件
   */
  _emitSwap(from, to) {
    EventBus.emit(E.INPUT_SWAP, { from, to });
    this._firstSelected = null;
    this.renderer.clearSelection();
  }

  /**
   * 重置指针状态
   */
  _resetPointer() {
    this._pointerStart = null;
    this._isDragging = false;
  }

  /**
   * 清除选中状态（外部调用）
   */
  clearSelection() {
    this._firstSelected = null;
    this.renderer.clearSelection();
  }
}
