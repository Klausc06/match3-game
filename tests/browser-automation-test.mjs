/**
 * browser-automation-test.mjs — 真实浏览器自动化测试
 * 
 * 用 Playwright 打开游戏，模拟点击操作，捕获 console 错误
 */

import { chromium } from 'playwright';

const GAME_URL = 'http://localhost:8765';
const SWAP_ROUNDS = 25;

// 在 canvas 上将棋盘坐标转换为像素坐标
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

async function main() {
  console.log('🎮 Playwright 浏览器自动化测试');
  console.log(`   目标: ${GAME_URL}`);
  console.log(`   模拟交换轮数: ${SWAP_ROUNDS}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 540, height: 700 } });

  // ── 收集所有 console 输出 ──
  const allLogs = [];
  const allErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    allLogs.push({ type: msg.type(), text, time: new Date().toISOString().slice(11, 19) });
    
    // 关键错误立即输出
    if (text.includes('RENDER BUG') || text.includes('异常') || text.includes('Error')) {
      if (msg.type() === 'error') {
        allErrors.push(text);
        console.error(`   🔴 [${new Date().toISOString().slice(11, 19)}] ${text.slice(0, 200)}`);
      }
    }
  });

  page.on('pageerror', err => {
    const msg = err.message || String(err);
    allErrors.push(msg);
    console.error(`   🔴 [PAGE ERROR] ${msg.slice(0, 200)}`);
  });

  // ── 打开页面 ──
  console.log('📂 打开页面...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);

  // 截图: 初始状态
  await page.screenshot({ path: 'tests/_screenshots/browser-01-start.png' });

  // 点击 Start
  const startBtn = page.locator('#btnStart');
  if (await startBtn.isVisible()) {
    await startBtn.click();
    console.log('▶️  已点击 Start');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/_screenshots/browser-02-after-start.png' });
  }

  // 注入 tile 计数监控到页面
  await page.evaluate(() => {
    window.__renderMonitor = {
      lastTileCount: -1,
      bugs: [],
      history: [],
      
      check(renderer) {
        try {
          if (!renderer?.board) return { ok: true };
          let tiles = 0, nulls = 0;
          for (let r = 0; r < renderer.board.rows; r++) {
            for (let c = 0; c < renderer.board.cols; c++) {
              renderer.board.getTile(r, c) ? tiles++ : nulls++;
            }
          }
          
          const entry = { time: Date.now(), tiles, nulls, total: renderer.board.rows * renderer.board.cols };
          this.history.push(entry);
          if (this.history.length > 500) this.history.shift();
          
          if (this.lastTileCount >= 40 && tiles < 5) {
            const bug = { ...entry, from: this.lastTileCount };
            this.bugs.push(bug);
            console.error(`[MONITOR] TILE COUNT CRASH! ${this.lastTileCount} → ${tiles} (nulls=${nulls})`);
          }
          this.lastTileCount = tiles;
          return entry;
        } catch(e) {
          return { error: e.message };
        }
      },
      
      getReport() {
        return {
          totalChecks: this.history.length,
          bugs: this.bugs,
          recentHistory: this.history.slice(-20),
        };
      }
    };
  });

  // ── 模拟多轮交换操作 ──
  console.log(`\n🔄 开始 ${SWAP_ROUNDS} 轮交换操作...\n`);

  // 预定义几组测试位置（覆盖不同区域）
  const testPositions = [
    { r1: 3, c1: 3, r2: 3, c2: 4 },   // 中央水平
    { r1: 4, c1: 4, r2: 5, c2: 4 },   // 中央垂直
    { r1: 2, c1: 5, r2: 2, c2: 6 },   // 上方水平
    { r1: 6, c1: 2, r2: 7, c2: 2 },   // 下方垂直
    { r1: 5, c1: 1, r2: 5, c2: 2 },   // 中左
    { r1: 1, c1: 3, r2: 2, c2: 3 },   // 上中
    { r1: 7, c1: 6, r2: 7, c2: 7 },   // 右下
    { r1: 4, c1: 6, r2: 4, c2: 7 },   // 中右
  ];

  let canvasBox = null;

  for (let round = 1; round <= SWAP_ROUNDS; round++) {
    // 每10轮重新获取 canvas 位置（以防布局变化）
    if (round === 1 || round % 10 === 1) {
      const el = page.locator('#gameCanvas');
      canvasBox = await el.boundingBox();
      if (!canvasBox) {
        console.warn(`   ⚠️ R${round}: Canvas not found`);
        continue;
      }
    }

    const pos = testPositions[round % testPositions.length];
    const p1 = getCanvasClickPos(canvasBox, pos.r1, pos.c1);
    const p2 = getCanvasClickPos(canvasBox, pos.r2, pos.c2);

    try {
      // 第一次点击（选中）
      await page.mouse.click(p1.x, p1.y);
      await page.waitForTimeout(180);

      // 第二次点击（尝试交换）
      await page.mouse.click(p2.x, p2.y);
      
      // 等待动画+连消完成
      await page.waitForTimeout(900);
    } catch (e) {
      console.warn(`   R${round} 操作异常: ${e.message?.slice(0, 80)}`);
    }

    // 定期截图和检查
    if (round % 5 === 0 || allErrors.length > 0) {
      await page.screenshot({ path: `tests/_screenshots/browser-R${round}.png` });
      
      // 获取页面内监控数据
      const monitorData = await page.evaluate(() => window.__renderMonitor?.getReport());
      if (monitorData) {
        console.log(`   📊 R${round} | 监控检查: ${monitorData.totalChecks}次 | Bugs: ${monitorData.bugs.length} | Console Errors: ${allErrors.length}`);
        
        if (monitorData.bugs.length > 0) {
          console.error(`   ❌ 发现 ${monitorData.bugs.length} 次 Tile 数崩溃!`);
          for (const b of monitorData.bugs) {
            console.error(`      ${b.from} → ${b.tiles} (time=${new Date(b.time).toISOString().slice(11, 19)})`);
          }
        }
        
        // 最近几次的 tile 计数趋势
        if (monitorData.recentHistory.length >= 3) {
          const latest = monitorData.recentHistory[monitorData.recentHistory.length - 1];
          console.log(`      最新: tiles=${latest.tiles} nulls=${latest.nulls}/${latest.total}`);
        }
      }
    }
  }

  // 最终截图 + 报告
  console.log('\n' + '='.repeat(60));
  console.log('📋 测试报告');
  console.log('='.repeat(60));
  await page.screenshot({ path: 'tests/_screenshots/browser-final.png' });

  const finalMonitor = await page.evaluate(() => window.__renderMonitor?.getReport());
  
  console.log(`总轮数: ${SWAP_ROUNDS}`);
  console.log(`Console logs 总数: ${allLogs.length}`);
  console.log(`Console errors 总数: ${allErrors.length}`);
  console.log(`Monitor 检查次数: ${finalMonitor?.totalChecks || 'N/A'}`);
  console.log(`Tile 崩溃事件: ${finalMonitor?.bugs?.length || 0}`);

  // 输出所有 RENDER 相关日志
  const renderLogs = allLogs.filter(l => l.text.includes('RENDER') || l.text.includes('tile') || l.text.includes('Bug'));
  if (renderLogs.length > 0) {
    console.log(`\n📝 渲染相关日志 (${renderLogs.length}):`);
    renderLogs.forEach(l => console.log(`   [${l.time}] [${l.type}] ${l.text.slice(0, 150)}`));
  }

  // 所有 error 日志
  if (allErrors.length > 0) {
    console.error(`\n🔴 全部 Errors (${allErrors.length}):`);
    allErrors.forEach((e, i) => console.error(`   ${i+1}. ${e.slice(0, 200)}`));
  } else {
    console.log('\n✅ 未捕获到 Error 级别日志');
  }

  // Canvas 像素分析 — 判断最终是否"素材消失"
  const pixelAnalysis = await page.evaluate(() => {
    const canvas = document.querySelector('#gameCanvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    
    let nonEmpty = 0, totalSamples = 0;
    for (let i = 0; i < data.length; i += 16) { // 每4像素采样
      totalSamples++;
      if (data[i+3] > 30 && (data[i] > 15 || data[i+1] > 15 || data[i+2] > 15)) nonEmpty++;
    }
    return { w, h, fillRatio: (nonEmpty / totalSamples * 100).toFixed(1) + '%' };
  });
  console.log(`\n🖼️  Canvas 像素分析: ${pixelAnalysis.w}x${pixelAnalysis.h}, 非空比例=${pixelAnalysis.fillRatio}`);

  await browser.close();
  console.log('\n✅ 浏览器测试完成');

  process.exit(allErrors.length > 0 || (finalMonitor?.bugs?.length || 0) > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('💥 测试失败:', e.message);
  process.exit(2);
});
