#!/usr/bin/env node
/**
 * 一键启动前后端开发服务（dev.mjs）
 *
 * 用法（仓库根目录）：
 *   node dev.mjs              # 同时启动后端 + 前端
 *   node dev.mjs --backend    # 仅后端
 *   node dev.mjs --frontend   # 仅前端
 *   node dev.mjs --skip-db    # 跳过后端 prisma generate/migrate deploy（已在跑时加速重启）
 *
 * 后端启动流程遵循 .cursor/agents/product-delivery-orchestrator.md「后端代码修改后自动重启」：
 *   ① prisma generate  ② prisma migrate deploy（统一 deploy，避免 migrate dev 的 shadow db 权限错误）
 *   ③ kill 占用端口的旧进程（禁止端口顺延）  ④ npm run dev（ts-node-dev 热重载）
 *
 * 前端：frontend-vue/ 下 npm run dev（Vite，端口 5173）
 *
 * 日志统一加前缀：[backend] / [frontend]；Ctrl+C 统一清理子进程。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = __dirname;
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');
const FRONTEND_DIR = path.join(REPO_ROOT, 'frontend-vue');

const args = new Set(process.argv.slice(2));
const onlyBackend = args.has('--backend');
const onlyFrontend = args.has('--frontend');
const skipDb = args.has('--skip-db');
const runBackend = !onlyFrontend;
const runFrontend = !onlyBackend;
const FRONTEND_PORT = 5173; // frontend-vue vite 固定端口

/** 从 backend/.env 读 PORT（默认 3000） */
function readBackendPort() {
  const envFile = path.join(BACKEND_DIR, '.env');
  if (!fs.existsSync(envFile)) return 3000;
  const txt = fs.readFileSync(envFile, 'utf8');
  const m = txt.match(/^PORT\s*=\s*(\d+)/m);
  return m ? Number(m[1]) : 3000;
}

/** kill 占用指定端口的进程（遵循文档：禁止端口顺延，用当前端口） */
function killPort(port) {
  try {
    const ret = spawnSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' });
    const pids = (ret.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 9);
        log('backend', `killed PID ${pid} on :${port}`);
      } catch {
        // 进程可能已退出
      }
    }
  } catch {
    // lsof 不可用
  }
}

function log(tag, msg) {
  const t = new Date().toLocaleTimeString();
  console.log(`[${t}] [${tag}] ${msg}`);
}

/** 同步跑一个命令（用于 prisma generate / migrate deploy） */
function runSync(tag, cmd, argsArr, opts = {}) {
  log(tag, `$ ${cmd} ${argsArr.join(' ')}`);
  const ret = spawnSync(cmd, argsArr, { stdio: 'inherit', cwd: opts.cwd || BACKEND_DIR, ...opts });
  if (ret.status !== 0) {
    console.error(`\n[${tag}] 命令失败（exit ${ret.status}）：${cmd} ${argsArr.join(' ')}`);
    process.exit(ret.status ?? 1);
  }
}

/** 后端启动前准备：prisma generate + migrate deploy + kill 旧端口 */
function prepareBackend() {
  const port = readBackendPort();
  log('backend', `目标端口: ${port}（来自 backend/.env，禁止顺延）`);

  // 检查 backend/.env
  if (!fs.existsSync(path.join(BACKEND_DIR, '.env'))) {
    console.error('\n[backend] 缺少 backend/.env。请先执行：cp backend/.env.example backend/.env 并配置 DATABASE_URL');
    process.exit(1);
  }

  if (!skipDb) {
    // ① prisma generate
    runSync('backend', 'npx', ['prisma', 'generate']);
    // ② prisma migrate deploy（统一 deploy；migrate dev 在本地常因无 shadow db 权限报 P3014）
    log('backend', 'prisma migrate deploy（若有 pending 迁移会应用）');
    runSync('backend', 'npx', ['prisma', 'migrate', 'deploy']);
  } else {
    log('backend', '跳过 prisma generate/migrate deploy（--skip-db）');
  }

  // ③ kill 占用端口的旧进程
  killPort(port);

  return port;
}

/** 后台 spawn 一个长驻进程，带统一日志前缀 */
function spawnLong(tag, cmd, argsArr, opts = {}) {
  const child = spawn(cmd, argsArr, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: opts.cwd || REPO_ROOT,
    env: { ...process.env, ...opts.env },
    shell: false,
  });
  const prefix = `[${tag}] `;
  child.stdout?.on('data', (d) => d.toString().split('\n').forEach((line) => line && process.stdout.write(prefix + line + '\n')));
  child.stderr?.on('data', (d) => d.toString().split('\n').forEach((line) => line && process.stderr.write(prefix + line + '\n')));
  child.on('exit', (code, signal) => {
    log(tag, `进程退出 code=${code} signal=${signal}`);
  });
  return child;
}

const children = [];

function cleanup() {
  log('dev', '收到退出信号，清理子进程…');
  for (const c of children) {
    if (!c.killed && c.exitCode === null) {
      try {
        // 递归杀进程组（杀子进程的子进程）
        process.kill(-c.pid, 'SIGTERM');
      } catch {
        try { c.kill('SIGTERM'); } catch { /* ignore */ }
      }
    }
  }
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ===== 主流程 =====
console.log('\n========================================');
console.log(' Smart CTO 开发服务一键启动');
console.log('========================================\n');

if (runBackend) {
  const port = prepareBackend();
  // ④ npm run dev（ts-node-dev 热重载）；显式 NODE_ENV=development，避免继承到 production
  log('backend', 'npm run dev（ts-node-dev --respawn）');
  const be = spawnLong('backend', 'npm', ['run', 'dev'], {
    cwd: BACKEND_DIR,
    detached: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });
  children.push(be);
  log('backend', `后端启动中 → http://127.0.0.1:${port}/health`);
}

if (runFrontend) {
  // kill 占用前端端口的旧进程（与后端一致的"禁止顺延"口径）
  killPort(FRONTEND_PORT);
  log('frontend', 'npm run dev（Vite，端口 5173）');
  const fe = spawnLong('frontend', 'npm', ['run', 'dev'], {
    cwd: FRONTEND_DIR,
    detached: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });
  children.push(fe);
  log('frontend', '前端启动中 → http://localhost:5173/home.html');
}

console.log('\n（Ctrl+C 退出并清理所有子进程）\n');

// 保持进程存活
setInterval(() => {}, 1 << 30);
