import { Tile } from '../../elements/Tile.js';

export function createNonMatchingTile(board, r, c) {
  let tile;
  let attempts = 0;
  do {
    tile = Tile.random(board.colorCount, () => board.random());
    attempts++;
    if (attempts > 50) break;
  } while (wouldMatch(board, r, c, tile.color));
  return tile;
}

function wouldMatch(board, r, c, color) {
  if (c >= 2) {
    const t1 = board.getTile(r, c - 1);
    const t2 = board.getTile(r, c - 2);
    if (t1 && t2 && t1.color === color && t2.color === color) return true;
  }

  if (r >= 2) {
    const t1 = board.getTile(r - 1, c);
    const t2 = board.getTile(r - 2, c);
    if (t1 && t2 && t1.color === color && t2.color === color) return true;
  }

  return false;
}

export function hasMatchAt(board, r, c) {
  if (!board.isPlayableCell(r, c)) return false;
  const tile = board.getTile(r, c);
  if (!tile || !tile.canMatch()) return false;
  const color = tile.color;

  let hCount = 1;
  for (let i = c - 1; i >= 0; i--) {
    if (!board.isPlayableCell(r, i)) break;
    const t = board.getTile(r, i);
    if (t && t.canMatch() && t.color === color) hCount++;
    else break;
  }
  for (let i = c + 1; i < board.cols; i++) {
    if (!board.isPlayableCell(r, i)) break;
    const t = board.getTile(r, i);
    if (t && t.canMatch() && t.color === color) hCount++;
    else break;
  }
  if (hCount >= 3) return true;

  let vCount = 1;
  for (let i = r - 1; i >= 0; i--) {
    if (!board.isPlayableCell(i, c)) break;
    const t = board.getTile(i, c);
    if (t && t.canMatch() && t.color === color) vCount++;
    else break;
  }
  for (let i = r + 1; i < board.rows; i++) {
    if (!board.isPlayableCell(i, c)) break;
    const t = board.getTile(i, c);
    if (t && t.canMatch() && t.color === color) vCount++;
    else break;
  }

  return vCount >= 3;
}

function quickSwap(board, r1, c1, r2, c2) {
  const tmp = board.grid[r1][c1];
  board.grid[r1][c1] = board.grid[r2][c2];
  board.grid[r2][c2] = tmp;
}

export function hasValidMoves(board) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (!board.isPlayableCell(r, c)) continue;
      const tile = board.getTile(r, c);
      if (!tile || !tile.canSwap()) continue;

      if (c < board.cols - 1 && board.isPlayableCell(r, c + 1)) {
        const right = board.getTile(r, c + 1);
        if (right && right.canSwap()) {
          quickSwap(board, r, c, r, c + 1);
          const found = hasMatchAt(board, r, c) || hasMatchAt(board, r, c + 1);
          quickSwap(board, r, c, r, c + 1);
          if (found) return true;
        }
      }

      if (r < board.rows - 1 && board.isPlayableCell(r + 1, c)) {
        const down = board.getTile(r + 1, c);
        if (down && down.canSwap()) {
          quickSwap(board, r, c, r + 1, c);
          const found = hasMatchAt(board, r, c) || hasMatchAt(board, r + 1, c);
          quickSwap(board, r, c, r + 1, c);
          if (found) return true;
        }
      }
    }
  }

  return false;
}

export function findPossibleMoves(board) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (!board.isPlayableCell(r, c)) continue;
      const tile = board.getTile(r, c);
      if (!tile || !tile.canSwap()) continue;

      if (c < board.cols - 1 && board.isPlayableCell(r, c + 1)) {
        const right = board.getTile(r, c + 1);
        if (right && right.canSwap()) {
          quickSwap(board, r, c, r, c + 1);
          if (hasMatchAt(board, r, c) || hasMatchAt(board, r, c + 1)) {
            quickSwap(board, r, c, r, c + 1);
            return { from: { r, c }, to: { r, c: c + 1 } };
          }
          quickSwap(board, r, c, r, c + 1);
        }
      }

      if (r < board.rows - 1 && board.isPlayableCell(r + 1, c)) {
        const down = board.getTile(r + 1, c);
        if (down && down.canSwap()) {
          quickSwap(board, r, c, r + 1, c);
          if (hasMatchAt(board, r, c) || hasMatchAt(board, r + 1, c)) {
            quickSwap(board, r, c, r + 1, c);
            return { from: { r, c }, to: { r: r + 1, c } };
          }
          quickSwap(board, r, c, r + 1, c);
        }
      }
    }
  }

  return null;
}

export function clearMatchFlags(board) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (!board.isPlayableCell(r, c)) continue;
      const tile = board.getTile(r, c);
      if (tile) tile.isMatched = false;
    }
  }
}

