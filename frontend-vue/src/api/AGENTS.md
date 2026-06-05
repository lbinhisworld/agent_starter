# Folder: e:\03_do1_workspace\do1_smart_cto\frontend-vue\src\api

## 地位

Vue 侧 API 客户端子模块，统一封装登录、管理端与个人模型配置相关的受保护请求。

## 职责

1. 为请求附带同源 `Authorization`。
2. 统一处理 401 / 403 与 `AI_CONFIG_REQUIRED`。
3. 提供登录、用户管理、个人模型配置状态查询与保存并验证接口。

## 约束

- 鉴权键名必须与 `frontend/js/auth-runtime.js` 保持一致。
- `AI_CONFIG_REQUIRED` 的跳转处理必须走公共函数，不得在各页面散落复制。
- 明文 Key 只允许作为请求体瞬时上传，不得在本目录持久化到浏览器存储。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `client.ts` | Vue 侧统一 HTTP 客户端；收口登录、管理端与个人模型配置 API |

**触发器**: 一旦本文件夹增删文件或鉴权 / AI_CONFIG_REQUIRED 处理口径变化，请立即重写本文件。
