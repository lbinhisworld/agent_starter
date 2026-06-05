/**
 * [INPUT]: `DATABASE_URL`、可选 `DATABASE_SESSION_TIMEZONE`
 * [OUTPUT]: 带 MariaDB 驱动适配器的 `PrismaClient`（连接建立后 `SET time_zone` 统一东八区口径）
 * [POS]: 后端唯一 Prisma 构造入口
 *
 * [PROTOCOL]: 变更连接池/时区策略时同步 `docs/agents/backend/01-context.md` 与 `scripts/README-local.md` 中的 DATABASE 说明
 */
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '@prisma/client';

/** 默认东八区偏移（不依赖 MySQL 加载时区表）；可用 `DATABASE_SESSION_TIMEZONE` 覆盖为 `Asia/Shanghai` 等 */
const DEFAULT_MYSQL_SESSION_TIME_ZONE = '+08:00';

function resolveMysqlSessionTimeZone(): string {
  const raw = process.env.DATABASE_SESSION_TIMEZONE?.trim();
  if (!raw) return DEFAULT_MYSQL_SESSION_TIME_ZONE;
  if (!/^[A-Za-z0-9_+/:\-]{1,64}$/.test(raw)) return DEFAULT_MYSQL_SESSION_TIME_ZONE;
  return raw;
}

/**
 * 启动时校验：已加载的 Client DMMF 须含 Task1 需求轮次字段，否则会在 `replaceCustomerRequirementSectionGraph` 等处报 `Unknown argument designDetailRequirementSyncGen`（多为未 `prisma generate` 或 Node 未完全重启导致仍用旧 require 缓存）。
 */
function assertPrismaClientSchemaHasTask1RequirementSyncFields(): void {
  const models = Prisma?.dmmf?.datamodel?.models;
  if (!Array.isArray(models)) return;
  const problemCase = models.find((m) => m.name === 'ProblemCase');
  const token = models.find((m) => m.name === 'DesignDetailTaskToken');
  const okPc = problemCase?.fields?.some((f: { name: string }) => f.name === 'designDetailRequirementSyncGen');
  const okTok = token?.fields?.some((f: { name: string }) => f.name === 'requirementSyncGeneration');
  if (!okPc || !okTok) {
    throw new Error(
      '当前加载的 @prisma/client 与 prisma/schema.prisma 不一致（缺少 ProblemCase.designDetailRequirementSyncGen 或 DesignDetailTaskToken.requirementSyncGeneration）。请在 backend 目录执行 npx prisma generate，然后完全停止 Node 进程再启动（勿在未退出进程时仅依赖热重载）。',
    );
  }
}

declare global {
  /** 仅生产环境复用，避免 serverless/多实例外单机内重复建连；开发环境**勿**挂 global，否则 ts-node-dev 热重载后仍持有旧 PrismaClient（`prisma generate` 后 DMMF 不更新 → `Unknown argument designDetailRequirementSyncGen`） */
  // eslint-disable-next-line no-var
  var __smartCtoPrisma__: PrismaClient | undefined;
}

export function createPrismaClient() {
  assertPrismaClientSchemaHasTask1RequirementSyncFields();

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize PrismaClient.');
  }

  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\//, '').split('?')[0] || undefined;
  const sessionTz = resolveMysqlSessionTimeZone();

  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || '3306'),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      /**
       * mariadb 连接器在每条连接上执行 `SET time_zone=?`，使 `NOW()` / `CURRENT_TIMESTAMP`（含 Prisma `@default(now())`）与东八区一致；
       * 同时统一驱动对 DATETIME 的解析口径。
       */
      timezone: sessionTz,
    }),
  });
}

/** 开发/测试：`NODE_ENV !== 'production'` 时每次进程加载本模块新建 Client（与 `predev`/`postinstall` 的 `prisma generate` 一致）；生产：`global` 单例 */
export const prisma: PrismaClient =
  process.env.NODE_ENV === 'production'
    ? (global.__smartCtoPrisma__ ??= createPrismaClient())
    : createPrismaClient();
