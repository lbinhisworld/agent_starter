# Folder: backend/src/modules/ai

## 地位

后端 AI 能力入口模块，负责系统级 AI 配置、AppUser 个人模型配置门禁、AI chat 上游代理与截断观测。

## 职责

1. 维护系统级 `/api/ai/config` 与用户级 `/api/me/ai-config/*` 的契约边界。
2. 维护 online 模式下 `AppUser` 个人已验证 AI 配置的真相源解析。
3. 维护 `/api/ai/chat` 的上游调用、超时处理与截断元信息回传；上游 401 映射为 502 + `AI_UPSTREAM_AUTH_FAILED`（勿与 JWT 401 同源透出）。`taskTag` 为 `task1-prelim-*` 或 `tool-experience-capability` 时，上游附加 `response_format: json_object`。

## 约束

- 本轮 provider 冻结为 `deepseek`，不得顺手扩成多 provider 或组织级配置。
- `role=user` 的 `/api/ai/chat` 只允许读取当前用户自己的已验证配置，不得回退系统级 `AppSetting`。
- `/api/ai/config` 仅保留运维 / 管理员路径，不再作为普通业务用户主路径。
- 用户明文 Key 不得通过普通接口返回；落库必须以密文存储。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `backend/src/modules/ai/ai-config.service.ts` | 系统级 / 用户级 AI 配置服务、密钥加解密、保存并验证、chat 配置解析 |
| `backend/src/modules/ai/ai.routes.ts` | `/api/ai/*` 与 `/api/me/ai-config/*` 路由、权限收口与错误映射 |
| `backend/src/modules/ai/ai-chat-truncation.ts` | AI 输出截断推断与 max token 解析 |

**触发器**: 一旦本文件夹增删文件或架构逻辑调整，请立即重写此文档。
