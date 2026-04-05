/**
 * Random utilities
 *
 * 提供可复现随机源（seeded RNG）以及统一洗牌接口。
 * 默认算法：xorshift32（轻量、可移植、无依赖）。
 */

function normalizeSeed(seed) {
  const value = Number(seed);
  if (!Number.isFinite(value)) return 1;
  const normalized = (Math.trunc(value) >>> 0);
  return normalized === 0 ? 1 : normalized;
}

export function createSeededRandom(seed = Date.now()) {
  let state = normalizeSeed(seed);

  return function random() {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const uint = state >>> 0;
    return uint / 4294967296;
  };
}

export function randomInt(randomFn, maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) return 0;
  return Math.floor(randomFn() * maxExclusive);
}

export function shuffleInPlace(randomFn, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(randomFn, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
