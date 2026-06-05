# Folder: backend/src/modules/tool-detail

## 地位

工具详情页工作画布后端持久化（按用户隔离的工具知识集 JSON）。

## 职责

1. `tool-detail-workspace.service.ts`：校验并读写 `ToolDetailWorkspace`（Prisma）。
2. `tool-detail-workspace.routes.ts`：`GET|PUT /api/me/tool-detail/workspace`（需登录 JWT）。

## 约束

- 载荷为 `{ version: 1, byToolId: { [toolId]: { groups, summary? } } }`，业务合并由前端完成。
- `userId` 与 `AppUser.id` 对齐，删除用户级联删除对应行。

## 成员清单

| 文件路径 | 简述 |
| ---- | --- |
| `tool-detail-workspace.service.ts` | 工作画布 payload 读写 |
| `tool-detail-workspace.routes.ts` | 工作画布 HTTP |

**触发器**: 本目录增删或契约变更时更新本文档。
