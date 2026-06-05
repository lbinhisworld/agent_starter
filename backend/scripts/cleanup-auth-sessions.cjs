#!/usr/bin/env node
/**
 * [INPUT]: DATABASE_URL（来自 backend/.env）
 * [OUTPUT]: 删除过期或已撤销会话并输出清理统计
 * [POS]: 认证会话手动清理脚本
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新文件头与 backend/scripts/AGENTS.md
 */
const dotenv = require('dotenv');
const mariadb = require('mariadb');

dotenv.config({ path: 'backend/.env' });
dotenv.config({ path: '.env' });

function parseMysqlUrl(raw) {
  if (!raw) throw new Error('DATABASE_URL is required');
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || '3306'),
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, ''),
  };
}

async function run() {
  const cfg = parseMysqlUrl(process.env.DATABASE_URL);
  const conn = await mariadb.createConnection(cfg);
  try {
    const table = 'authsession';
    const sql = `
      DELETE FROM \`${table}\`
      WHERE expiresAt <= NOW()
         OR revokedAt IS NOT NULL
    `;
    const result = await conn.query(sql);
    const affected = Number(result.affectedRows || 0);
    console.log(`[auth-session-cleanup] deleted=${affected}`);
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('[auth-session-cleanup] failed:', err?.message || err);
  process.exit(1);
});
