/**
 * Leaderboard - localStorage 排行榜
 * 
 * 依据 SKILL.md：localStorage 存储，花园/家园分开记录
 * 
 * 事件（自定义扩展，SKILL.md 未明确定义）：
 *   leaderboard:updated { entries, newRank }
 */

import { EventBus } from './EventBus.js';
import { E } from '../config/Events.js';

const STORAGE_KEY_PREFIX = 'match3_leaderboard_';
const MAX_ENTRIES = 10;

export class Leaderboard {
  /**
   * @param {string} [theme='garden'] - 当前主题，排行榜按主题分开
   */
  constructor(theme = 'garden') {
    /** @type {string} */
    this.theme = theme;

    /** @type {Array<{name:string, score:number, date:string, combo:number}>} */
    this.entries = this._load();
  }

  /**
   * 切换主题（重新加载对应排行榜）
   */
  setTheme(theme) {
    this.theme = theme;
    this.entries = this._load();
  }

  /**
   * 从 localStorage 加载排行榜数据
   */
  _load() {
    try {
      const key = STORAGE_KEY_PREFIX + this.theme;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('[Leaderboard] Failed to load:', e);
      return [];
    }
  }

  /**
   * 保存到 localStorage
   */
  _save() {
    try {
      const key = STORAGE_KEY_PREFIX + this.theme;
      localStorage.setItem(key, JSON.stringify(this.entries));
    } catch (e) {
      console.warn('[Leaderboard] Failed to save:', e);
    }
  }

  /**
   * 提交新分数
   * @param {string} name - 玩家名字
   * @param {number} score - 分数
   * @param {number} [maxCombo=0] - 最高连消
   * @returns {number} 排名（1-based），-1 表示未上榜
   */
  submit(name, score, maxCombo = 0) {
    const entry = {
      name: name || 'Player',
      score,
      combo: maxCombo,
      date: new Date().toLocaleDateString(),
    };

    // 插入到正确位置（降序排列）
    let rank = -1;
    for (let i = 0; i < this.entries.length; i++) {
      if (score > this.entries[i].score) {
        this.entries.splice(i, 0, entry);
        rank = i + 1;
        break;
      }
    }

    if (rank === -1 && this.entries.length < MAX_ENTRIES) {
      this.entries.push(entry);
      rank = this.entries.length;
    }

    // 保留前 10 名
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
      if (rank > MAX_ENTRIES) rank = -1;
    }

    this._save();
    EventBus.emit(E.LEADERBOARD_UPDATED, { entries: this.entries, newRank: rank });
    return rank;
  }

  /**
   * 检查分数是否能上榜
   */
  isHighScore(score) {
    if (this.entries.length < MAX_ENTRIES) return true;
    return score > this.entries[this.entries.length - 1].score;
  }

  /**
   * 获取排行榜
   */
  getEntries() {
    return [...this.entries];
  }

  /**
   * 清空排行榜
   */
  clear() {
    this.entries = [];
    this._save();
    EventBus.emit(E.LEADERBOARD_UPDATED, { entries: [], newRank: -1 });
  }
}
