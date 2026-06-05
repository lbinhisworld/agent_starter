/**
 * [INPUT]: backend/.env（DATABASE_URL）、MySQL/MariaDB（information_schema）
 * [OUTPUT]: 本地开发环境数据库自愈（列/索引补齐 + root 回填）与摘要输出
 * [POS]: local-only 兼容脚本；用于开发同学拉代码后一键补齐 owner 隔离所需 DB 变更
 *
 * [PROTOCOL]: 仅允许被 backend/scripts/*.ps1 启动链路显式调用；不得挂到正式服务 runtime。
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const mariadb = require('mariadb');

const OWNER_COLUMNS = ['ownerSubjectId', 'ownerSubjectType', 'ownerUsernameSnapshot'];
const OWNER_INDEX_NAME = 'ProblemCase_ownerSubjectType_ownerSubjectId_idx';

function readDotEnvFile(envPath) {
  const out = {};
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
  const dbName = decodeURIComponent((u.pathname || '').replace(/^\//, ''));
  if (!dbName) throw new Error('DATABASE_URL missing database name');
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: dbName,
  };
}

async function queryOne(conn, sql, params) {
  const rows = await conn.query(sql, params);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function queryScalar(conn, sql, params) {
  const row = await queryOne(conn, sql, params);
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length > 0 ? row[keys[0]] : null;
}

async function resolvePhysicalTableName(conn, schema, logicalLowerName) {
  const name = await queryScalar(
    conn,
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ?
        AND LOWER(table_name) = ?
      LIMIT 1
    `,
    [schema, logicalLowerName.toLowerCase()],
  );
  if (!name) throw new Error(`table not found: ${logicalLowerName}`);
  return String(name);
}

async function listExistingColumns(conn, schema, tableName) {
  const rows = await conn.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
    `,
    [schema, tableName],
  );
  return new Set(rows.map((r) => String(r.column_name)));
}

async function hasIndex(conn, schema, tableName, indexName) {
  const n = await queryScalar(
    conn,
    `
      SELECT COUNT(1) AS cnt
      FROM information_schema.statistics
      WHERE table_schema = ?
        AND table_name = ?
        AND index_name = ?
    `,
    [schema, tableName, indexName],
  );
  return Number(n || 0) > 0;
}

async function ensureRootAdmin(conn, schema, adminTableName) {
  // 幂等：只在缺 root 时插入
  const existing = await queryOne(
    conn,
    `SELECT id, username FROM \`${adminTableName}\` WHERE username = 'root' LIMIT 1`,
  );
  if (existing && existing.id) {
    return { id: String(existing.id), created: false };
  }

  // 密码 hash 的生成在服务内（AuthService.ensureDefaultRootAdmin）；脚本只保证存在一条 root 记录。
  // 注意：若 schema 要求 NOT NULL passwordHash 且缺默认值，此处会失败并明确报错。
  const id = `adm_root_${Math.random().toString(16).slice(2, 10)}`;
  const passwordHash = 'local-dev-placeholder-hash';
  await conn.query(
    `INSERT INTO \`${adminTableName}\` (id, username, passwordHash, createdAt, updatedAt)
     VALUES (?, 'root', ?, NOW(), NOW())`,
    [id, passwordHash],
  );
  return { id, created: true };
}

async function backfillOwnerToRoot(conn, problemCaseTableName, rootAdminId) {
  const res = await conn.query(
    `
      UPDATE \`${problemCaseTableName}\`
      SET ownerSubjectId = ?,
          ownerSubjectType = 'admin',
          ownerUsernameSnapshot = 'root'
      WHERE ownerSubjectId IS NULL
        AND ownerSubjectType IS NULL
    `,
    [rootAdminId],
  );

  // mariadb/mysql driver: affectedRows
  const affected = res && typeof res.affectedRows === 'number' ? res.affectedRows : 0;
  return affected;
}

async function ensureOwnerIsolationDbCompat(options) {
  const {
    databaseUrl,
    envName = 'local',
  } = options || {};

  if (!databaseUrl) throw new Error('databaseUrl is required');

  const cfg = parseDatabaseUrl(databaseUrl);
  const conn = await mariadb.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    // 兼容 MySQL/MariaDB：保持默认
  });

  const summary = {
    envName,
    database: cfg.database,
    problemCaseTable: null,
    adminUserTable: null,
    columns: { added: [], existed: [] },
    index: { created: false, existed: false, name: OWNER_INDEX_NAME },
    root: { ensured: false, created: false, id: null },
    backfill: { updatedRows: 0 },
  };

  try {
    const problemCaseTable = await resolvePhysicalTableName(conn, cfg.database, 'problemcase');
    const adminUserTable = await resolvePhysicalTableName(conn, cfg.database, 'adminuser');
    return await ensureOwnerIsolationDbCompatWithConnection(conn, cfg.database, {
      envName,
      problemCaseTable,
      adminUserTable,
    });
  } finally {
    await conn.end();
  }
}

async function ensureOwnerIsolationDbCompatWithConnection(conn, schema, opts) {
  const { envName, problemCaseTable, adminUserTable } = opts;
  const summary = {
    envName,
    database: schema,
    problemCaseTable,
    adminUserTable,
    columns: { added: [], existed: [] },
    index: { created: false, existed: false, name: OWNER_INDEX_NAME },
    root: { ensured: false, created: false, id: null },
    backfill: { updatedRows: 0 },
  };

  const existingCols = await listExistingColumns(conn, schema, problemCaseTable);
  for (const col of OWNER_COLUMNS) {
    if (existingCols.has(col)) {
      summary.columns.existed.push(col);
      continue;
    }
    // 与 Prisma migration 保持一致：VARCHAR(191) NULL
    await conn.query(`ALTER TABLE \`${problemCaseTable}\` ADD COLUMN \`${col}\` VARCHAR(191) NULL`);
    summary.columns.added.push(col);
  }

  const indexExists = await hasIndex(conn, schema, problemCaseTable, OWNER_INDEX_NAME);
  if (indexExists) {
    summary.index.existed = true;
  } else {
    await conn.query(
      `CREATE INDEX \`${OWNER_INDEX_NAME}\` ON \`${problemCaseTable}\`(\`ownerSubjectType\`, \`ownerSubjectId\`)`,
    );
    summary.index.created = true;
  }

  const root = await ensureRootAdmin(conn, schema, adminUserTable);
  summary.root.ensured = true;
  summary.root.created = Boolean(root.created);
  summary.root.id = root.id;

  // 历史 owner 为空 -> 回填 root(admin)；不覆盖已有 owner
  summary.backfill.updatedRows = await backfillOwnerToRoot(conn, problemCaseTable, root.id);

  return summary;
}

function printSummary(summary) {
  const lines = [];
  lines.push(`[owner-compat] env      : ${summary.envName}`);
  lines.push(`[owner-compat] database : ${summary.database}`);
  lines.push(`[owner-compat] table(pc) : ${summary.problemCaseTable}`);
  lines.push(`[owner-compat] table(ad) : ${summary.adminUserTable}`);
  lines.push(`[owner-compat] columns  : added=[${summary.columns.added.join(',')}] existed=[${summary.columns.existed.join(',')}]`);
  lines.push(`[owner-compat] index    : ${summary.index.created ? 'created' : summary.index.existed ? 'existed' : 'unknown'} (${summary.index.name})`);
  lines.push(`[owner-compat] root     : ensured, created=${summary.root.created}, id=${summary.root.id}`);
  lines.push(`[owner-compat] backfill : updatedRows=${summary.backfill.updatedRows}`);
  console.log(lines.join('\n'));
}

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing backend/.env. Copy .env.example first and set DATABASE_URL.');
  }
  const envMap = readDotEnvFile(envPath);
  const databaseUrl = envMap.DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl || String(databaseUrl).trim() === '') {
    throw new Error('DATABASE_URL is empty in backend/.env.');
  }

  const summary = await ensureOwnerIsolationDbCompat({ databaseUrl, envName: 'local' });
  printSummary(summary);
}

module.exports = {
  ensureOwnerIsolationDbCompat,
  ensureOwnerIsolationDbCompatWithConnection,
  parseDatabaseUrl,
  readDotEnvFile,
  OWNER_COLUMNS,
  OWNER_INDEX_NAME,
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[owner-compat] failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

