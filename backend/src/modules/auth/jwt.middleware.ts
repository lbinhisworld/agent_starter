/**
 * [INPUT]: `jsonwebtoken`、`PrismaClient`、`auth.service`（载荷类型与签发）
 * [OUTPUT]: `createJwtAuthMiddleware`、`requireRole`；按 `sid` 校验会话并做节流滑动续期
 * [POS]: HTTP Bearer JWT + DB 会话鉴权中间件
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md（若存在）
 */
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import type { AuthRole, JwtAuthPayload } from './auth.service';
import { AUTH_SESSION_TTL_MS } from './auth.service';

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev_jwt_secret';
}

/** 保持导出常量，兼容历史引用；固定 token 模式下不再写响应头 */
const RENEWAL_HEADER_TOKEN = 'X-Auth-Token';
const RENEWAL_HEADER_EXPIRES = 'X-Auth-Expires-At';
let renewalWriteCount = 0;

function getRenewThrottleMs() {
  return Number(process.env.AUTH_SESSION_RENEW_THROTTLE_MS || 2 * 60 * 1000);
}
function getAuthEnforceSid() {
  return String(process.env.AUTH_ENFORCE_SID || 'true') !== 'false';
}
function getAuthObserve() {
  return String(process.env.AUTH_SESSION_OBSERVE || 'true') !== 'false';
}
function getRenewalLogEvery() {
  return Number(process.env.AUTH_RENEWAL_LOG_EVERY || 20);
}

function attachSessionRenewalOnSuccess(res: Response, prisma: PrismaClient, sessionId: string) {
  let scheduled = false;
  const runRenewal = async () => {
    if (scheduled) return;
    scheduled = true;
    const code = res.statusCode;
    if (code < 200 || code >= 300) return;
    const now = new Date();
    const renewCutoff = new Date(now.getTime() - getRenewThrottleMs());
    const nextExpiresAt = new Date(now.getTime() + AUTH_SESSION_TTL_MS);
    const result = await prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: now },
        lastActivityAt: { lte: renewCutoff },
      },
      data: {
        lastActivityAt: now,
        expiresAt: nextExpiresAt,
      },
    });
    if (result.count > 0) {
      renewalWriteCount += result.count;
      if (getAuthObserve() && renewalWriteCount % Math.max(1, getRenewalLogEvery()) === 0) {
        console.info(`[auth-observe] renewal_write_count=${renewalWriteCount}`);
      }
    }
  };
  res.on('finish', () => {
    void runRenewal();
  });
}

function hasSessionId(payload: JwtAuthPayload): payload is JwtAuthPayload & { sid: string } {
  return typeof payload.sid === 'string' && payload.sid.length > 0;
}

function logAuthObserve(event: string, extra?: string) {
  if (!getAuthObserve()) return;
  const suffix = extra ? ` ${extra}` : '';
  console.warn(`[auth-observe] event=${event}${suffix}`);
}

function tryReply401(res: Response) {
  const code = res.statusCode;
  if (code !== 401) {
    res.status(401).json({ message: '登录已失效' });
  }
}

export function createJwtAuthMiddleware(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.header('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: '未登录' });
      return;
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = jwt.verify(token, getJwtSecret()) as JwtAuthPayload;
      const hasSid = hasSessionId(payload);
      const enforceSid = getAuthEnforceSid();
      if (enforceSid && !hasSid) {
        logAuthObserve('sid_missing');
        res.status(401).json({ message: '登录已失效' });
        return;
      }
      if (hasSid) {
        const session = await prisma.authSession.findUnique({
          where: { id: payload.sid },
          select: { revokedAt: true, expiresAt: true },
        });
        if (!session) {
          logAuthObserve('session_not_found', `sid=${payload.sid}`);
          res.status(401).json({ message: '登录已失效' });
          return;
        }
        if (session.revokedAt) {
          logAuthObserve('session_revoked', `sid=${payload.sid}`);
          res.status(401).json({ message: '登录已失效' });
          return;
        }
        if (session.expiresAt.getTime() <= Date.now()) {
          logAuthObserve('session_expired', `sid=${payload.sid}`);
          res.status(401).json({ message: '登录已失效' });
          return;
        }
      } else if (!enforceSid) {
        logAuthObserve('sid_missing_bypass');
      }
      (req as any).auth = payload;

      // 业务用户：强制检查启用/停用状态
      if (payload.role === 'user') {
        const user = await prisma.appUser.findUnique({ where: { id: payload.userId }, select: { status: true } });
        if (!user || String(user.status) !== 'ENABLED') {
          res.status(403).json({ message: '用户已停用' });
          return;
        }
      }

      if (hasSid) {
        attachSessionRenewalOnSuccess(res, prisma, payload.sid);
      }
      next();
    } catch (_err) {
      tryReply401(res);
    }
  };
}

export function requireRole(role: AuthRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = (req as any).auth as JwtAuthPayload | undefined;
    if (!payload) {
      res.status(401).json({ message: '未登录' });
      return;
    }
    if (payload.role !== role) {
      res.status(403).json({ message: '权限不足' });
      return;
    }
    next();
  };
}

export { RENEWAL_HEADER_EXPIRES, RENEWAL_HEADER_TOKEN };
