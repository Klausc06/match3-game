# Match-3 Game Evolution Roadmap

This document outlines the future development plans and gameplay directions for our Match-3 game, based on the finalized original implementation and design research.

## Phase 1: Competitive Excitement (竞技要素升级)

*Goal: Magnify the fast-paced 90-second arcade feel.*

1. **Fever Time (狂热模式)**
   - **Trigger**: When the Combo count hits a specific threshold (e.g., 10+).
   - **Duration**: 10 seconds.
   - **Effect**: All basic matches trigger minor explosions (small firecrackers or rockets) and the base score multiplier is doubled.
   - **Visuals**: Dynamic screen border glow and intense tempo BGM.

2. **Dynamic Random Events (动态环境干扰)**
   - **Trigger**: Randomly every 30 seconds.
   - **Effects**: Examples include "Ice Storm" (randomly freezing 5 tiles) or "Coin Rain" (dropping high-scoring tiles).

## Phase 2: Board Mechanics (关卡/盘面机制丰富)

*Goal: Introduce classic strategic elements inspired by Playrix mechanics.*

1. **Drop Collectibles (收集物落袋)**
   - **Items**: Cherries, Acorns, or Diamonds.
   - **Mechanic**: These items cannot be matched. The player must clear the tiles below them to make them drop to the final row to collect them. Earning significant bonus time/score.

2. **Portals (传送门黑洞)**
   - **Mechanic**: Tiles can fall into an entry portal in one column and reappear from an exit portal in another, breaking the standard vertical drop logic and creating new puzzle dynamics.

3. **Chameleon Tiles (变色龙)**
   - **Mechanic**: Specific tiles that shift their color automatically on a timer or after every move, forcing the player to act quickly or risk ruining their planned match.

## Phase 3: External Boosters (未来拓展)

*Goal: Give players powerful, out-of-turn "Get out of jail free" cards.*

1. **Magic Hammer**: Instantly destroy any tile or obstacle without taking a move.
2. **Rubber Glove**: Swap any two non-matching tiles without consuming time, helping to set up a massive match-5 combo.
