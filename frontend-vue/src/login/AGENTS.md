# Folder: e:\03_do1_workspace\do1_smart_cto\frontend-vue\src\login

## 地位

Vue 登录页子模块，负责 online/local 登录入口与登录成功后的首跳门禁。

## 职责

1. 渲染登录表单并写入同源鉴权存储。
2. online 登录成功后先检查当前用户 AI 配置状态，再决定去业务页还是 `model-config.html`。
3. local 模式仅作为联调占位，不接后端模型配置门禁。

## 约束

- 登录首跳门禁只负责 UX 预判；业务页刷新/深链二次门禁必须由 `frontend/js/auth-runtime.js` 接续。
- `admin` 本轮不纳入个人模型 Key 门禁，避免误伤管理后台链路。
- 不得在本目录自行保存用户明文 Key。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `main.ts` | 挂载 `LoginPage` 到 `#app` |
| `LoginPage.vue` | 登录表单与 online 首跳门禁判定 |

**触发器**: 一旦本文件夹增删文件或登录首跳门禁逻辑变化，请立即重写本文件。
