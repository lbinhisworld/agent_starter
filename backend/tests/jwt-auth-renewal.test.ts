import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { AuthService } from '../src/modules/auth/auth.service';
import { createJwtAuthMiddleware } from '../src/modules/auth/jwt.middleware';

function makeMockPrisma(store: { adminUsers: any[]; appUsers: any[]; sessions: any[] }) {
  return {
    adminUser: {
      findUnique: async ({ where }: any) => store.adminUsers.find((u) => u.username === where.username) || null,
      create: async ({ data }: any) => {
        const item = { id: 'adm_' + data.username, username: data.username, passwordHash: data.passwordHash, createdAt: new Date(), updatedAt: new Date() };
        store.adminUsers.push(item);
        return item;
      },
    },
    appUser: {
      findUnique: async ({ where, select }: any) => {
        const item = store.appUsers.find((u) => u.id === where.id || u.username === where.username);
        if (!item) return null;
        if (select) return { status: item.status };
        return item;
      },
      findMany: async () => store.appUsers.slice(),
      create: async ({ data }: any) => {
        const item = { id: 'u_' + data.username, username: data.username, passwordHash: data.passwordHash, status: data.status, createdAt: new Date(), updatedAt: new Date() };
        store.appUsers.push(item);
        return item;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        store.appUsers = store.appUsers.map((u) => {
          if (u.username === where.username) {
            count++;
            return { ...u, status: data.status };
          }
          return u;
        });
        return { count };
      },
      update: async ({ where, data }: any) => {
        store.appUsers = store.appUsers.map((u) => (u.username === where.username ? { ...u, passwordHash: data.passwordHash } : u));
        return { count: 1 };
      },
    },
    authSession: {
      create: async ({ data }: any) => {
        const item = { id: 'sess_' + (store.sessions.length + 1), ...data, createdAt: new Date(), revokedAt: null };
        store.sessions.push(item);
        return { id: item.id };
      },
      findUnique: async ({ where }: any) => store.sessions.find((s) => s.id === where.id) || null,
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        store.sessions = store.sessions.map((s) => {
          const notExpired = s.expiresAt.getTime() > Date.now();
          const shouldUpdate = s.id === where.id && s.revokedAt === null && notExpired;
          if (shouldUpdate) {
            count++;
            return { ...s, ...data };
          }
          return s;
        });
        return { count };
      },
    },
  } as any;
}

