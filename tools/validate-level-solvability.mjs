import process from 'node:process';

import { Board } from '../js/core/Board.js';
import { GameConfig as C } from '../js/config/GameConfig.js';

const SAMPLE_COUNT = Math.max(1, Number(process.env.LEVEL_SAMPLE_COUNT || 80));

function validateTheme(name, themeConfig) {
  let immediateMatchCount = 0;
  let unresolvedDeadboardCount = 0;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const seed = i + 1;
    const board = new Board(C.BOARD_ROWS, C.BOARD_COLS, C.COLOR_COUNT, { seed });
    board.init(themeConfig.level);

    const immediateMatches = board.findMatches();
    if (immediateMatches.length > 0) {
      immediateMatchCount++;
      board.clearMatchFlags();
    }

    if (!board.hasValidMoves()) {
      board.shuffle();
      if (!board.hasValidMoves()) {
        unresolvedDeadboardCount++;
      }
    }
  }

  return {
    name,
    samples: SAMPLE_COUNT,
    immediateMatchCount,
    unresolvedDeadboardCount,
  };
}

const reports = [
  validateTheme('garden', C.GARDEN_THEME),
  validateTheme('home', C.HOME_THEME),
];

for (const report of reports) {
  console.log(
    `[${report.name}] samples=${report.samples}, immediate_matches=${report.immediateMatchCount}, unresolved_deadboards=${report.unresolvedDeadboardCount}`
  );
}

const hasFailure = reports.some(
  (r) => r.immediateMatchCount > 0 || r.unresolvedDeadboardCount > 0
);

if (hasFailure) {
  console.error('❌ level solvability validation failed');
  process.exit(1);
}

console.log('✅ level solvability validation passed');
