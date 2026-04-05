/**
 * LevelGenerator — 关卡自动生成器
 *
 * 根据预设规则（障碍物占比、种类分布、空间模式）
 * 程序化生成关卡配置，每次调用产生不同的布局。
 *
 * 生成规则由 GENERATION_PROFILES 定义，
 * 包括每种障碍物的占比范围、HP 分布和空间偏好。
 */

/**
 * 生成规则配置
 *
 * density: 障碍物总占比 (0-1)，例如 0.45 = 45% 格子有障碍
 * obstacleWeights: 每种障碍物的权重和参数
 *   - weight: 被选中的相对概率
 *   - hpRange: [min, max] HP 范围
 *   - cluster: 是否倾向于成簇放置
 *   - clusterSize: 簇的大小 [min, max]
 * voidChance: 空白格占比 (0-1)
 * symmetry: 'none' | 'mirror-x' | 'mirror-y' | 'quad' 对称模式
 */
const GENERATION_PROFILES = {
  home: {
    density: 0.45,
    voidChance: 0.08,
    symmetry: 'quad',
    obstacles: {
      carpet: { weight: 3, hpRange: [1, 1], cluster: true, clusterSize: [2, 4] },
      box:    { weight: 5, hpRange: [1, 2], cluster: true, clusterSize: [2, 5] },
      chain:  { weight: 3, hpRange: [1, 1], cluster: false },
      jelly:  { weight: 3, hpRange: [1, 1], cluster: true, clusterSize: [2, 3] },
    },
  },
  garden: {
    density: 0.50,
    voidChance: 0,
    symmetry: 'mirror-y',
    obstacles: {
      stream: { weight: 2, hpRange: [1, 1], cluster: true, clusterSize: [4, 9], clusterShape: 'line' },
      grass:  { weight: 6, hpRange: [1, 2], cluster: true, clusterSize: [3, 6] },
      chain:  { weight: 2, hpRange: [1, 1], cluster: false },
      box:    { weight: 2, hpRange: [1, 2], cluster: true, clusterSize: [2, 3] },
    },
  },
};

/**
 * 生成关卡配置
 * @param {'home'|'garden'} theme
 * @param {number} rows
 * @param {number} cols
 * @param {Function} [rng=Math.random] 随机数源
 * @returns {{ rules: Object, voidCells: Array, obstacles: Array }}
 */
