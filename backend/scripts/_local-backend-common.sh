# Shared helpers for local backend shell scripts (macOS/Linux): paths, .env parsing, state, health.
# shellcheck shell=bash
# 注意：本文件供 source 使用，勿直接执行。
# [PROTOCOL]: 变更时请同步 backend/scripts/README-local.md 与 backend/scripts/AGENTS.md

_lb_common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export BACKEND_ROOT="$(cd "${_lb_common_dir}/.." && pwd)"

LOCAL_DIR="${BACKEND_ROOT}/.local"
RUN_DIR="${LOCAL_DIR}/run"
LOG_DIR="${LOCAL_DIR}/logs"
STATE_FILE="${RUN_DIR}/state.json"
LOG_OUT="${LOG_DIR}/backend.out.log"
LOG_ERR="${LOG_DIR}/backend.err.log"

# 从 .env 读取单个键值（支持 # 注释、空行、引号包裹）；依赖 node（与业务链路一致）。
lb_read_dotenv_key() {
  local env_path="$1"
  local key="$2"
  node -e "
    const fs = require('fs');
    const path = process.argv[1];
    const want = process.argv[2];
    if (!fs.existsSync(path)) process.exit(2);
    const txt = fs.readFileSync(path, 'utf8');
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.replace(/^\uFEFF/, '');
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      if (k !== want) continue;
      let v = t.slice(eq + 1).trim();
      if (v.length >= 2) {
        const a = v[0];
        const b = v[v.length - 1];
        if ((a === '\"' && b === '\"') || (a === \"'\" && b === \"'\")) v = v.slice(1, -1);
      }
      process.stdout.write(v);
      process.exit(0);
    }
    process.exit(1);
  " "$env_path" "$key"
}

lb_get_backend_port() {
  local env_path="$1"
  local p
  if p=$(lb_read_dotenv_key "$env_path" "PORT" 2>/dev/null); then
    if [[ "$p" =~ ^[0-9]+$ ]]; then
      echo "$p"
      return 0
    fi
  fi
  echo "3000"
}

# 是否有进程在本机 TCP 端口监听（macOS: lsof）
lb_port_listening() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  # 无 lsof 时退化为 nc（部分环境）
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    return $?
  fi
  echo "[local-backend] 错误: 未找到 lsof 或 nc，无法检测端口占用。" >&2
  return 99
}

lb_get_available_backend_port() {
  local port="$1"
  while lb_port_listening "$port"; do
    port=$((port + 1))
  done
  echo "$port"
}

lb_ensure_local_dirs() {
  mkdir -p "$RUN_DIR" "$LOG_DIR"
}

lb_write_state() {
  local pid="$1"
  local port="$2"
  lb_ensure_local_dirs
  node -e "
    const fs = require('fs');
    const path = process.argv[1];
    const obj = {
      pid: Number(process.argv[2]),
      port: Number(process.argv[3]),
      startedAt: new Date().toISOString(),
      scriptRoot: process.argv[4],
    };
    fs.writeFileSync(path, JSON.stringify(obj, null, 2), 'utf8');
  " "$STATE_FILE" "$pid" "$port" "$BACKEND_ROOT"
}

lb_read_state_field() {
  local field="$1"
  [[ -f "$STATE_FILE" ]] || return 1
  node -e "
    const fs = require('fs');
    try {
      const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const f = process.argv[2];
      if (j[f] === undefined || j[f] === null) process.exit(1);
      process.stdout.write(String(j[f]));
    } catch (e) {
      process.exit(1);
    }
  " "$STATE_FILE" "$field"
}

lb_remove_state() {
  [[ -f "$STATE_FILE" ]] && rm -f "$STATE_FILE"
}

lb_test_health() {
  local port="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -sf --max-time 3 "http://127.0.0.1:${port}/health" >/dev/null 2>&1
    return $?
  fi
  echo "[local-backend] 错误: 未找到 curl，无法探测 /health。" >&2
  return 1
}

lb_wait_health() {
  local port="$1"
  local max_seconds="${2:-45}"
  local deadline=$((SECONDS + max_seconds))
  while (( SECONDS < deadline )); do
    if lb_test_health "$port"; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

# 使用 Prisma 执行 SELECT 1 检测数据库可达（与 ps1 语义一致，不在此启动 DB 服务）。
lb_prisma_db_reachable() {
  (
    cd "$BACKEND_ROOT" || exit 1
    local f out err code
    f="$(mktemp "${TMPDIR:-/tmp}/smart-cto-dbcheck.XXXXXX.sql")"
    out="$(mktemp "${TMPDIR:-/tmp}/smart-cto-dbcheck.XXXXXX.out")"
    err="$(mktemp "${TMPDIR:-/tmp}/smart-cto-dbcheck.XXXXXX.err")"
    printf 'SELECT 1;\n' >"$f"
    set +e
    npx prisma db execute --file "$f" >"$out" 2>"$err"
    code=$?
    set -e
    rm -f "$f" "$out" "$err"
    exit "$code"
  )
}
