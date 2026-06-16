/**
 * 真实浏览器冒烟测试：登录 root/root → 跳转 → 逐页访问 → 截图 + 控制台报错收集
 * 用法：node scripts/smoke-browser.mjs
 * 依赖：npx playwright（全局缓存可用），channel=chrome
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// 从 npx 缓存加载 playwright（避免本地安装）
const npxCache = path.join(process.env.HOME || '', '.npm/_npx');
const playwrightEntry = fs
  .readdirSync(npxCache)
  .map((d) => path.join(npxCache, d, 'node_modules', 'playwright', 'package.json'))
  .filter((p) => fs.existsSync(p))
  .map((p) => JSON.parse(fs.readFileSync(p, 'utf8')).version)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const { chromium } = require(
  path.join(
    npxCache,
    fs.readdirSync(npxCache).find((d) =>
      fs.existsSync(path.join(npxCache, d, 'node_modules', 'playwright', 'index.js')),
    ),
    'node_modules',
    'playwright',
  ),
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.resolve(__dirname, '../smoke-shots');
fs.rmSync(shotDir, { recursive: true, force: true });
fs.mkdirSync(shotDir, { recursive: true });

const BASE = 'http://localhost:5173';
const PAGES = [
  'login.html',
  'home.html',
  'admin.html',
  'model-config.html',
  'tool-experience.html',
  'tool-detail.html',
  'design-detail.html',
  'design-llm-log.html',
];

const results = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// 收集控制台错误与页面错误
const consoleErrors = [];
const pageErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => {
  pageErrors.push(err.message);
});

// ===== 1) 登录流程 =====
console.log('\n===== 1) 登录 root/root =====');
try {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('input[type="text"]', { timeout: 8000 });
  await page.fill('input[type="text"]', 'root');
  await page.fill('input[type="password"]', 'root');
  await page.screenshot({ path: path.join(shotDir, '00-login-filled.png') });

  // 点登录，等待导航（跳 home 或 model-config）
  await Promise.all([
    page.waitForURL(/home\.html|model-config\.html|admin\.html/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2000);
  const afterLoginUrl = page.url();
  console.log(`  登录后 URL: ${afterLoginUrl}`);
  await page.screenshot({ path: path.join(shotDir, '01-after-login.png') });
  results.push({ step: 'login', url: afterLoginUrl, status: afterLoginUrl.includes('login.html') ? 'FAIL(停在登录页)' : 'PASS' });

  // 验证 token 已写入 localStorage
  const token = await page.evaluate(() => localStorage.getItem('smart_cto_auth_token'));
  console.log(`  localStorage token: ${token ? token.slice(0, 24) + '...(已写入)' : '未写入'}`);
  results.push({ step: 'login-token', status: token ? 'PASS' : 'FAIL' });
} catch (e) {
  console.log(`  ✗ 登录失败: ${e.message}`);
  results.push({ step: 'login', status: `FAIL: ${e.message}` });
}

// ===== 2) 逐页访问（复用登录态）=====
console.log('\n===== 2) 逐页访问（登录态）=====');
for (const p of PAGES) {
  const beforeErrCount = consoleErrors.length + pageErrors.length;
  try {
    await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    const title = await page.title().catch(() => '(无标题)');
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 80) || '(空)').catch(() => '(空)');
    const hasContent = bodyText.length > 5 && !bodyText.startsWith('(空)');
    const newErrors = consoleErrors.slice(beforeErrCount).concat(pageErrors.slice(beforeErrCount - pageErrors.length < 0 ? 0 : beforeErrCount - pageErrors.length));
    const errCount = (consoleErrors.length + pageErrors.length) - beforeErrCount;
    const shot = path.join(shotDir, `${p.replace('.html', '')}.png`);
    await page.screenshot({ path: shot });
    const status = hasContent ? (errCount > 0 ? `WARN(${errCount}个控制台错误)` : 'PASS') : 'FAIL(空白)';
    console.log(`  ${p}: ${status} | title="${title}" | 内容="${bodyText.replace(/\n/g, ' ').slice(0, 50)}" | 错误=${errCount}`);
    results.push({ step: p, status, title, bodyPreview: bodyText.slice(0, 50), errors: errCount });
  } catch (e) {
    console.log(`  ${p}: FAIL(${e.message.split('\n')[0]})`);
    results.push({ step: p, status: `FAIL: ${e.message.split('\n')[0]}` });
  }
}

// ===== 3) 汇总错误 =====
console.log('\n===== 3) 控制台错误汇总（去重，前20）=====');
const uniqueErrors = [...new Set(consoleErrors.concat(pageErrors))];
if (uniqueErrors.length === 0) {
  console.log('  ✓ 无控制台错误');
} else {
  uniqueErrors.slice(0, 20).forEach((e, i) => console.log(`  ${i + 1}. ${e.slice(0, 150)}`));
  if (uniqueErrors.length > 20) console.log(`  ... 还有 ${uniqueErrors.length - 20} 条`);
}

await browser.close();

// ===== 4) 结果表 =====
console.log('\n========== 冒烟结果汇总 ==========');
console.log('步骤'.padEnd(24) + '状态'.padEnd(20) + '标题/备注');
console.log('-'.repeat(70));
for (const r of results) {
  console.log(String(r.step).padEnd(24) + String(r.status).padEnd(20) + (r.title || ''));
}
console.log('\n截图目录: ' + shotDir);
