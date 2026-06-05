#!/usr/bin/env bash
# agent-starter 本地一键建库：生成 .env、CREATE DATABASE、prisma db push、root/root 管理员
# 用法（仓库根目录）: bash scripts/init-agent-starter-db.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}/backend"

if [[ ! -d node_modules ]]; then
  echo "[init-agent-starter-db] npm install …"
  npm install
fi

node scripts/init-agent-starter-local-db.cjs
