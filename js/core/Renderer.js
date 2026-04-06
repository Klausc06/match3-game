/**
 * Renderer — Canvas 绘制层
 *
 * 职责：将 Board 数据可视化渲染到 Canvas 上。
 * 只从 Board 读取数据，不修改数据。
 * 通过 EventBus 监听输入事件来更新选中状态。
 *
 * 渲染方案：
 *   - 优先使用 AssetLoader 预加载的 AI 生成贴图
 *   - 通过 multiply 混合模式将主题色融合到透明贴图上
 *   - 保底方案：主题色 + Emoji
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';
import { PU, OB } from '../config/PowerUpTypes.js';
import { Assets } from './AssetLoader.js';
import { AnimSystem } from './AnimationSystem.js';

// 障碍物渲染样式
const OBSTACLE_STYLES = {
  ice:    { overlay: 'rgba(173, 216, 255, 0.5)', emoji: '❄️', border: '#87ceeb' },
  box:    { bg: '#8B6914', emoji: '📦', border: '#654321' },
  chain:  { overlay: 'rgba(128, 128, 128, 0.4)', emoji: '⛓️', border: '#999' },
  carpet: { overlay: 'rgba(139, 0, 0, 0.2)', emoji: '🟥', border: '#b22222' },
  jelly:  { overlay: 'rgba(220, 120, 220, 0.45)', emoji: '🍮', border: '#c060c0' },
  grass:  { overlay: 'rgba(80, 180, 80, 0.35)', emoji: '🌱', border: '#3a9a3a' },
  vase:   { assetId: 'vase', emoji: '🏺', border: '#1c4587', bg: '#6fa8dc' },
};

// 道具 emoji
const POWERUP_EMOJIS = {
  firecracker:   '🧨',
  'home-bomb':   '💣',
  'garden-bomb': '💣',
  dynamite:      '🧨',
  tnt:           '💥',
  rocket:        '🚀',
  'rocket-h':    '↔️',
  'rocket-v':    '↕️',
  rainbow:       '🌈',
  paperplane:    '✈️',
};

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./Board.js').Board} board
   * @param {Object} options
   */
  constructor(canvas, board, options = {}) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext('2d');
    /** @type {import('./Board.js').Board} */
    this.board = board;

    /** @type {string} 当前主题 'garden' | 'home' */
    this.theme = options.theme || 'garden';

    /** @type {number} 棋盘左上角 x 偏移 */
    this.offsetX = 0;
    /** @type {number} 棋盘左上角 y 偏移 */
    this.offsetY = 0;
    /** @type {number} 每个格子的像素大小 */
    this.tileSize = 0;

    /** @type {{r:number,c:number}|null} 当前选中的图块 */
    this.selectedTile = null;

    /** @type {Array} 活跃的动画 */
    this.activeAnimations = [];

    // ── 动画状态引用（由 GameLoop 设置） ──
    /** @type {Object|null} 当前 swap 动画 */
    this._swapAnim = null;
    /** @type {{r:number,c:number}|null} */
    this._swapFromA = null;
    /** @type {{r:number,c:number}|null} */
    this._swapFromB = null;
    /** @type {Object|null} 当前 remove 动画 */
    this._removeAnim = null;
    /** @type {Object|null} 当前 drop 动画 */
    this._dropAnim = null;
    /** @type {Object|null} 当前 shake 动画 */
    this._shakeAnim = null;
    /** @type {{r:number,c:number}|null} 抖动目标位置 */
    this._shakePos = null;

    /** @type {Array} 纸飞机飞行轨迹特效 */
    this._planeTrails = [];

    this._calculateLayout();
    this._bindEvents();
  }

  /**
   * 获取当前主题的图块颜色配置
   */
  get colors() {
    return this._themeConfig ? this._themeConfig.tiles : {};
  }

  /**
   * 切换主题
   * @param {string} theme - 'garden' | 'home'
   * @param {Object} themeConfig - GameConfig.GARDEN_THEME 或 HOME_THEME
   */
  setTheme(theme, themeConfig) {
    this.theme = theme;
    this._themeConfig = themeConfig;
    this._boardStyle  = themeConfig ? themeConfig.boardStyle : null;

    // 预缓存图块图片，避免每帧在 Map 中查询
    this._tileImageCache = [];
    if (themeConfig?.tiles) {
      for (const [idx, def] of Object.entries(themeConfig.tiles)) {
        this._tileImageCache[Number(idx)] = Assets.getImage(def.assetId) || null;
      }
    }
  }

  /**
   * 计算布局参数（根据 canvas 尺寸和棋盘大小）
   */
  _calculateLayout() {
    const maxBoardWidth = this.canvas.width * 0.92;
    const maxBoardHeight = this.canvas.height * 0.92;
    const maxTileW = maxBoardWidth / this.board.cols;
    const maxTileH = maxBoardHeight / this.board.rows;
    this.tileSize = Math.floor(Math.min(maxTileW, maxTileH));

    const boardPixelW = this.tileSize * this.board.cols;
    const boardPixelH = this.tileSize * this.board.rows;
    this.offsetX = Math.floor((this.canvas.width - boardPixelW) / 2);
    this.offsetY = Math.floor((this.canvas.height - boardPixelH) / 2);
  }

  /**
   * 监听 EventBus 事件
   */
  _bindEvents() {
    EventBus.on(E.INPUT_SELECT, (data) => {
      this.selectedTile = data;
    });
  }

  /**
   * 调整 Canvas 大小（窗口 resize 时调用）
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this._calculateLayout();
  }

  /**
   * 像素坐标 → 棋盘坐标
   * @param {number} px - 像素 x
   * @param {number} py - 像素 y
   * @returns {{r:number, c:number}|null}
   */
  pixelToGrid(px, py) {
    const c = Math.floor((px - this.offsetX) / this.tileSize);
    const r = Math.floor((py - this.offsetY) / this.tileSize);
    if (r >= 0 && r < this.board.rows && c >= 0 && c < this.board.cols) {
      return { r, c };
    }
    return null;
  }

  /**
   * 棋盘坐标 → 像素坐标（格子左上角）
   * @param {number} r
   * @param {number} c
   * @returns {{x:number, y:number}}
   */
  gridToPixel(r, c) {
    return {
      x: this.offsetX + c * this.tileSize,
      y: this.offsetY + r * this.tileSize,
    };
  }

  /**
   * 主绘制方法 - 每帧调用
   * @param {number} [timestamp] - requestAnimationFrame 时间戳
   */
  render(timestamp = 0) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // ── 重置 Canvas 状态到干净的默认值 ──
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // 绘制棋盘背景
    this._drawBoardBackground(ctx);

    // 绘制所有图块（带动画插值）
    this._drawTiles(ctx, timestamp);

    // 绘制选中高亮
    if (this.selectedTile) {
      this._drawSelection(ctx, this.selectedTile.r, this.selectedTile.c);
    }

    // 绘制纸飞机飞行轨迹
    this._drawPlaneTrails(ctx, timestamp);

    // 处理通用动画队列（兼容未来扩展）
    this._updateAnimations(ctx, timestamp);

    // 恢复状态
    ctx.restore();
  }

  /**
   * 绘制棋盘背景（交替白灰棋盘格）
   */
  _drawBoardBackground(ctx) {
    const ts = this.tileSize;

    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const x = this.offsetX + c * ts;
        const y = this.offsetY + r * ts;
        const playable = this.board.isPlayableCell?.(r, c) !== false;

        if (!playable) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
          ctx.fillRect(x, y, ts, ts);
          continue;
        }

        // 交替色棋盘格
        ctx.fillStyle = (r + c) % 2 === 0
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(x, y, ts, ts);

        // 绘制 Carpet 层（仅 home 主题启用地毯）
        if (this.board.ruleSet?.carpetEnabled && this.board.carpetGrid?.[r]?.[c]) {
          ctx.fillStyle = 'rgba(144, 238, 144, 0.4)';
          ctx.fillRect(x, y, ts, ts);
          ctx.strokeStyle = 'rgba(34, 139, 34, 0.6)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x+2, y+2, ts-4, ts-4);
        }

        // 绘制 Stream 层
        const streamDir = this.board.streamGrid?.[r]?.[c];
        if (streamDir) {
          ctx.fillStyle = 'rgba(65, 150, 225, 0.35)';
          ctx.fillRect(x, y, ts, ts);
          ctx.strokeStyle = 'rgba(30, 144, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x+2, y+2, ts-4, ts-4);
          
          // 绘制水流方向箭头
          ctx.save();
          ctx.globalAlpha = 0.45;
          const cx = x + ts / 2;
          const cy = y + ts / 2;
          const arrowSize = ts * 0.2;
          ctx.fillStyle = '#1e90ff';
          ctx.beginPath();
          if (streamDir === 'down') {
            ctx.moveTo(cx - arrowSize, cy - arrowSize * 0.5);
            ctx.lineTo(cx + arrowSize, cy - arrowSize * 0.5);
            ctx.lineTo(cx, cy + arrowSize);
          } else {
            ctx.moveTo(cx - arrowSize, cy + arrowSize * 0.5);
            ctx.lineTo(cx + arrowSize, cy + arrowSize * 0.5);
            ctx.lineTo(cx, cy - arrowSize);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 棋盘边框
    const boardW = this.board.cols * ts;
    const boardH = this.board.rows * ts;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.offsetX, this.offsetY, boardW, boardH);
  }

  /** 上一次的 tile 计数（用于检测突变） */
  _lastTileCount = -1;

  /**
   * 绘制所有图块（带动画插值）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} timestamp 当前帧时间戳
   */
  _drawTiles(ctx, timestamp = 0) {
    const ts = timestamp || performance.now();
    const tsz = this.tileSize;
    let tileCount = 0;
    let nullCount = 0;

    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        if (this.board.isPlayableCell?.(r, c) === false) {
          continue;
        }
        const tile = this.board.getTile(r, c);
        if (!tile) { nullCount++; continue; }
        tileCount++;

        // ── 计算基础位置 ──
        let x = this.offsetX + c * tsz;
        let y = this.offsetY + r * tsz;
        let skipDraw = false;

        // ── 应用消除动画（缩小+淡出）──
        if (this._removeAnim && this._removeAnim.isRemoving(r, c)) {
          const t = this._removeAnim.getTransform(ts);
          if (t.scale <= 0.01) continue; // 完全消失，跳过绘制
          // 将 transform 传入 _drawTileAnimated 处理
          this._drawTileAnimated(ctx, x, y, tsz, tile, t);
          continue;
        }

        // ── 应用下落动画（从上方落下）──
        if (this._dropAnim) {
          const dropOffset = this._dropAnim.getDropOffset(r, c, this, ts);
          if (dropOffset) {
            x += dropOffset.dx;
            y += dropOffset.dy;
          }
        }

        // ── 应用交换动画偏移 ──
        if (this._swapAnim) {
          const fromA = this._swapFromA || { r: -1, c: -1 };
          const fromB = this._swapFromB || { r: -1, c: -1 };
          if (r === fromA.r && c === fromA.c) {
            const off = this._swapAnim.getOffsetA(this, ts);
            x += off.dx; y += off.dy;
          } else if (r === fromB.r && c === fromB.c) {
            const off = this._swapAnim.getOffsetB(this, ts);
            x += off.dx; y += off.dy;
          }
        }

        // ── 应用抖动偏移 ──
        if (this._shakeAnim && this._shakePos) {
          if (r === this._shakePos.r && c === this._shakePos.c) {
            x += this._shakeAnim.getShakeOffset(ts);
          }
        }

        // ── 正常绘制（无 alpha/scale 动画干扰）──
        if (tile.obstacle && (tile.obstacle.type === 'box' || tile.obstacle.type === 'grass')) {
          this._drawBoxObstacle(ctx, x, y, tsz, tile.obstacle.type, tile.obstacle.hp);
        } else {
          const colorDef = this.colors[tile.color];

          if (tile.powerUp) {
            // 道具格：只画道具，不画底层水果
            this._drawPowerUpOverlay(ctx, x, y, tsz, tile.powerUp);
          } else {
            if (colorDef) {
              this._drawTile(ctx, x, y, tsz, colorDef, tile.color);
            }

            // 障碍物覆盖
            if (tile.obstacle) {
              this._drawObstacleOverlay(ctx, x, y, tsz, tile.obstacle);
            }
          }
        }
      }
    }

    // ── 突变检测：如果 tile 数量突然从正常值降到接近 0，打印诊断 ──
    if (this._lastTileCount >= 40 && tileCount < 5) {
      console.error(`[RENDER BUG] tile 数突变! ${this._lastTileCount} → ${tileCount}, null格子=${nullCount}, board.grid长度=${this.board.grid?.length}`);
      console.trace('素材消失调用栈');
    }
    this._lastTileCount = tileCount;
  }

  /**
   * 绘制带消除动画的图块（独立方法，避免污染正常绘制路径的 ctx 状态）
   */
  _drawTileAnimated(ctx, x, y, size, tile, transform) {
    const { scale, alpha, rotation } = transform;
    const tsz = size;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // 缩放和旋转围绕格子中心
    if (scale !== 1 || rotation !== 0) {
      const cx = x + tsz / 2;
      const cy = y + tsz / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }

    if (tile.obstacle && ['box', 'grass'].includes(tile.obstacle.type)) {
      // 纯占位障碍物——独立绘制，无底部图块
      this._drawBoxObstacle(ctx, x, y, tsz, tile.obstacle.type, tile.obstacle.hp);
    } else {
      const colorDef = this.colors[tile.color];
      if (tile.powerUp) {
        this._drawPowerUpOverlay(ctx, x, y, tsz, tile.powerUp);
      } else {
        // 先画底部图块
        if (colorDef) {
          this._drawTile(ctx, x, y, tsz, colorDef, tile.color);
        }
        // 再画覆盖层（锁链/果冻/冰等叠在图块上面）
        if (tile.obstacle) {
          this._drawObstacleOverlay(ctx, x, y, tsz, tile.obstacle);
        }
      }
    }

    ctx.restore();
  }

  /**
   * 绘制单个图块
   * @param {number} [colorIndex] - 颜色索引，用于从预缓存数组取图片
   */
  _drawTile(ctx, x, y, size, colorDef, colorIndex = -1) {
    const padding = size * 0.04;
    const innerSize = size - padding * 2;

    ctx.save();
    
    // 优先从预缓存数组取图片（O(1)），fallback 到 Assets.getImage
    const img = (colorIndex >= 0 && this._tileImageCache?.[colorIndex] !== undefined)
      ? this._tileImageCache[colorIndex]
      : Assets.getImage(colorDef.assetId);

    if (img) {
      // multiply 混合模式：白色背景变透明，保留图标色彩
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(img, x + padding, y + padding, innerSize, innerSize);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // Fallback
      const radius = size * 0.18;
      ctx.fillStyle = '#eee';
      this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, radius);
      ctx.fill();

      ctx.font = `${size * 0.42}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#333';
      ctx.fillText(colorDef.emoji, x + size / 2, y + size / 2);
    }

    ctx.restore();
  }

  /**
   * 绘制选中状态
   */
  _drawSelection(ctx, r, c) {
    const x = this.offsetX + c * this.tileSize;
    const y = this.offsetY + r * this.tileSize;
    const padding = this.tileSize * 0.04;

    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 10;
    this._roundRect(ctx, x + padding, y + padding, this.tileSize - padding * 2, this.tileSize - padding * 2, this.tileSize * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 绘制道具图标覆盖
   */
  _drawPowerUpOverlay(ctx, x, y, size, powerUpType) {
    // 映射具体的素材名称
    const assetMap = {
      'home-bomb': 'bomb',
      'garden-bomb': 'bomb',
      dynamite: 'dynamite',
      tnt: 'tnt',
      rocket: 'rocket',
      'rocket-h': 'rocket',
      'rocket-v': 'rocket',
      firecracker: 'firecracker',
      rainbow: 'flower',
    };
    
    const assetId = assetMap[powerUpType];
    const img = Assets.getImage(assetId);

    ctx.save();
    const padding = size * 0.04;
    const innerSize = size - padding * 2;

    if (img) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(img, x + padding, y + padding, innerSize, innerSize);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      const emoji = POWERUP_EMOJIS[powerUpType];
      if (emoji) {
        ctx.font = `${size * 0.42}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, x + size / 2, y + size / 2);
      }
    }

    // 给道具加上明显的发光环来区分它跟基础图块
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 12;
    this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, size * 0.18);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 绘制障碍物覆盖层
   */
  _drawObstacleOverlay(ctx, x, y, size, obstacle) {
    ctx.save();
    const padding = size * 0.04;
    const innerSize = size - padding * 2;
    const style = OBSTACLE_STYLES[obstacle.type];

    if (obstacle.type === 'chain' || obstacle.type === 'jelly') {
      // 覆盖层障碍：先画半透明遮罩，再画图标
      if (style && style.overlay) {
        this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, size * 0.18);
        ctx.fillStyle = style.overlay;
        ctx.fill();
      }
      // 尝试用贴图
      const img = Assets.getImage(obstacle.type);
      if (img) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, x + padding, y + padding, innerSize, innerSize);
        ctx.globalAlpha = 1;
      } else if (style) {
        ctx.font = `${size * 0.35}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(style.emoji, x + size / 2, y + size / 2);
      }
      // 描边
      if (style && style.border) {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 2;
        this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, size * 0.18);
        ctx.stroke();
      }
    } else if (obstacle.type === 'ice') {
      const img = Assets.getImage('ice');
      if (img) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img, x + padding, y + padding, innerSize, innerSize);
        ctx.globalCompositeOperation = 'source-over';
      } else if (style && style.overlay) {
        this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, size * 0.18);
        ctx.fillStyle = style.overlay;
        ctx.fill();
      }
    } else if (style) {
      // 其他覆盖型障碍物的 fallback
      if (style.overlay) {
        this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, size * 0.18);
        ctx.fillStyle = style.overlay;
        ctx.fill();
      }
      if (style.border) {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 2;
        this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, size * 0.18);
        ctx.stroke();
      }
    }

    // HP 标记（多层障碍时显示数字）
    if (obstacle.hp > 1) {
      ctx.font = `bold ${size * 0.25}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.strokeText(`×${obstacle.hp}`, x + size * 0.82, y + size * 0.18);
      ctx.fillStyle = '#fff';
      ctx.fillText(`×${obstacle.hp}`, x + size * 0.82, y + size * 0.18);
    }

    ctx.restore();
  }

  /**
   * 绘制纯占位障碍物（无底部图块）
   * @param {string} [obstacleType='box'] - 'box' | 'grass'
   */
  _drawBoxObstacle(ctx, x, y, size, obstacleType = 'box', hp = 1) {
    const radius = size * 0.18;
    const padding = size * 0.06;
    const innerSize = size - padding * 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    if (obstacleType === 'grass') {
      // 草地：绿色底 + 贴图
      const grassImg = Assets.getImage('grass');
      if (grassImg) {
        ctx.globalAlpha = hp > 1 ? 0.7 : 1; 
        ctx.drawImage(grassImg, x + padding, y + padding, innerSize, innerSize);
        ctx.globalAlpha = 1;
      } else {
        const grad = ctx.createLinearGradient(x, y, x, y + size);
        if (hp > 1) {
          grad.addColorStop(0, '#4a9f2b');
          grad.addColorStop(1, '#1a6a0a');
        } else {
          grad.addColorStop(0, '#6abf4b');
          grad.addColorStop(1, '#3a8a2a');
        }
        this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, radius);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.font = `${size * 0.42}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌱', x + size / 2, y + size / 2);
      }
    } else {
      // 箱子：木色背景
      const boxImg = Assets.getImage('box');
      if (boxImg) {
        ctx.drawImage(boxImg, x + padding, y + padding, innerSize, innerSize);
      } else {
        const grad = ctx.createLinearGradient(x + padding, y + padding, x + padding, y + size - padding);
        grad.addColorStop(0, '#D4A754');
        grad.addColorStop(1, '#8B6914');
        this._roundRect(ctx, x + padding, y + padding, innerSize, innerSize, radius);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(101, 67, 33, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          const ly = y + padding + (innerSize * i) / 4;
          ctx.beginPath();
          ctx.moveTo(x + padding + 4, ly);
          ctx.lineTo(x + padding + innerSize - 4, ly);
          ctx.stroke();
        }
        ctx.font = `${size * 0.42}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', x + size / 2, y + size / 2 + size * 0.02);
      }
    }

    ctx.restore();
  }

  /**
   * 更新和绘制动画
   */
  _updateAnimations(ctx, timestamp) {
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const anim = this.activeAnimations[i];
      if (anim.update(timestamp, ctx, this)) {
        // 动画完成，移除
        this.activeAnimations.splice(i, 1);
        if (anim.onComplete) anim.onComplete();
      }
    }
  }

  /**
   * 添加动画
   * @param {Object} animation - { update(timestamp, ctx, renderer): boolean, onComplete?: () => void }
   */
  addAnimation(animation) {
    this.activeAnimations.push(animation);
  }

  playSwapAnimation(animation, fromA, fromB) {
    this._swapAnim = animation;
    this._swapFromA = fromA;
    this._swapFromB = fromB;
  }

  clearSwapAnimation() {
    this._swapAnim = null;
    this._swapFromA = null;
    this._swapFromB = null;
  }

  playRemoveAnimation(animation) {
    this._removeAnim = animation;
  }

  clearRemoveAnimation() {
    this._removeAnim = null;
  }

  playDropAnimation(animation) {
    this._dropAnim = animation;
  }

  clearDropAnimation() {
    this._dropAnim = null;
  }

  playShakeAnimation(animation, pos) {
    this._shakeAnim = animation;
    this._shakePos = pos;
  }

  clearShakeAnimation() {
    this._shakeAnim = null;
    this._shakePos = null;
  }

  clearTransientAnimations() {
    this.clearSwapAnimation();
    this.clearRemoveAnimation();
    this.clearDropAnimation();
    this.clearShakeAnimation();
    this.activeAnimations.length = 0;
  }

  /**
   * 是否有正在播放的动画
   * @returns {boolean}
   */
  hasActiveAnimations() {
    return this.activeAnimations.length > 0;
  }

  /**
   * 清除选中状态
   */
  clearSelection() {
    this.selectedTile = null;
  }

  /**
   * 绘制圆角矩形路径（优先使用原生 API，自动 fallback）
   */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  // ── 纸飞机飞行轨迹特效 ──

  /**
   * 添加一条飞行轨迹
   * @param {{r:number,c:number}} from - 起飞格
   * @param {{r:number,c:number}} to - 降落格
   */
  addPlaneTrail(from, to) {
    this._planeTrails.push({
      from,
      to,
      startTime: performance.now(),
      duration: 400,
    });
  }

  /** 清除所有飞行轨迹 */
  clearPlaneTrails() {
    this._planeTrails = [];
  }

  /**
   * 绘制飞行轨迹（发光直线 + 飞机图标沿轨迹移动）
   */
  _drawPlaneTrails(ctx, timestamp) {
    const now = timestamp || performance.now();
    const half = this.tileSize / 2;

    this._planeTrails = this._planeTrails.filter(trail => {
      const elapsed = now - trail.startTime;
      const progress = Math.min(elapsed / trail.duration, 1);

      const fromPx = this.gridToPixel(trail.from.r, trail.from.c);
      const toPx = this.gridToPixel(trail.to.r, trail.to.c);
      const x1 = fromPx.x + half, y1 = fromPx.y + half;
      const x2 = toPx.x + half, y2 = toPx.y + half;

      // 当前飞机位置
      const cx = x1 + (x2 - x1) * progress;
      const cy = y1 + (y2 - y1) * progress;

      ctx.save();

      // ── 飞行尾迹（渐变线） ──
      const alpha = 1 - progress * 0.6;
      const grad = ctx.createLinearGradient(x1, y1, cx, cy);
      grad.addColorStop(0, `rgba(0, 200, 255, ${alpha * 0.1})`);
      grad.addColorStop(1, `rgba(0, 200, 255, ${alpha * 0.8})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── 发光效果 ──
      ctx.shadowColor = 'rgba(0, 200, 255, 0.6)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── 飞机图标 ──
      if (progress < 1) {
        ctx.font = `${this.tileSize * 0.4}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = alpha;
        ctx.fillText('✈️', cx, cy);
      }

      // ── 降落点闪烁 ──
      if (progress > 0.7) {
        const flashAlpha = Math.sin((progress - 0.7) / 0.3 * Math.PI) * 0.5;
        ctx.fillStyle = `rgba(0, 200, 255, ${flashAlpha})`;
        ctx.fillRect(toPx.x + 2, toPx.y + 2, this.tileSize - 4, this.tileSize - 4);
      }

      ctx.restore();

      return progress < 1; // 保留未完成的轨迹
    });
  }
}
