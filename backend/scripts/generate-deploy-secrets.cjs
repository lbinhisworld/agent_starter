#!/usr/bin/env node
/**
 * 首次部署或轮换密钥时：生成 JWT_SECRET 与 AI_CONFIG_ENCRYPTION_SECRET（写入终端或追加到 .env）。
 * 不在运行时自动生成 secret；仅作运维脚本。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  return { append: argv.includes('--append') };
}

function main() {
  const jwt = crypto.randomBytes(32).toString('hex');
  const ai = crypto.randomBytes(32).toString('hex');
  const block = [
    '# --- deploy secrets (generate-deploy-secrets.cjs) ---',
    `# generated_at=${new Date().toISOString()}`,
    `JWT_SECRET=${jwt}`,
    `AI_CONFIG_ENCRYPTION_SECRET=${ai}`,
    '# --- end deploy secrets ---',
    '',
  ].join('\n');

  process.stdout.write(block);

  const { append } = parseArgs(process.argv.slice(2));
  if (!append) return;

  const envPath = path.join(__dirname, '..', '.env');
  fs.appendFileSync(envPath, (fs.existsSync(envPath) ? '\n' : '') + block, { encoding: 'utf8' });
  process.stderr.write(`[generate-deploy-secrets] 已追加到 ${envPath}\n`);
}

main();