describe('固定 token + 会话滑动续期', () => {
  const prevExpires = process.env.JWT_EXPIRES_IN;
  const prevEnforceSid = process.env.AUTH_ENFORCE_SID;
  const prevThrottle = process.env.AUTH_SESSION_RENEW_THROTTLE_MS;

  beforeEach(() => {
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.AUTH_ENFORCE_SID;
    delete process.env.AUTH_SESSION_RENEW_THROTTLE_MS;
  });

  afterEach(() => {
    if (prevExpires === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = prevExpires;
    if (prevEnforceSid === undefined) delete process.env.AUTH_ENFORCE_SID;
    else process.env.AUTH_ENFORCE_SID = prevEnforceSid;
    if (prevThrottle === undefined) delete process.env.AUTH_SESSION_RENEW_THROTTLE_MS;
    else process.env.AUTH_SESSION_RENEW_THROTTLE_MS = prevThrottle;
  });

  it('登录返回固定 token（默认 30d）并包含 sid', async () => {
    const passwordHash = await bcrypt.hash('root', 10);
    const store = {
      adminUsers: [{ id: 'adm_root', username: 'root', passwordHash, createdAt: new Date(), updatedAt: new Date() }],
      appUsers: [],
      sessions: [],
    };
    const prisma = makeMockPrisma(store);
    const service = new AuthService(prisma);

    const res: any = await service.login({ username: 'root', password: 'root' });
    expect(res.expiresIn).toBe('30d');

    const decoded = jwt.decode(res.token) as { exp?: number; sid?: string };
    expect(decoded?.exp).toBeDefined();
    expect(decoded?.sid).toBeTruthy();
    const seconds = ((decoded!.exp! * 1000 - Date.now()) / 1000);
    expect(seconds).toBeGreaterThan(24 * 3600);
  });

  it('受保护接口 200 响应不再返回续期 token 头', async () => {
    const { app } = createApp();
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    const token = jwt.sign({ userId: 'adm_root', username: 'root', role: 'admin', sid: 'sess_stub' }, secret, { expiresIn: '1h' });

    const response = await request(app)
      .get('/api/ai/config')
      .set('Authorization', 'Bearer ' + token);

    expect(response.status).toBe(200);
    expect(response.headers['x-auth-token']).toBeUndefined();
    expect(response.headers['x-auth-expires-at']).toBeUndefined();
  });

  it('未带 token 访问受保护接口返回 401', async () => {
    const { app } = createApp();
    const response = await request(app).get('/api/ai/config');
    expect(response.status).toBe(401);
  });

  it('非法 token 返回 401', async () => {
    const { app } = createApp();
    const response = await request(app)
      .get('/api/ai/config')
      .set('Authorization', 'Bearer not-a-valid-jwt');
    expect(response.status).toBe(401);
  });

  it('过期 token 返回 401', async () => {
    const { app } = createApp();
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    const pastExp = Math.floor(Date.now() / 1000) - 120;
    const token = jwt.sign({ userId: 'adm_root', username: 'root', role: 'admin', sid: 'sess_stub', exp: pastExp } as jwt.JwtPayload, secret);
    const response = await request(app)
      .get('/api/ai/config')
      .set('Authorization', 'Bearer ' + token);
    expect(response.status).toBe(401);
  });

  it('AUTH_ENFORCE_SID=false 时，无 sid 的旧 token 可放行', async () => {
    process.env.AUTH_ENFORCE_SID = 'false';
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    const token = jwt.sign({ userId: 'adm_root', username: 'root', role: 'admin' }, secret, { expiresIn: '1h' });
    const prisma = {
      appUser: { findUnique: async () => ({ status: 'ENABLED' }) },
      authSession: { findUnique: async () => null, updateMany: async () => ({ count: 0 }) },
    } as any;
    const middleware = createJwtAuthMiddleware(prisma);
    const req: any = { header: (k: string) => (k === 'Authorization' ? 'Bearer ' + token : '') };
    let statusCode = 0;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {},
      on() {},
    };
    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(statusCode).toBe(0);
  });

  it('续期节流生效：写库次数明显低于请求数', async () => {
    process.env.AUTH_SESSION_RENEW_THROTTLE_MS = '60000';
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    const token = jwt.sign({ userId: 'adm_root', username: 'root', role: 'admin', sid: 'sess_1' }, secret, { expiresIn: '1h' });
    let renewWrites = 0;
    const session = {
      revokedAt: null,
      expiresAt: new Date(Date.now() + 8 * 3600_000),
      lastActivityAt: new Date(Date.now() - 120_000),
    };
    const prisma = {
      appUser: { findUnique: async () => ({ status: 'ENABLED' }) },
      authSession: {
        findUnique: async () => ({ revokedAt: session.revokedAt, expiresAt: session.expiresAt }),
        updateMany: async ({ where, data }: any) => {
          if (session.lastActivityAt.getTime() <= where.lastActivityAt.lte.getTime()) {
            renewWrites++;
            session.lastActivityAt = data.lastActivityAt;
            session.expiresAt = data.expiresAt;
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
    } as any;
    const middleware = createJwtAuthMiddleware(prisma);
    const once = async () => {
      const req: any = { header: (k: string) => (k === 'Authorization' ? 'Bearer ' + token : '') };
      const listeners: Record<string, (() => void)[]> = {};
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json() {},
        on(event: string, fn: () => void) {
          listeners[event] = listeners[event] || [];
          listeners[event].push(fn);
        },
      };
      await middleware(req, res, () => {});
      for (const fn of listeners.finish || []) fn();
    };
    for (let i = 0; i < 20; i++) await once();
    expect(renewWrites).toBeLessThan(5);
  });
});