export function generateLevel(theme, rows, cols, rng = Math.random) {
  const profile = GENERATION_PROFILES[theme];
  if (!profile) throw new Error(`Unknown theme: ${theme}`);

  const totalCells = rows * cols;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  // null = empty playable, 'void' = void cell, or obstacle object

  // ── Step 1: 放置空白格 (voidCells) ──
  const voidCells = [];
  if (profile.voidChance > 0) {
    placeVoids(grid, rows, cols, profile, rng, voidCells);
  }

  // ── Step 2: 计算可用格子 ──
  const playableCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === null) playableCells.push({ r, c });
    }
  }

  // ── Step 3: 生成障碍物 ──
  const targetCount = Math.floor(playableCells.length * profile.density);
  const obstacles = [];
  const obstacleTypes = Object.entries(profile.obstacles);
  const totalWeight = obstacleTypes.reduce((s, [, cfg]) => s + cfg.weight, 0);

  let placed = 0;
  let attempts = 0;
  const maxAttempts = targetCount * 10;

  while (placed < targetCount && attempts < maxAttempts) {
    attempts++;

    // 加权随机选取障碍类型
    const roll = rng() * totalWeight;
    let acc = 0;
    let chosenType = obstacleTypes[0][0];
    let chosenCfg = obstacleTypes[0][1];
    for (const [type, cfg] of obstacleTypes) {
      acc += cfg.weight;
      if (roll <= acc) {
        chosenType = type;
        chosenCfg = cfg;
        break;
      }
    }

    if (chosenCfg.cluster) {
      // 簇状放置
      const clusterMin = chosenCfg.clusterSize?.[0] ?? 2;
      const clusterMax = chosenCfg.clusterSize?.[1] ?? 4;
      const size = clusterMin + Math.floor(rng() * (clusterMax - clusterMin + 1));

      // 选一个起始空格
      const startIdx = Math.floor(rng() * playableCells.length);
      const start = playableCells[startIdx];
      if (!start || grid[start.r][start.c] !== null) continue;

      const clusterCells = [];

      if (chosenCfg.clusterShape === 'line') {
        // 线性簇（用于溪流）
        const vertical = rng() > 0.3; // 70% 概率纵向
        for (let i = 0; i < size; i++) {
          const r = vertical ? start.r + i : start.r;
          const c = vertical ? start.c : start.c + i;
          if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] === null) {
            clusterCells.push({ r, c });
          }
        }
      } else {
        // 自然扩散簇（BFS 扩展）
        const visited = new Set();
        const queue = [start];
        visited.add(`${start.r},${start.c}`);
        while (queue.length > 0 && clusterCells.length < size) {
          const idx = Math.floor(rng() * queue.length);
          const cell = queue.splice(idx, 1)[0];
          if (grid[cell.r][cell.c] !== null) continue;
          clusterCells.push(cell);
          // 扩展相邻格子
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nr = cell.r + dr, nc = cell.c + dc;
            const key = `${nr},${nc}`;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(key)) {
              visited.add(key);
              if (grid[nr][nc] === null) queue.push({ r: nr, c: nc });
            }
          }
        }
      }

      // 放置簇
      for (const cell of clusterCells) {
        if (grid[cell.r][cell.c] !== null) continue;
        const hp = chosenCfg.hpRange[0] + Math.floor(rng() * (chosenCfg.hpRange[1] - chosenCfg.hpRange[0] + 1));
        const obs = { r: cell.r, c: cell.c, type: chosenType, ...(chosenType !== 'carpet' && chosenType !== 'stream' ? { hp } : {}) };
        grid[cell.r][cell.c] = obs;
        obstacles.push(obs);
        placed++;
      }
    } else {
      // 散点放置
      const idx = Math.floor(rng() * playableCells.length);
      const cell = playableCells[idx];
      if (!cell || grid[cell.r][cell.c] !== null) continue;

      const hp = chosenCfg.hpRange[0] + Math.floor(rng() * (chosenCfg.hpRange[1] - chosenCfg.hpRange[0] + 1));
      const obs = { r: cell.r, c: cell.c, type: chosenType, ...(chosenType !== 'carpet' && chosenType !== 'stream' ? { hp } : {}) };
      grid[cell.r][cell.c] = obs;
      obstacles.push(obs);
      placed++;
    }
  }

  // ── Step 4: 应用对称 ──
  if (profile.symmetry !== 'none') {
    applySymmetry(grid, rows, cols, profile.symmetry, obstacles, voidCells);
  }

  return {
    rules: {
      fillMode: 'none',
      obstacleExpansion: 'none',
    },
    voidCells,
    obstacles,
  };
}

/**
 * 放置空白格（四角对称挖空）
 */
function placeVoids(grid, rows, cols, profile, rng, voidCells) {
  const maxVoids = Math.floor(rows * cols * profile.voidChance);
  // 从四角挖去小块
  const cornerSize = 1 + Math.floor(rng() * 2); // 挖 1-2 格深度
  const corners = [
    { rStart: 0, cStart: 0 },
    { rStart: 0, cStart: cols - cornerSize },
    { rStart: rows - cornerSize, cStart: 0 },
    { rStart: rows - cornerSize, cStart: cols - cornerSize },
  ];
  let count = 0;
  for (const corner of corners) {
    for (let r = corner.rStart; r < corner.rStart + cornerSize && r < rows; r++) {
      for (let c = corner.cStart; c < corner.cStart + cornerSize && c < cols; c++) {
        if (count >= maxVoids) break;
        grid[r][c] = 'void';
        voidCells.push({ r, c });
        count++;
      }
    }
  }
}

/**
 * 对称性镜像：将已放置的障碍物镜像到对侧
 */
function applySymmetry(grid, rows, cols, mode, obstacles, voidCells) {
  const toMirror = [...obstacles];
  const voidToMirror = [...voidCells];

  for (const obs of toMirror) {
    const mirrors = getMirrorPositions(obs.r, obs.c, rows, cols, mode);
    for (const { r, c } of mirrors) {
      if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] === null) {
        const mirrored = { ...obs, r, c };
        grid[r][c] = mirrored;
        obstacles.push(mirrored);
      }
    }
  }

  for (const v of voidToMirror) {
    const mirrors = getMirrorPositions(v.r, v.c, rows, cols, mode);
    for (const { r, c } of mirrors) {
      if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] === null) {
        grid[r][c] = 'void';
        voidCells.push({ r, c });
      }
    }
  }
}

function getMirrorPositions(r, c, rows, cols, mode) {
  const mr = rows - 1 - r;
  const mc = cols - 1 - c;
  switch (mode) {
    case 'mirror-x': return [{ r: mr, c }];
    case 'mirror-y': return [{ r, c: mc }];
    case 'quad':     return [{ r: mr, c }, { r, c: mc }, { r: mr, c: mc }];
    default:         return [];
  }
}
