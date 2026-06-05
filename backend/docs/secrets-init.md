# 环境初始化与 Secret 自检

面向首次部署与运维：生成并写入 `JWT_SECRET`、`AI_CONFIG_ENCRYPTION_SECRET`，以及生产环境启动前的行为说明。

## 1. 生成随机密钥（推荐）

在 `backend/` 目录执行：

```bash
node scripts/generate-deploy-secrets.cjs
```

终端会输出两行密钥（含注释头尾标记）。将输出**整段**合并进 `backend/.env`（或容器/编排的 Secret），**不要**提交到 Git。

### 追加到现有 `.env`

若已有 `backend/.env`，可追加（注意：重复执行会产生多段密钥，请手动去重或合并）：

```bash
node scripts/generate-deploy-secrets.cjs --append
```

## 2. 变量含义（不改业务契约）

| 变量 | 作用 |
| ---- | ---- |
| `JWT_SECRET` | 签发与校验 JWT |
| `AI_CONFIG_ENCRYPTION_SECRET` | 用户 AI Key 等敏感字段的 AES-GCM 加密；若未设置且已配置 `JWT_SECRET`，现有逻辑会用 JWT 密钥派生加密密钥（与代码现状一致） |

生产环境**不会**在运行时临时生成上述密钥；必须通过环境变量显式提供。

## 3. 生产环境启动前自检（`NODE_ENV=production`）

- **必须**：`JWT_SECRET` 为非空字符串，且**不能**为开发占位 `dev_jwt_secret`。
- **建议**：同时设置 `AI_CONFIG_ENCRYPTION_SECRET`，与 JWT 解耦，便于独立轮换。
- 若仅缺 `AI_CONFIG_ENCRYPTION_SECRET`：服务可启动，但会在日志中输出**警告**，提示当前将用 `JWT_SECRET` 派生 AI 加密密钥。

缺失或非法 `JWT_SECRET` 时进程**直接退出**，错误信息中会包含修复步骤（与下方「标准报错」一致）。

## 4. 标准报错提示（复制/检索用）

### 4.1 JWT 未配置或使用了开发默认值

```
[Smart CTO] 生产环境启动失败：JWT_SECRET 未配置或使用了不安全的默认值。
```

完整段落以启动时控制台输出为准（含「原因」与「请按以下步骤修复」）。

### 4.2 加解密用户 AI Key 时两者皆无（边缘情况）

在极少数路径下若仍出现「两者均未配置」，错误正文为：

```
[Smart CTO] 生产环境无法加解密用户 AI Key：
  AI_CONFIG_ENCRYPTION_SECRET 与 JWT_SECRET 均未配置为非空值。
```

完整段落以运行时输出为准。

## 5. `.env` 模板文件

可参考同目录下的 `dotenv.production.template`（仅占位，无真实密钥）。
