import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
          if (s.id === where.id && s.revokedAt === null) {
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

describe('auth flow', () => {
  it('admin login works', async () => {
    const passwordHash = await bcrypt.hash('root', 10);
    const store = {
      adminUsers: [{ id: 'adm_root', username: 'root', passwordHash, createdAt: new Date(), updatedAt: new Date() }],
      appUsers: [],
      sessions: [],
    };
    const prisma = makeMockPrisma(store);
    const service = new AuthService(prisma);

    const res: any = await service.login({ username: 'root', password: 'root' });
    expect(res.user.role).toBe('admin');
    expect(typeof res.token).toBe('string');
  });

  it('disabled user login returns 403', async () => {
    const passwordHash = await bcrypt.hash('pwd123', 10);
    const store = {
      adminUsers: [],
      appUsers: [{ id: 'u_1', username: 'u1', passwordHash, status: 'DISABLED', createdAt: new Date(), updatedAt: new Date() }],
      sessions: [],
    };
    const prisma = makeMockPrisma(store);
    const service = new AuthService(prisma);

    await expect(service.login({ username: 'u1', password: 'pwd123' })).rejects.toMatchObject({ status: 403 });
  });

  it('jwt middleware blocks disabled user', async () => {
    const passwordHash = await bcrypt.hash('pwd123', 10);
    const store = {
      adminUsers: [],
      appUsers: [{ id: 'u_1', username: 'u1', passwordHash, status: 'DISABLED', createdAt: new Date(), updatedAt: new Date() }],
      sessions: [{ id: 'sess_1', userId: 'u_1', role: 'user', revokedAt: null, expiresAt: new Date(Date.now() + 3600_000), lastActivityAt: new Date() }],
    };
    const prisma = makeMockPrisma(store);
    const middleware = createJwtAuthMiddleware(prisma);

    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    const token = jwt.sign({ userId: 'u_1', username: 'u1', role: 'user', sid: 'sess_1' }, secret, { expiresIn: '2h' });

    const req: any = { header: (k: string) => (k === 'Authorization' ? 'Bearer ' + token : '') };
    let statusCode = 0;
    let payload: any = null;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(obj: any) {
        payload = obj;
      },
    };
    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('admin update status works', async () => {
    const passwordHash = await bcrypt.hash('pwd123', 10);
    const store = {
      adminUsers: [],
      appUsers: [{ id: 'u_1', username: 'u1', passwordHash, status: 'ENABLED', createdAt: new Date(), updatedAt: new Date() }],
      sessions: [],
    };
    const prisma = makeMockPrisma(store);
    const service = new AuthService(prisma);

    await service.adminUpdateUserStatus('u1', { status: 'DISABLED' });
    expect(store.appUsers[0].status).toBe('DISABLED');
  });
});

