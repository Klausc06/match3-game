import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

const contractPath = 'docs/contracts/game-contract.v1.json';
const contract = JSON.parse(read(contractPath));
const eventsText = read('js/config/Events.js');
const gameLoopText = read('js/core/GameLoop.js');
const rendererText = read('js/core/Renderer.js');
const boardText = read('js/core/Board.js');
const gameConfigText = read('js/config/GameConfig.js');
const architectureSkill = read('.agents/skills/architecture/SKILL.md');
const projectRulesSkill = read('.agents/skills/project-rules/SKILL.md');
const apiRef = read('docs/api-reference.md');

const eventPattern = /([A-Z_]+)\s*:\s*'([^']+)'/g;
const eventsInCode = {};
for (const match of eventsText.matchAll(eventPattern)) {
  eventsInCode[match[1]] = match[2];
}

for (const [key, value] of Object.entries(contract.events)) {
  if (eventsInCode[key] !== value) {
    fail(`事件不一致: ${key}. 期望 "${value}", 实际 "${eventsInCode[key] ?? 'missing'}"`);
  }
}

for (const legacy of contract.deprecated_events) {
  if (eventsText.includes(`'${legacy}'`)) {
    fail(`发现已废弃事件名仍在 Events.js 中: ${legacy}`);
  }
}

if (!/startSession\s*\(/.test(gameLoopText) || !/stopSession\s*\(/.test(gameLoopText)) {
  fail('GameLoop 缺少 startSession/stopSession');
}

if (!/EventBus\.emit\(E\.UI_HINT,\s*\{[\s\S]*cells:/.test(gameLoopText)) {
  fail('GameLoop 中 ui:hint 未包含 cells 字段');
}

for (const method of contract.public_apis.RendererAnimationApi) {
  if (!new RegExp(`\\n\\s*${method}\\s*\\(`).test(rendererText)) {
    fail(`Renderer 缺少公共动画方法: ${method}`);
  }
}

for (const method of contract.public_apis.Board) {
  if (!new RegExp(`\\n\\s*${method}\\s*\\(`).test(boardText)) {
    fail(`Board 缺少公共方法: ${method}`);
  }
}

if (!/obstacleExpansion/.test(gameConfigText) || !/fillMode/.test(gameConfigText)) {
  fail('GameConfig 缺少规则策略键：obstacleExpansion/fillMode');
}

const mustMentionCanonical = [
  architectureSkill.includes(contract.canonical_source),
  projectRulesSkill.includes(contract.canonical_source),
  apiRef.includes(contract.canonical_source),
];
if (mustMentionCanonical.includes(false)) {
  fail(`提示词或文档未引用单一真源: ${contract.canonical_source}`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('✅ contract 校验通过');
