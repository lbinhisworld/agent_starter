/**
 * [INPUT]: 环境配置、Prisma、auth / ai / problem-cases 模块
 * [OUTPUT]: Express app（统一中间件、鉴权装配、业务路由挂载）
 * [POS]: 后端应用装配入口
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md（若存在）。`/api/me` 下多模块须挂入同一父 `Router`（Express 5 下同 path 多次 `app.use` 未匹配不会顺延）。工具经验：`/api/me/tool-experience/knowledge-tree`、`/api/me/tool-experience/chat-state`（FE-20260413）。
 */
import cors from 'cors';
import express, { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import type { PrismaClient } from '@prisma/client';
import { env } from './config';
import { createPrismaClient } from './lib/prisma';
import { AiConfigService } from './modules/ai/ai-config.service';
import { createAiRouter, createMeAiConfigRouter } from './modules/ai/ai.routes';
import { FallbackProblemCaseParser } from './modules/problem-cases/fallback-problem-case.parser';
import { InMemoryProblemCaseRepository } from './modules/problem-cases/in-memory-problem-case.repository';
import { createProblemCaseRouter } from './modules/problem-cases/problem-case.routes';
import { PrismaProblemCaseRepository } from './modules/problem-cases/prisma-problem-case.repository';
import { ProblemCaseParser, ProblemCaseRepository } from './modules/problem-cases/types';
import { ProblemCaseService } from './modules/problem-cases/problem-case.service';
import { AuthService } from './modules/auth/auth.service';
import { createAdminRouter, createAuthRouter } from './modules/auth/auth.routes';
import { createJwtAuthMiddleware, requireRole } from './modules/auth/jwt.middleware';
import { createToolExperienceChatRouter } from './modules/tool-experience/tool-experience-chat.routes';
import { createToolExperienceKnowledgeRouter } from './modules/tool-experience/tool-experience-knowledge.routes';
import { createToolDetailWorkspaceRouter } from './modules/tool-detail/tool-detail-workspace.routes';
import { openApiDocument } from './swagger';

/** 全局 JSON body 上限（除导入 POST 外） */
const JSON_BODY_LIMIT_DEFAULT = '8mb';
/** POST /api/problem-cases/import 与 POST /api/problem-cases/:id/restore：包内含长 LLM 文本，单独放宽 */
const JSON_BODY_LIMIT_PROBLEM_CASE_IMPORT = '32mb';

const parseJsonDefault = express.json({ limit: JSON_BODY_LIMIT_DEFAULT });
const parseJsonProblemCaseImport = express.json({ limit: JSON_BODY_LIMIT_PROBLEM_CASE_IMPORT });

/** 从请求取 pathname（优先 originalUrl，避免少数环境下 req.path / req.url 与真实路径不一致） */
function pathnameForJsonRoute(req: Request): string {
  const raw = req.originalUrl || req.url || '';
  const pathOnly = raw.split('?')[0].split('#')[0];
  if (pathOnly.length > 1 && pathOnly.endsWith('/')) {
    return pathOnly.slice(0, -1);
  }
  return pathOnly;
}

/** 用路径判断选用哪套 limit，避免 app.use(path, json()) 在部分环境下匹配异常导致仍走 8mb */
function isProblemCaseImportPost(req: Request): boolean {
  if (req.method !== 'POST') return false;
  const full = pathnameForJsonRoute(req);
  if (full === '/api/problem-cases/import') return true;
  if (/\/api\/problem-cases\/[^/]+\/restore$/i.test(full)) return true;
  const p = req.path.length > 1 && req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;
  if (p === '/api/problem-cases/import') return true;
  return /^\/api\/problem-cases\/[^/]+\/restore$/i.test(p);
}

function jsonBodyParser(req: Request, res: Response, next: NextFunction) {
  (isProblemCaseImportPost(req) ? parseJsonProblemCaseImport : parseJsonDefault)(req, res, next);
}

/** 脱敏输出 Authorization，避免在日志中泄露完整 token */
function maskAuthorizationHeader(rawValue: string | undefined): string {
  if (!rawValue) return '-';
  if (!rawValue.startsWith('Bearer ')) return rawValue;
  const token = rawValue.slice('Bearer '.length);
  if (token.length <= 12) return `Bearer ${token}`;
  return `Bearer ${token.slice(0, 6)}...${token.slice(-6)}`;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

interface AppDependencies {
  prisma?: PrismaClient;
  problemCaseRepository?: ProblemCaseRepository;
  problemCaseParser?: ProblemCaseParser;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const prismaClient = dependencies.prisma || createPrismaClientOrStub();
  const aiConfigService = new AiConfigService(prismaClient);
  const problemCaseService = new ProblemCaseService(
    dependencies.problemCaseRepository || createDefaultProblemCaseRepository(prismaClient),
    dependencies.problemCaseParser || new FallbackProblemCaseParser(),
  );
  const authService = new AuthService(prismaClient);
  const requireAuth = createJwtAuthMiddleware(prismaClient);

  // 内网 IP + HTTP 时浏览器会提示 COOP 等「非可信源」；仅影响浏览器安全策略
  app.use(
    env.NODE_ENV === 'development'
      ? helmet({
          crossOriginOpenerPolicy: false,
          originAgentCluster: false,
        })
      : helmet(),
  );
  app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // 导出等场景需让浏览器把 Content-Disposition 暴露给 JS，否则 fetch 读不到文件名（仍回退 problem-case-<id>.json）
    exposedHeaders: ['X-Auth-Token', 'X-Auth-Expires-At', 'Content-Disposition'],
  }));
  // 单一 JSON 解析入口：按 import / restore 选用 32mb，其余 8mb（见 isProblemCaseImportPost）
  // Keep the legacy full-timeline PUT /messages path usable while frontend
  // migrates to incremental message writes.
  app.use(jsonBodyParser);
  morgan.token('auth', (req) => maskAuthorizationHeader(firstHeaderValue(req.headers.authorization)));
  morgan.token('referer', (req) => firstHeaderValue(req.headers.referer) || '-');
  app.use(
    morgan(
      env.NODE_ENV === 'production'
        ? 'combined auth=:auth referer=:referer'
        : ':method :url :status :response-time ms - :res[content-length] auth=:auth referer=:referer',
    ),
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'smart-cto-backend',
      env: env.NODE_ENV,
      /** 设计详情任务 8.5 L4.7 解析器版本戳；联调时对比浏览器实际请求的 API 主机是否已部署此版本 */
      designDetailTask85ParserRev: '20260527-l47-three-keys',
    });
  });

  app.get('/openapi.json', requireAuth, (_req, res) => {
    res.status(200).json(openApiDocument);
  });

  app.use('/api-docs', requireAuth, swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
    const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const host = req.get('host') || `localhost:${env.PORT}`;
    const baseUrl = `${protocol}://${host}`;
    const spec = {
      ...openApiDocument,
      servers: [
        { url: baseUrl, description: '当前站点（与访问地址一致）' },
        { url: 'http://localhost:' + env.PORT, description: '仅本机 localhost' },
      ],
    };
    swaggerUi.setup(spec)(req, res, next);
  });
  // 统一收紧：保证 /api/ai 全量受鉴权保护
  app.use('/api/ai', requireAuth, createAiRouter(aiConfigService, { problemCaseService }));
  // Express 5：同一 path 多次 app.use('/api/me', …) 时，首个子 Router 未匹配会直接 404，不会落到后续挂载。
  // 必须将 /api/me 下各子路由挂到同一父 Router 上，才能在子 Router 间顺延匹配。
  const meRouter = Router();
  meRouter.use(createMeAiConfigRouter(aiConfigService));
  meRouter.use(createToolExperienceKnowledgeRouter(prismaClient));
  meRouter.use(createToolExperienceChatRouter(prismaClient));
  meRouter.use(createToolDetailWorkspaceRouter(prismaClient));
  app.use('/api/me', requireAuth, meRouter);
  app.use('/api/problem-cases', requireAuth, createProblemCaseRouter(problemCaseService));
  app.use('/api/auth', createAuthRouter(authService, requireAuth));
  app.use('/api/admin', requireAuth, requireRole('admin'), createAdminRouter(authService));

  app.use((error: unknown, _req: express.Request, res: express.Response, next: NextFunction) => {
    const err = error as { status?: number; type?: string };
    if (err.status === 400 && err.type === 'entity.parse.failed') {
      res.status(400).json({ message: '请求体不是合法 JSON' });
      return;
    }
    if (err.status === 413 || err.type === 'entity.too.large') {
      res.status(413).json({ message: '请求体超出限制' });
      return;
    }
    next(error);
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({
      message: error instanceof Error ? error.message : '服务器内部错误',
    });
  });

  return { app, authService };
}

