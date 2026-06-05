# Folder: e:\03_do1_workspace\do1_smart_cto\frontend-vue\src\model-config

## 地位

个人模型配置页子模块，承载首次登录门禁与后续手动访问共用的最小入口。

## 职责

1. 展示当前登录用户的个人模型配置表单。
2. 只提供「保存并验证」与「退出登录」两条 Phase 1 冻结动作。
3. 不在浏览器持久化用户明文 Key。

## 约束

- `DeepSeek API Key` 为唯一必填项；`API URL`、`Model` 仅作高级项。
- 首次门禁态不展示业务导航入口；永久入口另属 Phase 2。
- 受保护请求与 `AI_CONFIG_REQUIRED` 跳转逻辑必须委托 `src/api/client.ts` / `frontend/js/auth-runtime.js` 的统一口径。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `main.ts` | 挂载 `ModelConfigPage` 到 `#app` |
| `ModelConfigPage.vue` | 个人模型配置最小页面：读取状态、保存并验证、退出登录 |

**触发器**: 一旦本文件夹增删文件或个人模型配置门禁口径变化，请立即重写本文件。
