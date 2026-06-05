#!/usr/bin/env bash
# 停止由 start-local-backend.sh 记录在 state.json 中的后端进程。
# [PROTOCOL]: 变更时请同步 backend/scripts/README-local.md 与 backend/scripts/AGENTS.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_local-backend-common.sh"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "[local-backend] no state file: ${STATE_FILE}"
  exit 0
fi

proc_id="$(lb_read_state_field pid)"
port="$(lb_read_state_field port)"

echo "[local-backend] stopping PID=${proc_id} (port=${port}, source=state.json)"

if kill -0 "$proc_id" 2>/dev/null; then
  kill -9 "$proc_id" 2>/dev/null || true
  echo "[local-backend] stop signal sent to PID ${proc_id}"
else
  echo "[local-backend] process already gone or cannot be stopped"
fi

lb_remove_state
echo "[local-backend] state file removed"
echo "[local-backend] done"
