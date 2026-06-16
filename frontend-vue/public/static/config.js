/**
 * 默认配置。若存在 config.local.js 会在其后加载并覆盖此处配置。
 * 安全约束：仓库内不得提交真实密钥；DEEPSEEK_API_KEY 仅允许空值或占位符。
 */
window.APP_CONFIG = window.APP_CONFIG || {
  /**
   * 运行模式：
   * - local：AI 直连 DeepSeek（需要 DEEPSEEK_API_KEY），数据存 IndexedDB（首次自动从 localStorage 迁移）
   * - online：AI + 数据都走后端（BACKEND_API_URL）
   */
  MODE: 'online', // 'local' | 'online'

  /** AI：直连 DeepSeek（生产语义：前端不保留真实 Key） */
  DEEPSEEK_API_KEY: '',
  DEEPSEEK_API_URL: 'https://api.deepseek.com/v1/chat/completions',
  DEEPSEEK_MODEL: 'deepseek-chat',

  /** 后端 API 基础地址（以 /api 结尾）。MODE=online 时需要 */
  BACKEND_API_URL: 'http://127.0.0.1:6668/api',
};