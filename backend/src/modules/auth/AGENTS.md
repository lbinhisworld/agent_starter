# Folder: backend/src/modules/auth

## 地位

后端认证与授权核心模块，负责登录、JWT 解析、会话有效性校验、角色权限门禁。

## 职责

1. 统一维护登录签发策略（固定 token + 会话表）。
2. 统一维护鉴权中间件（Bearer 解析、会话校验、用户状态校验、滑动续期）。
3. 提供认证相关路由（登录、退出）与管理端用户维护接口。

## 约束

- 固定 token 模式下，不在 2xx 响应中回传轮换 token；会话有效期以 `AuthSession` 为准。
- 会话续期必须节流，避免每个请求都写库。
- 任何变更不得破坏 owner 隔离与既有 `requireRole` 语义。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `backend/src/modules/auth/auth.service.ts` | 登录、会话创建、退出撤销、管理员用户维护 |
| `backend/src/modules/auth/jwt.middleware.ts` | JWT 鉴权、会话校验与滑动续期、角色校验 |
| `backend/src/modules/auth/auth.routes.ts` | auth/admin 路由装配与错误映射 |

**触发器**: 一旦本文件夹增删文件或架构逻辑调整，请立即重写此文档。
