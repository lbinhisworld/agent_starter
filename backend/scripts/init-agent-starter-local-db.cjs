/**
 * [INPUT]: backend/.env 或 backend/docs/dotenv.local.template；本机 MySQL/MariaDB
 * [OUTPUT]: 创建 agent_starter 库、prisma db push、管理员 root/root（bcrypt）
 * [POS]: agent-starter 本地一键建库脚本（macOS/Linux/Windows 均可 node 直跑）
 *
 * [PROTOCOL]: 逻辑变更时同步 backend/scripts/AGENTS.md 与 docs/plans/agent-starter/README.md §7
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { URL } = require('url');
const bcrypt = require('bcryptjs');
const mariadb = require('mariadb');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');
const ENV_FILE = path.join(BACKEND_ROOT, '.env');
const ENV_TEMPLATE = path.join(BACKEND_ROOT, 'docs', 'dotenv.local.template');
const FRONTEND_LOCAL_EXAMPLE = path.join(REPO_ROOT, 'frontend-vue', 'public', 'static', 'config.js');
const FRONTEND_LOCAL = path.join(REPO_ROOT, 'frontend-vue', 'public', 'static', 'config.local.js');

const DEFAULTS = {
  database: 'agent_starter',
  user: 'smart_cto_app',
  password: '',
  host: '127.0.0.1',
  port: 3306,
  backendPort: 6668,
  adminUsername: 'root',
  adminPassword: 'root',
};

const PLACEHOLDER_HASH = 'local-dev-placeholder-hash';

function readDotEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = String(line || '').trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      v.length >= 2 &&
      ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function parseDatabaseUrl(databaseUrl) {
  const u = new URL(databaseUrl);
  return {
    host: u.hostname || DEFAULTS.host,
    port: Number(u.port || DEFAULTS.port),
    user: decodeURIComponent(u.username || DEFAULTS.user),
    password: decodeURIComponent(u.password || ''),
    database: (u.pathname || '').replace(/^\//, '') || DEFAULTS.database,
  };
}

function ensureEnvFile() {
  if (fs.existsSync(ENV_FILE)) {
    console.log('[init-db] 使用已有 backend/.env');
    return;
  }
  if (!fs.existsSync(ENV_TEMPLATE)) {
    throw new Error(`缺少 ${ENV_TEMPLATE}，无法生成 backend/.env`);
  }
  fs.copyFileSync(ENV_TEMPLATE, ENV_FILE);
  console.log('[init-db] 已从模板生成 backend/.env');
}

function ensureFrontendLocalConfig() {
  if (fs.existsSync(FRONTEND_LOCAL)) return;
  if (!fs.existsSync(FRONTEND_LOCAL_EXAMPLE)) return;
  fs.copyFileSync(FRONTEND_LOCAL_EXAMPLE, FRONTEND_LOCAL);
  console.log('[init-db] 已从示例生成 frontend-vue/public/static/config.local.js');
}

async function tryCreateDatabaseAndGrant(dbCfg) {
  const ddl = `CREATE DATABASE IF NOT EXISTS \`${dbCfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
  const grant = `GRANT ALL PRIVILEGES ON \`${dbCfg.database}\`.* TO ?@'127.0.0.1'`;
  const flush = 'FLUSH PRIVILEGES';

  const adminAttempts = [
    // macOS Homebrew MariaDB：当前 OS 用户 socket 登录常具建库权限
    { label: 'socket(current-user)', config: { socketPath: process.env.MYSQL_UNIX_SOCKET || '/tmp/mysql.sock' } },
    { label: 'tcp(root@localhost)', config: { host: dbCfg.host, port: dbCfg.port, user: 'root', password: '' } },
  ];

  for (const attempt of adminAttempts) {
    let conn;
    try {
      conn = await mariadb.createConnection({ ...attempt.config, connectTimeout: 5000 });
      await conn.query(ddl);
      try {
        await conn.query(grant, [dbCfg.user]);
        await conn.query(flush);
      } catch (grantErr) {
        // 应用账号可能已存在授权，忽略 GRANT 失败
        console.warn(`[init-db] GRANT 跳过（${attempt.label}）: ${grantErr.message}`);
      }
      console.log(`[init-db] 建库/授权完成（${attempt.label}）: ${dbCfg.database}`);
      return true;
    } catch (err) {
      console.warn(`[init-db] 建库尝试失败（${attempt.label}）: ${err.message}`);
    } finally {
      if (conn) await conn.end().catch(() => {});
    }
  }
  return false;
}

function runPrismaDbPush() {
  console.log('[init-db] prisma generate + db push …');
  execSync('npm run prisma:generate', { cwd: BACKEND_ROOT, stdio: 'inherit' });
  execSync('npx prisma db push', { cwd: BACKEND_ROOT, stdio: 'inherit', env: { ...process.env } });
}

async function ensureRootAdmin(dbCfg) {
  const hash = await bcrypt.hash(DEFAULTS.adminPassword, 10);
  let conn;
  try {
    conn = await mariadb.createConnection({
      host: dbCfg.host,
      port: dbCfg.port,
      user: dbCfg.user,
      password: dbCfg.password,
      database: dbCfg.database,
      connectTimeout: 10000,
    });
    const rows = await conn.query(
      'SELECT id, username, passwordHash FROM AdminUser WHERE username = ? LIMIT 1',
      [DEFAULTS.adminUsername],
    );
    const existing = rows[0];
    if (!existing) {
      const id = `adm_root_${Math.random().toString(16).slice(2, 10)}`;
      await conn.query(
        'INSERT INTO AdminUser (id, username, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())',
        [id, DEFAULTS.adminUsername, hash],
      );
      console.log(`[init-db] 已创建管理员 ${DEFAULTS.adminUsername}/${DEFAULTS.adminPassword}`);
      return;
    }
    const needUpdate =
      existing.passwordHash === PLACEHOLDER_HASH ||
      !String(existing.passwordHash || '').startsWith('$2');
    if (needUpdate) {
      await conn.query('UPDATE AdminUser SET passwordHash = ?, updatedAt = NOW() WHERE id = ?', [
        hash,
        existing.id,
      ]);
      console.log(`[init-db] 已重置管理员密码为 ${DEFAULTS.adminUsername}/${DEFAULTS.adminPassword}`);
    } else {
      console.log(`[init-db] 管理员 ${DEFAULTS.adminUsername} 已存在且密码哈希有效，跳过重置`);
    }
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

async function main() {
  ensureEnvFile();
  ensureFrontendLocalConfig();

  const env = readDotEnvFile(ENV_FILE);
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('backend/.env 缺少 DATABASE_URL');
  }
  const dbCfg = parseDatabaseUrl(databaseUrl);
  console.log(`[init-db] 目标库: ${dbCfg.database} @ ${dbCfg.host}:${dbCfg.port}（用户 ${dbCfg.user}）`);

  const created = await tryCreateDatabaseAndGrant(dbCfg);
  if (!created) {
    console.warn('[init-db] 未能以管理员身份建库；若库已存在可继续。否则请手动执行 CREATE DATABASE agent_starter');
  }

  runPrismaDbPush();
  await ensureRootAdmin(dbCfg);

  const port = env.PORT || String(DEFAULTS.backendPort);
  console.log('[init-db] 完成。下一步: bash backend/scripts/start-local-backend.sh');
  console.log(`[init-db] 验证: curl http://127.0.0.1:${port}/health`);
  console.log(`[init-db] 登录: POST /api/auth/login  body {"username":"root","password":"root"}`);
}

main().catch((err) => {
  console.error('[init-db] 失败:', err.message || err);
  process.exit(1);
});