function createDefaultProblemCaseRepository(prismaClient: PrismaClient): ProblemCaseRepository {
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
    return new InMemoryProblemCaseRepository();
  }

  return new PrismaProblemCaseRepository(prismaClient);
}

function createPrismaClientOrStub(): PrismaClient {
  const stub: any = {
    appUser: {
      findUnique: async (args: any) => {
        const select = args?.select;
        if (select && 'status' in select) {
          return { status: 'ENABLED' };
        }
        return null;
      },
    },
    adminUser: {
      findUnique: async () => null,
      create: async () => null,
      update: async () => null,
    },
    authSession: {
      create: async () => ({ id: 'sess_stub' }),
      findUnique: async () => ({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        userId: 'stub-user',
        role: 'admin',
      }),
      updateMany: async () => ({ count: 1 }),
    },
    appSetting: {
      findMany: async () => [],
      upsert: async () => null,
    },
    userAiConfig: {
      findUnique: async () => null,
      upsert: async () => null,
    },
    toolExperienceKnowledgeTree: {
      findUnique: async () => null,
      upsert: async () => ({ id: 'stub', userId: 'stub-user', payload: {} }),
    },
    toolExperienceChatState: {
      findUnique: async () => null,
      upsert: async () => ({ id: 'stub', userId: 'stub-user', payload: {} }),
    },
    toolDetailWorkspace: {
      findUnique: async () => null,
      upsert: async () => ({ id: 'stub', userId: 'stub-user', payload: {} }),
    },
    $transaction: async (fn: any) => fn(stub),
  };

  // vitest 单测默认 NODE_ENV=test；这里强制 stub，避免单测卡在真实数据库连接上。
  if (process.env.NODE_ENV === 'test') {
    return stub as PrismaClient;
  }

  if (process.env.DATABASE_URL) {
    return createPrismaClient();
  }

  // 本地无数据库时的最小 stub：
  // - 未登录请求不会触发查询（jwt middleware 会在缺 token 时直接返回 401）
  // - AI 配置读取返回空配置，保证 GET /api/ai/config 仍可工作
  return stub as PrismaClient;
}
