/**
 * HandcraftedLevels — 手工设计关卡库
 *
 * 每关都有明确的设计意图、核心挑战和难度定位。
 * 用于展示关卡设计能力，与程序化生成互补。
 */

/**
 * 生成 void 区域的辅助函数
 * 可传入一个二维 0/1 数组表示形状掩码（0=void, 1=playable）
 */
function shapeToVoids(shape, rows, cols) {
  const voids = [];
  const rOff = Math.floor((rows - shape.length) / 2);
  const cOff = Math.floor((cols - shape[0].length) / 2);

  // 先标记所有外围为 void
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      voids.push({ r, c });

  // 移除形状内的 playable 位置
  const playable = new Set();
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[0].length; c++)
      if (shape[r][c] === 1) playable.add(`${r + rOff},${c + cOff}`);

  return voids.filter(v => !playable.has(`${v.r},${v.c}`));
}

// ═══════════════════════════════════════════════════════
//  关卡定义
// ═══════════════════════════════════════════════════════

export const LEVELS = {

  // ── 关卡 1: 新手引导 ──
  // 设计意图：无障碍物，纯消除体验，让玩家熟悉操作
  // 难度：★☆☆☆☆
  // 核心挑战：无（纯体验）
  // 棋盘形状：中央 8×8 正方形
  tutorial: {
    name: '新手引导',
    theme: 'garden',
    difficulty: 1,
    designNote: '纯消除体验，无障碍物。让玩家建立操作肌肉记忆和"连锁消除→道具生成"的认知。',
    build(rows, cols) {
      const voids = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (r < 2 || r >= rows - 2 || c < 2 || c >= cols - 2)
            voids.push({ r, c });
      return { voidCells: voids, obstacles: [], rules: {} };
    },
  },

  // ── 关卡 2: 箱子围城 ──
  // 设计意图：引入箱子障碍，教会玩家"必须在旁边消除才能破坏箱子"
  // 难度：★★☆☆☆
  // 核心挑战：中央 2×2 箱子群阻断路径
  // 设计原则：障碍集中放置，给玩家足够空间操作
  boxFortress: {
    name: '箱子围城',
    theme: 'home',
    difficulty: 2,
    designNote: '中央十字形箱子群迫使图块绕行，教会玩家利用相邻消除破坏箱子。两侧留出大片操作空间。',
    build(rows, cols) {
      const mid = Math.floor(rows / 2);
      const obstacles = [];
      // 中央十字箱子
      for (let d = -1; d <= 1; d++) {
        obstacles.push({ r: mid, c: mid + d, type: 'box', hp: 1 });
        obstacles.push({ r: mid + d, c: mid, type: 'box', hp: 1 });
      }
      // 四角加固箱子 (hp=2)
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
        obstacles.push({ r: mid + dr * 3, c: mid + dc * 3, type: 'box', hp: 2 });

      return { voidCells: [], obstacles, rules: {} };
    },
  },

  // ── 关卡 3: 锁链迷阵 ──
  // 设计意图：锁链覆盖关键图块，限制移动性但不阻断匹配
  // 难度：★★★☆☆
  // 核心挑战：大量锁链图块无法移动，需精确匹配解锁
  // 棋盘形状：菱形
  chainMaze: {
    name: '锁链迷阵',
    theme: 'garden',
    difficulty: 3,
    designNote: '菱形棋盘 + 散布锁链。锁链图块可被匹配但不可移动，迫使玩家利用周围自由图块形成匹配。鞭炮和炸弹是解题关键道具。',
    build(rows, cols) {
      // 菱形 mask
      const center = Math.floor(rows / 2);
      const radius = 5;
      const voids = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (Math.abs(r - center) + Math.abs(c - center) > radius)
            voids.push({ r, c });

      // 在菱形内散布锁链（对称放置）
      const obstacles = [];
      const chainPositions = [
        [center - 2, center], [center + 2, center],
        [center, center - 2], [center, center + 2],
        [center - 1, center - 1], [center + 1, center + 1],
        [center - 1, center + 1], [center + 1, center - 1],
        [center - 3, center], [center + 3, center],
      ];
      for (const [r, c] of chainPositions)
        obstacles.push({ r, c, type: 'chain', hp: 1 });

      return { voidCells: voids, obstacles, rules: {} };
    },
  },

  // ── 关卡 4: 果冻花园 ──
  // 设计意图：果冻覆盖外围，需要从中心向外清理
  // 难度：★★★★☆
  // 核心挑战：外围果冻不可匹配+不可移动，必须用道具炸开
  // 棋盘形状：十字形
  jellyGarden: {
    name: '果冻花园',
    theme: 'home',
    difficulty: 4,
    designNote: '十字形棋盘，四条臂上铺满果冻。中心区域自由操作、生成道具，用道具清除两侧果冻。考验道具生成效率和资源分配。',
    build(rows, cols) {
      const mid = Math.floor(rows / 2);
      // 十字形：中间 4 行全开 + 中间 4 列全开
      const voids = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const inHBar = Math.abs(r - mid) <= 1;
          const inVBar = Math.abs(c - mid) <= 1;
          const inArm = (Math.abs(r - mid) <= 4 && inVBar) || (Math.abs(c - mid) <= 4 && inHBar);
          if (!inArm) voids.push({ r, c });
        }

      // 果冻覆盖臂的末端
      const obstacles = [];
      for (let d = 2; d <= 4; d++) {
        for (const sign of [-1, 1]) {
          obstacles.push({ r: mid + sign * d, c: mid, type: 'jelly', hp: 1 });
          obstacles.push({ r: mid + sign * d, c: mid - 1, type: 'jelly', hp: 1 });
          obstacles.push({ r: mid + sign * d, c: mid + 1, type: 'jelly', hp: 1 });
          obstacles.push({ r: mid, c: mid + sign * d, type: 'jelly', hp: 1 });
          obstacles.push({ r: mid - 1, c: mid + sign * d, type: 'jelly', hp: 1 });
          obstacles.push({ r: mid + 1, c: mid + sign * d, type: 'jelly', hp: 1 });
        }
      }

      return { voidCells: voids, obstacles, rules: {} };
    },
  },

  // ── 关卡 5: 终极挑战 ──
  // 设计意图：综合所有机制，高密度障碍
  // 难度：★★★★★
  // 核心挑战：箱子+锁链+草地混合，空间极度受限
  // 棋盘形状：环形（中心挖空）
  finalChallenge: {
    name: '终极挑战',
    theme: 'garden',
    difficulty: 5,
    designNote: '甜甜圈形棋盘（中心 4×4 挖空）+ 混合障碍。外环分布箱子墙和锁链，内环有草地簇。操作空间极小，需要精准利用鞭炮/炸弹打开局面。',
    build(rows, cols) {
      const mid = Math.floor(rows / 2);
      const voids = [];
      // 中心 4×4 挖空 + 四角挖空
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const inCenter = Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1;
          const inCorner = (r < 2 || r >= rows - 2) && (c < 2 || c >= cols - 2);
          if (inCenter || inCorner) voids.push({ r, c });
        }

      const obstacles = [];
      // 箱子环：距中心 3 格的环
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const dist = Math.max(Math.abs(r - mid), Math.abs(c - mid));
          if (dist === 3 && !(Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1))
            obstacles.push({ r, c, type: 'box', hp: 2 });
        }
      // 锁链散布在外环
      const chainSpots = [
        [2, mid], [rows - 3, mid], [mid, 2], [mid, cols - 3],
        [3, 3], [3, cols - 4], [rows - 4, 3], [rows - 4, cols - 4],
      ];
      for (const [r, c] of chainSpots)
        obstacles.push({ r, c, type: 'chain', hp: 1 });
      // 草地簇
      for (const [dr, dc] of [[-4, 0], [4, 0], [0, -4], [0, 4]])
        obstacles.push({ r: mid + dr, c: mid + dc, type: 'grass', hp: 2 });

      return { voidCells: voids, obstacles, rules: {} };
    },
  },
};

/**
 * 获取指定关卡的 levelConfig
 * @param {string} levelId
 * @param {number} rows
 * @param {number} cols
 * @returns {{ voidCells, obstacles, rules }}
 */
export function getHandcraftedLevel(levelId, rows, cols) {
  const level = LEVELS[levelId];
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  return level.build(rows, cols);
}
