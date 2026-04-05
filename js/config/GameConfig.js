import { PU } from './PowerUpTypes.js';

export const GameConfig = Object.freeze({
  BOARD_ROWS:   12,
  BOARD_COLS:   12,
  COLOR_COUNT:  5,

  GAME_DURATION:     80,
  WARNING_THRESHOLD: 10,

  SCORE_MATCH_3:      100,
  SCORE_MATCH_4:      200,
  SCORE_MATCH_5:      300,
  SCORE_MATCH_6:      400,
  SCORE_MATCH_7_PLUS: 500,
  SCORE_OBSTACLE:     150,
  SCORE_POWERUP_CELL: 50,
  CASCADE_MULTIPLIER: 1.5,

  SWAP_DURATION:         200,
  REMOVE_DURATION:       300,
  DROP_DURATION_PER_CELL: 80,
  INVALID_SWAP_DURATION: 150,
  REFILL_SETTLE_DELAY:   100,

  HINT_IDLE_MS: 3000,
  MAX_SHUFFLE_ATTEMPTS: 50,

  GARDEN_THEME: {
    tiles: {
      0: { assetId: 'leaf',   name: 'green'  },
      1: { assetId: 'apple',  name: 'red'    },
      2: { assetId: 'pear',   name: 'yellow' },
      3: { assetId: 'drop',   name: 'blue'   },
      4: { assetId: 'flower', name: 'purple' },
    },
    powerUps: {
      match4H:      PU.FIRECRACKER,
      match4V:      PU.FIRECRACKER,
      match4Square: null,
      match5LT:     PU.GARDEN_BOMB,
      match6LT:     PU.DYNAMITE,
      match7LT:     PU.TNT,
      match5Line:   PU.RAINBOW,
    },
    boardStyle: {
      cellEven: 'rgba(144, 238, 144, 0.12)',
      cellOdd:  'rgba(144, 238, 144, 0.06)',
      border:   'rgba(34, 139, 34, 0.3)',
    },
  },

  HOME_THEME: {
    tiles: {
      0: { assetId: 'book',    name: 'green'  },
      1: { assetId: 'bowtie',  name: 'red'    },
      2: { assetId: 'lamp',    name: 'warm'   },
      3: { assetId: 'cup',     name: 'blue'   },
      4: { assetId: 'cushion', name: 'purple' },
    },
    powerUps: {
      match4H:      PU.ROCKET_H,
      match4V:      PU.ROCKET_V,
      match4Square: PU.PAPERPLANE,
      match5LT:     PU.HOME_BOMB,
      match6LT:     PU.HOME_BOMB,
      match7LT:     PU.HOME_BOMB,
      match5Line:   PU.RAINBOW,
    },
    boardStyle: {
      cellEven: 'rgba(255, 228, 196, 0.12)',
      cellOdd:  'rgba(255, 228, 196, 0.06)',
      border:   'rgba(205, 133, 63, 0.3)',
    },
  },
});
