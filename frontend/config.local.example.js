/**
 * 本机联调覆盖示例：复制为 config.local.js（已 gitignore，不提交）。
 * 覆盖 frontend/config.js 中的 BACKEND_API_URL。
 */
window.APP_CONFIG = Object.assign(window.APP_CONFIG || {}, {
  MODE: 'online',
  BACKEND_API_URL: 'http://127.0.0.1:3003/api',
});
