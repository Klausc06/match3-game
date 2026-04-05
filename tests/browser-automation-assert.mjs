import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const GAME_URL = process.env.GAME_URL || 'http://localhost:8765';
const SWAP_ROUNDS = Number(process.env.SWAP_ROUNDS || 10);

function getCanvasClickPos(canvasBox, row, col, boardSize = 9) {
  const canvasSize = Math.min(canvasBox.width, canvasBox.height);
  const maxBoardPx = canvasSize * 0.92;
  const tileSize = Math.floor(maxBoardPx / boardSize);
  const boardPixelW = tileSize * boardSize;
  const boardPixelH = tileSize * boardSize;
  const offsetX = Math.floor((canvasSize - boardPixelW) / 2);
  const offsetY = Math.floor((canvasSize - boardPixelH) / 2);
  return {
    x: canvasBox.x + offsetX + col * tileSize + tileSize / 2,
    y: canvasBox.y + offsetY + row * tileSize + tileSize / 2,
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 540, height: 700 } });

  const criticalErrors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      msg.type() === 'error'
      || text.includes('RENDER BUG')
      || text.includes('[GameLoop]')
      || text.includes('TypeError')
    ) {
      criticalErrors.push(`[${msg.type()}] ${text}`);
    }
  });
  page.on('pageerror', (err) => {
    criticalErrors.push(`[pageerror] ${err.message}`);
  });

  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(500);

  const startBtn = page.locator('#btnStart');
  if (await startBtn.isVisible()) {
    await page.waitForFunction(() => {
      const btn = document.getElementById('btnStart');
      return Boolean(btn && !btn.disabled);
    }, null, { timeout: 30000 });
    await startBtn.click();
    await page.waitForSelector('#gameScreen.active', { timeout: 5000 });
  }

  await page.waitForSelector('#gameCanvas', { state: 'visible', timeout: 5000 });
  const canvasBox = await page.locator('#gameCanvas').boundingBox();
  assert.ok(canvasBox, 'Canvas should be visible after game start');

  const testPositions = [
    { r1: 4, c1: 4, r2: 4, c2: 5 },
    { r1: 5, c1: 3, r2: 6, c2: 3 },
    { r1: 2, c1: 5, r2: 2, c2: 6 },
    { r1: 6, c1: 2, r2: 7, c2: 2 },
  ];

  for (let i = 0; i < SWAP_ROUNDS; i++) {
    const p = testPositions[i % testPositions.length];
    const a = getCanvasClickPos(canvasBox, p.r1, p.c1);
    const b = getCanvasClickPos(canvasBox, p.r2, p.c2);
    await page.mouse.click(a.x, a.y);
    await page.waitForTimeout(120);
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(750);
  }

  const timerText = await page.locator('#timerDisplay').innerText();
  assert.ok(!timerText.includes('NaN'), `Timer should be valid, got "${timerText}"`);

  await browser.close();
  assert.equal(
    criticalErrors.length,
    0,
    `Playwright detected critical logs:\n${criticalErrors.join('\n')}`
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
