/**
 * 默认配置。若存在 config.local.js 会在其后加载并覆盖此处配置。
 * 安全约束：仓库内不得提交真实密钥。
 *
 * 运行模式已统一为 online：AI 调用与数据持久化均走后端（BACKEND_API_URL），
 * 前端不再保留 DeepSeek 直连（local 模式已于 2026-06-17 废弃）。
 *
 * 注意：MODE 字段必须保留为 'online' —— storage.js / storage-http-adapter.js 等
 * 运行时 JS 直接读 window.APP_CONFIG.MODE === 'online' 来启用后端适配器，
 * 删掉此字段会导致适配器被禁用、列表数据丢失。请勿删改此值。
 */
window.APP_CONFIG = window.APP_CONFIG || {
  MODE: 'online',

  /** DeepSeek 端点/模型（仅 model-config 页高级项展示用；实际 Key 由后端 ai-config 管理，前端不持有） */
  DEEPSEEK_API_URL: 'https://api.deepseek.com/v1/chat/completions',
  DEEPSEEK_MODEL: 'deepseek-chat',

  /** 后端 API 基础地址（以 /api 结尾）。 */
  BACKEND_API_URL: 'http://127.0.0.1:6688/api',
};