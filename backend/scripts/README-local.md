# Local backend scripts (Windows / macOS)

## 拉最新代码后的推荐顺序（必读）

1. **先检查 `backend/.env`**：文件存在、`DATABASE_URL` 非空；若仓库更新了环境项，对照 `backend/.env.example`（如有）补齐变量。MySQL 会话时区由后端在连接池上统一为 **东八区**（默认 `+08:00`，与 `NOW()` / `CURRENT_TIMESTAMP` 一致）；若需覆盖可设 `DATABASE_SESSION_TIMEZONE`（如 `Asia/Shanghai`，需库已加载时区表），见 `src/lib/prisma.ts`。
2. **统一执行** `backend/scripts/start-local-backend.ps1`（见下方命令），**不要**为了省事改用手动 `npm run build`、`prisma db push`、`node dist/...` 等拆步替代整条脚本。
   - 脚本会串联：**校验环境 → 数据库可达性检测 → `prisma db push` → `npm run build` → 启动服务 → 轮询 `/health`**，并处理本机 MariaDB、端口占用、状态文件等；服务端启动后还会做默认管理员等**运行时初始化**（如 `root` 账户），省略脚本容易漏掉这些步骤。
   - 仅在明确排障时使用 `-SkipBuild` / `-SkipDbPush`，日常联调勿默认跳过。

## 工具经验接口复验（可选）

合并知识树若浏览器报 **HTTP 404**（`/api/me/tool-experience/knowledge-tree` 或 `chat-state`），多为当前运行的 Node 进程**未加载含该路由的最新构建**。请在 `backend` 执行 `npm run build` 后按上文方式重启；再用登录 token 验证：

```bash
cd backend
TOOL_EXP_VERIFY_BEARER='<粘贴 Bearer 后的 JWT>' node scripts/_runtime-verify-tool-experience.cjs http://127.0.0.1:3002
```

成功时输出一行 `{"ok":true,"base":...}`。仓库内 `npm test` 含 `tool-experience-me-routes.test.ts` 可离线确认路由已注册。

设计详情：若控制台出现 **`Cannot POST /api/problem-cases/.../design-detail/sync-task0-toolbox-primitives`**（任务 0 工具原语落库）、**`…/sync-task3-l2-target-kv-tokens`**、**`…/sync-task4-l2-target-kv-tokens`**、**`…/sync-task52-l3-asset-field-set-target-kv-tokens`**（任务 5.2 字段集映射落库）或 **`…/sync-task55-l3-vsm-target-kv-tokens`**（任务 5.5 VSM 落库；返回 HTML 404），与上条相同——当前监听端口的进程仍是**旧构建**或未重启；请在 `backend` 执行 **`npm run build`** 后重启服务（`npm start` 走 `dist` 时**必须**先 build；`npm run dev` 一般保存即 respawn，若仍 404 请手动停掉进程再起）。

## Files

| 平台 | 启动 | 停止 | 状态 | 共享逻辑 |
| ---- | ---- | ---- | ---- | -------- |
| Windows (PowerShell) | `start-local-backend.ps1` | `stop-local-backend.ps1` | `status-local-backend.ps1` | `_local-backend-common.ps1` |
| macOS / Linux (Bash) | `start-local-backend.sh` | `stop-local-backend.sh` | `status-local-backend.sh` | `_local-backend-common.sh` |

## State and logs

| Purpose | Path |
|------|------|
| PID / port / startedAt | `backend/.local/run/state.json` |
| stdout log | `backend/.local/logs/backend.out.log` |
| stderr log | `backend/.local/logs/backend.err.log` |

`backend/.local/` is ignored by git.

## Recommended usage

### Windows (PowerShell)

From repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/start-local-backend.ps1
```

Or from `backend`:

```powershell
.\scripts\start-local-backend.ps1
```

If execution policy blocks the first run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### macOS / Linux (Bash)

依赖：`bash`、`node`（需在 PATH 中：解析 `.env` 键、`state.json` 以及跑后端均会用到）、`npm`/`npx`、能执行 `npx prisma`；健康检查默认使用 `curl`；端口检测默认使用 `lsof`（无 `lsof` 时尝试 `nc`）。脚本**不会**在 macOS 上自动启动 MySQL/MariaDB，请自行保证数据库已就绪。

From repo root:

```bash
bash backend/scripts/start-local-backend.sh
```

Or from `backend`:

```bash
chmod +x scripts/start-local-backend.sh scripts/stop-local-backend.sh scripts/status-local-backend.sh
./scripts/start-local-backend.sh
```

可选参数（与 Windows 的 `-SkipBuild` / `-SkipDbPush` 对应）：

```bash
./scripts/start-local-backend.sh --skip-build --skip-db-push
```

## What each script does

### start（`*.ps1` / `*.sh`）

1. Read `backend/.env`
2. Require `DATABASE_URL`
3. **Windows only**：若本机 `3306` 未监听，尝试按固定路径自动拉起本地 MariaDB（见 `_local-backend-common.ps1`）。
4. **macOS / Linux**：不启动数据库服务；若 `npx prisma db execute`（`SELECT 1`）失败，**清晰报错并退出**。
5. Run `node scripts/local-dev-ensure-owner-isolation.cjs`（补列/补索引/回填 root；幂等）
6. Run `npx prisma db push` unless skip（`-SkipDbPush` / `--skip-db-push`）
7. Run `npm run build` unless skip（`-SkipBuild` / `--skip-build`）
8. Start `node dist/src/server.js`（环境变量 `PORT` 为选用端口）
9. If the requested port is occupied, bump to the next available port（Windows: `Get-NetTCPConnection`；macOS/Linux: `lsof` 或 `nc`）
10. Poll `http://127.0.0.1:<PORT>/health`
11. Write `state.json` and print port, PID, log paths, and health URL

If `state.json` exists and the process is alive and healthy, the script exits early and asks you to run `stop`.

### stop / status

行为与 Windows 版一致：`stop` 根据 `state.json` 结束进程并删除状态；`status` 读取 `state.json` 并探测 `/health`。

**Exit codes（`status-local-backend.*`）**

- `0`: running and healthy, or no state file
- `1`: process missing
- `2`: process exists but health failed

## Quick troubleshooting

1. If the DB is unreachable：**Windows** 可检查本机 MariaDB 是否运行；**macOS** 请自行启动数据库或 Docker，并核对 `DATABASE_URL`。
2. If build fails, run `npm install` in `backend` and retry.
3. If health times out, check `backend/.local/logs/backend.err.log` and `backend.out.log`, then verify which port was picked in `state.json`.

## Runtime verification helpers

- `node scripts/_runtime-verify-owner-isolation.cjs`：owner 隔离最小复验（user 404、admin 全量、root 回填不可被 user 访问）
