# Folder: backend/src/modules/tool-experience

## 地位

工具经验相关后端能力：按用户持久化 JSON（知识树 + 左侧对话区）。

## 职责

1. `tool-experience-knowledge.service.ts`：校验并读写 `ToolExperienceKnowledgeTree`（Prisma）。
2. `tool-experience-knowledge.routes.ts`：`GET/PUT` `/api/me/tool-experience/knowledge-tree`（需登录 JWT）。
3. `tool-experience-chat.service.ts`：校验并读写 `ToolExperienceChatState`（消息列表 + 输入草稿）。
4. `tool-experience-chat.routes.ts`：`GET/PUT` `/api/me/tool-experience/chat-state`（需登录 JWT）。

## 约束

- 载荷为业务 JSON，由前端合并/序列化；服务端只做结构兜底校验（Zod），不做业务树形运算。
- `userId` 与 `AppUser.id` 对齐，删除用户级联删除对应行。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `tool-experience-knowledge.service.ts` | 知识树 payload 读写 |
| `tool-experience-knowledge.routes.ts` | 知识树 HTTP |
| `tool-experience-chat.service.ts` | 对话区 payload 读写 |
| `tool-experience-chat.routes.ts` | 对话区 HTTP |

**触发器**: 本目录增删或契约变更时更新本文档。
