# Folder: backend/scripts

## 地位

本目录是后端本地运行脚本层，负责在开发机上完成数据库与服务的启动、停止和状态查询。

## 职责

1. 封装本地后端一键启动流程（环境检查、数据库可达性、构建、拉起服务）；`README-local.md` 说明 MySQL 会话时区默认东八区（`DATABASE_SESSION_TIMEZONE` 可选覆盖）。
2. 提供本地后端停止与状态查看能力。
3. 复用共享脚本函数，保证 **Windows（PowerShell）** 与 **macOS/Linux（Bash）** 本地启动行为一致（除 Windows 专有MariaDB 自动拉起外）。

## 拉代码后本地启动约定（Windows）

1. **先检查 `backend/.env`**（存在性、`DATABASE_URL`、与 `.env.example` 对齐的新增项）。
2. **统一执行** `start-local-backend.ps1`，**不要**跳过整条脚本改用手动拆步（`build` / `db push` / 直接起 `node` 等）；脚本内含 **db push、build、启动与健康检查**，且服务进程内会完成默认管理员等**运行时补全**（如 `root`）。仅在排障时酌情使用 `-SkipBuild` / `-SkipDbPush`。

## 约束

- 脚本改动优先保持增量式修改，避免影响无关流程。
- 若新增/删除脚本文件或调整启动链路，需要立即更新本文件成员清单与职责描述。
- macOS 脚本**不**自动启动本机数据库服务；仅检测 `DATABASE_URL` 指向库是否可达。
- **勿**将 Windows 的 MariaDB 安装路径硬编码逻辑复制到 `.sh` 中。
- **AI / 协作者**：拉最新代码后启动本地后端时，应遵循 `README-local.md`（Windows 用 `.ps1`，macOS/Linux 用 `.sh`）。

## 成员清单

| 文件路径 | 简述 |
| ---- | --- |
| `backend/scripts/_local-backend-common.ps1` | Windows：本地后端脚本共享函数（路径、状态、健康检查、DB 启动辅助） |
| `backend/scripts/_local-backend-common.sh` | macOS/Linux：本地后端脚本共享函数（路径、`.env` 键读取、`state.json`、健康检查、DB 可达性检测） |
| `backend/scripts/start-local-backend.ps1` | Windows：本地后端标准启动入口（先核对 `backend/.env`，勿拆步替代） |
| `backend/scripts/start-local-backend.sh` | macOS/Linux：本地后端标准启动入口 |
| `backend/scripts/stop-local-backend.ps1` | Windows：本地后端停止脚本 |
| `backend/scripts/stop-local-backend.sh` | macOS/Linux：本地后端停止脚本 |
| `backend/scripts/status-local-backend.ps1` | Windows：本地后端状态查询脚本 |
| `backend/scripts/status-local-backend.sh` | macOS/Linux：本地后端状态查询脚本 |
| `backend/scripts/README-local.md` | 本地脚本使用说明（Windows / macOS 双轨） |
| `backend/scripts/generate-deploy-secrets.cjs` | 首次部署/轮换：生成 `JWT_SECRET` 与 `AI_CONFIG_ENCRYPTION_SECRET`（可 `--append` 到 `.env`） |
| `backend/scripts/local-dev-ensure-owner-isolation.cjs` | local-only：owner 隔离 DB 兼容脚本（补列/补索引/回填 root，幂等） |
| `backend/scripts/_runtime-verify-owner-isolation.cjs` | local-only：owner 隔离运行时最小复验（user 404、admin 全量、root 回填校验） |
| `backend/scripts/_runtime-verify-tool-experience.cjs` | local-only：工具经验 `GET|PUT /api/me/tool-experience/knowledge-tree` 与 `chat-state` 复验（真实库需 `TOOL_EXP_VERIFY_BEARER`） |
| `backend/scripts/cleanup-auth-sessions.cjs` | 手动清理过期或已撤销 AuthSession 会话 |

**触发器**: 一旦本文件夹增删文件或架构逻辑调整，请立即重写此文档。
