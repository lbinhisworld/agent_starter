/**
 * Smart CTO v2 PM2 生态系统配置
 *
 * 使用方式：
 *   pm2 start ecosystem.config.js    # 启动
 *   pm2 restart smart-cto-v2          # 重启
 *   pm2 logs smart-cto-v2             # 查看日志
 */
module.exports = {
  apps: [
    {
      name: 'smart-cto-v2',
      script: 'npm',
      args: 'start',
      cwd: '/qiqiao/do1_smart_cto_v2/backend',

      env: {
        NODE_ENV: 'production',
        PORT: 3099,
      },

      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '512M',

      error_file: '/qiqiao/do1_smart_cto_v2/logs/error.log',
      out_file: '/qiqiao/do1_smart_cto_v2/logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      watch: false,
    },
  ],
};
