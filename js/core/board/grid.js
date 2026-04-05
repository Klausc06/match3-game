import { EventBus } from '../EventBus.js';
import { E } from '../../config/Events.js';
import {
  clearMatchFlags,
  createNonMatchingTile,
  findMatches,
  hasValidMoves,
} from './matching.js';

export function dropTiles(board) {
  const drops = [];

  for (let c = 0; c < board.cols; c++) {
    let writePos = board.rows - 1;
    while (writePos >= 0 && !board.isPlayableCell(writePos, c)) writePos--;

    for (let r = board.rows - 1; r >= 0; r--) {
      if (!board.isPlayableCell(r, c)) {
        writePos = r - 1;
        while (writePos >= 0 && !board.isPlayableCell(writePos, c)) writePos--;
        continue;
      }

      const tile = board.getTile(r, c);
      if (tile === null) continue;

      if (tile.obstacle && !tile.isMovable) {
        writePos = r - 1;
        while (writePos >= 0 && !board.isPlayableCell(writePos, c)) writePos--;
        continue;
      }

      while (writePos >= 0 && !board.isPlayableCell(writePos, c)) writePos--;
      if (writePos < 0) break;

      if (r !== writePos) {
        board.grid[writePos][c] = tile;
        board.grid[r][c] = null;
        drops.push({ from: { r, c }, to: { r: writePos, c } });
      }
      writePos--;
      while (writePos >= 0 && !board.isPlayableCell(writePos, c)) writePos--;
    }
  }

  if (drops.length > 0) EventBus.emit(E.BOARD_DROPPED, { drops });
  return drops;
}

export function fillEmpty(board) {
  const newTiles = [];

  for (let c = 0; c < board.cols; c++) {
    for (let r = 0; r < board.rows; r++) {
      if (!board.isPlayableCell(r, c)) continue;
      if (board.grid[r][c] !== null) continue;
      const tile = createNonMatchingTile(board, r, c);
      board.grid[r][c] = tile;
      newTiles.push({ r, c, color: tile.color });
    }
  }

  if (newTiles.length > 0) EventBus.emit(E.BOARD_REFILLED, { newTiles });
  return newTiles;
}

export function shuffle(board) {
  const movableTiles = [];
  const positions = [];

  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (!board.isPlayableCell(r, c)) continue;
      const tile = board.getTile(r, c);
      if (tile && tile.isMovable) {
        movableTiles.push(tile);
        positions.push({ r, c });
      }
    }
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    board.shuffleArrayInPlace(movableTiles);

    for (let i = 0; i < positions.length; i++) {
      const { r, c } = positions[i];
      movableTiles[i].isMatched = false;
      board.grid[r][c] = movableTiles[i];
    }

    const hasMatches = findMatches(board).length > 0;
    clearMatchFlags(board);
    if (!hasMatches && hasValidMoves(board)) {
      EventBus.emit(E.BOARD_SHUFFLED, { grid: board.grid });
      return;
    }
  }

  console.warn('[Board] shuffle() 达到最大尝试次数，强制接受当前棋盘');
  clearMatchFlags(board);
  EventBus.emit(E.BOARD_SHUFFLED, { grid: board.grid });
}
