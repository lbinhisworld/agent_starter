#!/usr/bin/env bash
# Standard local backend launcher (macOS/Linux): read .env, validate DATABASE_URL,
# test DB reachability, owner compat, prisma push, build, start server, wait /health, write state.
# 用法：在仓库根目录 backend/scripts/start-local-backend.sh
#   或在 backend 目录：./scripts/start-local-backend.sh
# 参数：--skip-build  --skip-db-push
#
# [PROTOCOL]: 变更时请同步 backend/scripts/README-local.md 与 backend/scripts/AGENTS.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_local-backend-common.sh"

SKIP_BUILD=0
SKIP_DB_PUSH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1 ;;
    --skip-db-push) SKIP_DB_PUSH=1 ;;
    -h|--help)
      echo "Usage: $0 [--skip-build] [--skip-db-push]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 2
      ;;
  esac
  shift
done

env_file="${BACKEND_ROOT}/.env"
echo "[local-backend] backendRoot: ${BACKEND_ROOT}"
echo "[local-backend] envFile    : ${env_file}"

if [[ ! -f "$env_file" ]]; then
  echo "[local-backend] 错误: 缺少 backend/.env，请先复制 .env.example 并配置 DATABASE_URL。" >&2
  exit 1
fi

db_url="$(lb_read_dotenv_key "$env_file" DATABASE_URL 2>/dev/null || true)"
if [[ -z "${db_url// }" ]]; then
  echo "[local-backend] 错误: backend/.env 中 DATABASE_URL 为空。" >&2
  exit 1
fi

requested_port="$(lb_get_backend_port "$env_file")"
port="$(lb_get_available_backend_port "$requested_port")"
if [[ "$port" == "$requested_port" ]]; then
  echo "[local-backend] targetPort : $port"
else
  echo "[local-backend] targetPort : $requested_port (occupied, use $port)"
fi

if [[ -f "$STATE_FILE" ]]; then
  old_pid="$(lb_read_state_field pid 2>/dev/null || true)"
  old_port="$(lb_read_state_field port 2>/dev/null || true)"
  proc_alive=0
  if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
    proc_alive=1
  fi
  if [[ "$proc_alive" -eq 1 ]] && [[ -n "${old_port:-}" ]] && lb_test_health "$old_port"; then
    echo "[local-backend] alreadyRunning: PID=${old_pid} port=${old_port}"
    echo "[local-backend] 请先执行 ./scripts/stop-local-backend.sh 再重启"
    exit 0
  fi
  echo "[local-backend] stale state detected; removing old state file"
  lb_remove_state
fi

echo "[local-backend] checkDb    : npx prisma db execute (SELECT 1)"
set +e
lb_prisma_db_reachable
db_code=$?
set -e
if [[ "$db_code" -ne 0 ]]; then
  echo "[local-backend] 错误: 数据库不可达。请确认 MySQL/MariaDB 已启动且 DATABASE_URL 正确。（本脚本不会在 macOS 上自动启动数据库服务。）" >&2
  exit 1
fi

echo "[local-backend] ownerCompat: node scripts/local-dev-ensure-owner-isolation.cjs"
(
  cd "$BACKEND_ROOT"
  node scripts/local-dev-ensure-owner-isolation.cjs
)

if [[ "$SKIP_DB_PUSH" -eq 0 ]]; then
  echo "[local-backend] prismaPush : npx prisma db push"
  (
    cd "$BACKEND_ROOT"
    npx prisma db push
  )
else
  echo "[local-backend] prismaPush : skipped (--skip-db-push)"
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "[local-backend] build      : npm run build"
  (
    cd "$BACKEND_ROOT"
    npm run build
  )
else
  echo "[local-backend] build      : skipped (--skip-build)"
fi

lb_ensure_local_dirs
: >"$LOG_OUT"
: >"$LOG_ERR"

echo "[local-backend] start      : node dist/src/server.js"
export PORT="$port"
node_pid="$(
  cd "$BACKEND_ROOT"
  export PORT="$port"
  nohup node dist/src/server.js >>"$LOG_OUT" 2>>"$LOG_ERR" &
  echo $!
)"

lb_write_state "$node_pid" "$port"
echo "[local-backend] state      : PID=${node_pid} -> ${STATE_FILE}"

echo "[local-backend] waitHealth : /health (max 45s)"
if ! lb_wait_health "$port" 45; then
  echo "[local-backend] health check failed. Recent logs:"
  tail -n 30 "$LOG_ERR" 2>/dev/null || true
  tail -n 30 "$LOG_OUT" 2>/dev/null || true
  echo "[local-backend] 错误: 服务未在时限内通过健康检查，请查看上方日志。" >&2
  exit 1
fi

health_url="http://127.0.0.1:${port}/health"
echo ""
echo "========== START OK =========="
echo "  PORT      : $port"
echo "  PID       : $node_pid"
echo "  STATE FILE: $STATE_FILE"
echo "  LOG OUT   : $LOG_OUT"
echo "  LOG ERR   : $LOG_ERR"
echo "  Health URL: $health_url"
echo "=============================="
echo ""
