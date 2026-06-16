# frontend-vue（登录 / 管理后台）

本目录为登录页（login）与管理后台（admin）的 Vue 源码，构建产物会输出到 **`../frontend`**，供主前端使用。

## 修改后必须打包并更新 frontend

**只要改动了本目录下的源码，就需要重新构建，否则 frontend 仍为旧版本。**

```bash
cd frontend-vue
npm install   # 首次或依赖变更时
npm run build
```

构建完成后会更新到 `../frontend` 的：

- `frontend/vue-auth-assets/`（JS/CSS 等静态资源）
- `frontend/login.html`
- `frontend/admin.html`

请将上述 frontend 中的变更一并提交或部署，线上/联调环境才会生效。

## 本地开发

```bash
npm run dev
```

浏览器访问提示的地址（默认 6667）可调试登录/管理后台页面。
