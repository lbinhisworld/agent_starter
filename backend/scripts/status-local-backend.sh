#!/usr/bin/env bash
# 根据 state.json 与 /health 展示本地后端状态。
# 退出码：0 无 state 或运行且健康；1 进程不存在；2 进程在但健康检查失败。
# [PROTOCOL]: 变更时请同步 backend/scripts/README-local.md 与 backend/scripts/AGENTS.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_local-backend-common.sh"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "alive     : false"
  echo "reason    : no state.json (not started by start-local-backend or already stopped)"
  echo "stateFile : ${STATE_FILE}"
  exit 0
fi

proc_id="$(lb_read_state_field pid)"
port="$(lb_read_state_field port)"

alive=false
if kill -0 "$proc_id" 2>/dev/null; then
  alive=true
fi

healthy=false
if lb_test_health "$port"; then
  healthy=true
fi

started_at="$(lb_read_state_field startedAt 2>/dev/null || echo "")"

echo "alive       : $alive"
echo "pid         : $proc_id"
echo "port        : $port"
echo "health      : $healthy"
echo "healthUrl   : http://127.0.0.1:${port}/health"
echo "stateFile   : ${STATE_FILE}"
echo "logOut      : ${LOG_OUT}"
echo "logErr      : ${LOG_ERR}"
echo "startedAt   : ${started_at}"

if [[ "$alive" != "true" ]]; then
  exit 1
fi
if [[ "$healthy" != "true" ]]; then
  exit 2
fi
exit 0
