import dotenv from 'dotenv';
import { z } from 'zod';

// 先加载 .env（本地主配置），再用 .env.local 覆盖同名变量（可选的临时覆盖文件）。
// 两者均被 git 忽略；脱敏模板见 .env.example。
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** 监听地址：0.0.0.0 允许局域网内其他设备访问；127.0.0.1 仅本机 */
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  /** 可选：MySQL 会话时区（默认 `+08:00`）；见 `src/lib/prisma.ts` */
  DATABASE_SESSION_TIMEZONE: z.string().optional(),
  AI_CONFIG_ENCRYPTION_SECRET: z.string().optional(),
  AI_CONFIG_VERIFY_TIMEOUT_MS: z.string().optional(),
  AUTH_ENFORCE_SID: z.enum(['true', 'false']).optional(),
  AUTH_SESSION_TTL_MS: z.string().optional(),
  AUTH_SESSION_RENEW_THROTTLE_MS: z.string().optional(),
  AUTH_SESSION_OBSERVE: z.enum(['true', 'false']).optional(),
  AUTH_RENEWAL_LOG_EVERY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
