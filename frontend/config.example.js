/**
 * 配置示例。复制本文件为 config.local.js 并填入你的 DeepSeek API Key。
 * config.local.js 已加入 .gitignore，不会提交到 Git。
 */
window.APP_CONFIG = {
  /**
   * 运行模式：
   * - local：AI 直连 DeepSeek（需要 DEEPSEEK_API_KEY），数据存 localStorage
   * - online：AI + 数据都走后端（BACKEND_API_URL）
   */
  MODE: 'online', // 'local' | 'online' — 推荐 online：AI 与持久化走后端；无后端联调时再改为 local

  /** AI：直连 DeepSeek（local 模式必填；online 时密钥由后端配置） */
  DEEPSEEK_API_KEY: '',
  DEEPSEEK_API_URL: 'https://api.deepseek.com/v1/chat/completions',
  DEEPSEEK_MODEL: 'deepseek-chat',

  /** 后端 API 基础地址（以 /api 结尾）。MODE=online 时必填，端口以本机 backend 实际监听为准 */
  BACKEND_API_URL: 'http://127.0.0.1:3000/api',
};