export function findMatches(board) {
  const matches = [];
  const matched = new Set();

  for (let r = 0; r < board.rows - 1; r++) {
    for (let c = 0; c < board.cols - 1; c++) {
      if (
        !board.isPlayableCell(r, c)
        || !board.isPlayableCell(r, c + 1)
        || !board.isPlayableCell(r + 1, c)
        || !board.isPlayableCell(r + 1, c + 1)
      ) {
        continue;
      }
      const tl = board.getTile(r, c);
      const tr = board.getTile(r, c + 1);
      const bl = board.getTile(r + 1, c);
      const br = board.getTile(r + 1, c + 1);
      if (!tl || !tr || !bl || !br) continue;
      if (!tl.canMatch() || !tr.canMatch() || !bl.canMatch() || !br.canMatch()) continue;
      const color = tl.color;
      if (tr.color === color && bl.color === color && br.color === color) {
        const cells = [
          { r, c }, { r, c: c + 1 },
          { r: r + 1, c }, { r: r + 1, c: c + 1 },
        ];
        cells.forEach((pos) => matched.add(`${pos.r},${pos.c}`));
        matches.push({ cells, type: 'square' });
      }
    }
  }

  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols - 2; c++) {
      if (!board.isPlayableCell(r, c)) continue;
      const tile = board.getTile(r, c);
      if (!tile || !tile.canMatch()) continue;

      const color = tile.color;
      let end = c + 1;
      while (end < board.cols) {
        if (!board.isPlayableCell(r, end)) break;
        const next = board.getTile(r, end);
        if (!next || !next.canMatch() || next.color !== color) break;
        end++;
      }

      const length = end - c;
      if (length >= 3) {
        const cells = [];
        for (let i = c; i < end; i++) {
          cells.push({ r, c: i });
          matched.add(`${r},${i}`);
        }
        matches.push({ cells, type: 'horizontal' });
        c = end - 1;
      }
    }
  }

  for (let c = 0; c < board.cols; c++) {
    for (let r = 0; r < board.rows - 2; r++) {
      if (!board.isPlayableCell(r, c)) continue;
      const tile = board.getTile(r, c);
      if (!tile || !tile.canMatch()) continue;

      const color = tile.color;
      let end = r + 1;
      while (end < board.rows) {
        if (!board.isPlayableCell(end, c)) break;
        const next = board.getTile(end, c);
        if (!next || !next.canMatch() || next.color !== color) break;
        end++;
      }

      const length = end - r;
      if (length >= 3) {
        const cells = [];
        for (let i = r; i < end; i++) {
          cells.push({ r: i, c });
          matched.add(`${i},${c}`);
        }
        matches.push({ cells, type: 'vertical' });
        r = end - 1;
      }
    }
  }

  const groups = groupMatches(board, matches);

  for (const key of matched) {
    const [r, c] = key.split(',').map(Number);
    const tile = board.getTile(r, c);
    if (tile) tile.isMatched = true;
  }

  return groups;
}

function groupMatches(board, matches) {
  const groups = [];
  // cell-key → group index 快速查找，避免 O(n²) 遍历
  const cellToGroup = new Map();

  for (const match of matches) {
    // 找到与本 match 重叠的已有 group
    let targetIdx = -1;
    for (const cell of match.cells) {
      const key = cell.r * 100 + cell.c;
      if (cellToGroup.has(key)) {
        targetIdx = cellToGroup.get(key);
        break;
      }
    }

    if (targetIdx >= 0) {
      // 合并到已有 group
      const group = groups[targetIdx];
      for (const cell of match.cells) {
        const key = cell.r * 100 + cell.c;
        if (!cellToGroup.has(key) || cellToGroup.get(key) !== targetIdx) {
          if (!group.cells.some((gc) => gc.r === cell.r && gc.c === cell.c)) {
            group.cells.push(cell);
          }
          cellToGroup.set(key, targetIdx);
        }
      }
      group.originalMatches.push(match);
      if (match.type === 'square') group.matchType = 'square';
    } else {
      // 新建 group
      const idx = groups.length;
      const group = {
        cells: [...match.cells],
        originalMatches: [match],
        matchType: match.type === 'square' ? 'square' : 'linear',
        powerUpToSpawn: null,
        spawnPoint: null,
      };
      groups.push(group);
      for (const cell of match.cells) {
        cellToGroup.set(cell.r * 100 + cell.c, idx);
      }
    }
  }

  for (const group of groups) {
    const cellCount = group.cells.length;
    const isLine = group.originalMatches.length === 1;
    const isSquare = group.matchType === 'square';

    if (isSquare) {
      group.powerUpToSpawn = 'match4Square';
    } else if (cellCount >= 5 && isLine) {
      group.powerUpToSpawn = 'match5Line';
    } else if (cellCount >= 5 && !isLine) {
      if (cellCount >= 7) {
        group.powerUpToSpawn = 'match7LT';
      } else if (cellCount === 6) {
        group.powerUpToSpawn = 'match6LT';
      } else {
        group.powerUpToSpawn = 'match5LT';
      }
      
      // 确定炸弹消除方向：取最长的匹配方向（主要用于家园十字炸弹）
      const hMatch = group.originalMatches.find(m => m.type === 'horizontal');
      const vMatch = group.originalMatches.find(m => m.type === 'vertical');
      const hLen = hMatch ? hMatch.cells.length : 0;
      const vLen = vMatch ? vMatch.cells.length : 0;
      group.bombDirection = vLen >= hLen ? 'vertical' : 'horizontal';
    } else if (cellCount === 4 && isLine) {
      // 垂直原则：横向匹配 → 纵向火箭，纵向匹配 → 横向火箭
      const matchType = group.originalMatches[0].type;
      group.powerUpToSpawn = matchType === 'horizontal' ? 'match4V' : 'match4H';
    }

    if (!group.powerUpToSpawn) continue;

    let spawnPoint = group.cells[0];
    if (board.lastSwap) {
      const inGroup = (pt) => group.cells.find((cell) => cell.r === pt.r && cell.c === pt.c);
      if (inGroup(board.lastSwap.to)) spawnPoint = board.lastSwap.to;
      else if (inGroup(board.lastSwap.from)) spawnPoint = board.lastSwap.from;
    } else if (!isLine) {
      const hMatch = group.originalMatches.find((m) => m.type === 'horizontal');
      const vMatch = group.originalMatches.find((m) => m.type === 'vertical');
      if (hMatch && vMatch) {
        const cross = hMatch.cells.find((hc) =>
          vMatch.cells.some((vc) => vc.r === hc.r && vc.c === hc.c)
        );
        if (cross) spawnPoint = cross;
      }
    }

    group.spawnPoint = spawnPoint;
  }

  return groups;
}
