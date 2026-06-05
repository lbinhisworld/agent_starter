/**
 * [INPUT]: `PrismaClient`、`bcryptjs`、`jsonwebtoken`
 * [OUTPUT]: 登录鉴权、管理员用户管理、当前会话退出能力
 * [POS]: 认证域服务（会话创建与 token 签发入口）
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md（若存在）
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type AuthRole = 'admin' | 'user';

/** JWT 载荷（与 `jsonwebtoken` verify 结果对齐） */
export type JwtAuthPayload = {
  userId: string;
  username: string;
  role: AuthRole;
  sid: string;
};

/** 固定 token：默认较长有效期，真实会话过期以 DB `AuthSession` 为准 */
export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '30d';
}

export const AUTH_SESSION_TTL_MS = Number(process.env.AUTH_SESSION_TTL_MS || 8 * 60 * 60 * 1000);

/**
 * 签发访问令牌，并解析出过期时间（毫秒时间戳，与 `exp` 一致）。
 * 供登录与受保护请求续期共用，避免过期策略分叉。
 */
export function signJwtAccessToken(payload: JwtAuthPayload): { token: string; expiresAtMs: number } {
  // 仅签发业务字段；`jwt.verify` 返回体可能含 `exp`/`iat`，若原样传入 `sign` 会与 `expiresIn` 冲突
  const clean: JwtAuthPayload = {
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    sid: payload.sid,
  };
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
  const expiresIn = getJwtExpiresIn();
  const token = jwt.sign(clean as any, secret as any, { expiresIn } as any);
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expSec = decoded?.exp;
  const expiresAtMs = expSec != null ? expSec * 1000 : Date.now();
  return { token, expiresAtMs };
}

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async login(raw: unknown) {
    const input = loginSchema.parse(raw);

    // 为了本地联调：确保存在默认管理员 root/root
    await this.ensureDefaultRootAdmin();

    // 先尝试管理员账号
    const admin = await this.prisma.adminUser.findUnique({ where: { username: input.username } });
    if (admin) {
      const ok = await bcrypt.compare(input.password, admin.passwordHash);
      if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
      const token = await this.issueTokenWithSession({ userId: admin.id, username: admin.username, role: 'admin' as AuthRole });
      return {
        token,
        expiresIn: getJwtExpiresIn(),
        user: { id: admin.id, username: admin.username, role: 'admin' as AuthRole },
      };
    }

    // 再尝试业务用户
    const user = await this.prisma.appUser.findUnique({ where: { username: input.username } });
    if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

    if (String(user.status) !== 'ENABLED') {
      throw Object.assign(new Error('User disabled'), { status: 403 });
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

    const token = await this.issueTokenWithSession({ userId: user.id, username: user.username, role: 'user' as AuthRole });
    return {
      token,
      expiresIn: getJwtExpiresIn(),
      user: { id: user.id, username: user.username, role: 'user' as AuthRole },
    };
  }

  async adminListUsers() {
    const items = await this.prisma.appUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, status: true, createdAt: true, updatedAt: true },
    });
    return { items };
  }

  async adminCreateUser(raw: unknown) {
    const schema = z.object({
      username: z.string().min(1),
    });
    const input = schema.parse(raw);

    const exist = await this.prisma.appUser.findUnique({ where: { username: input.username } });
    if (exist) throw Object.assign(new Error('Username already exists'), { status: 409 });

    const plainPassword = generateRandomPassword(14);
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = await this.prisma.appUser.create({
      data: {
        username: input.username,
        passwordHash,
        status: 'ENABLED',
      },
      select: { id: true, username: true, status: true, createdAt: true, updatedAt: true },
    });

    // 按你的要求：新增时返回明文密码一次（前端展示/管理员复制）
    return { user, passwordPlain: plainPassword };
  }

  async adminUpdateUserStatus(username: string, raw: unknown) {
    const schema = z.object({
      status: z.enum(['ENABLED', 'DISABLED']),
    });
    const input = schema.parse(raw);

    const updated = await this.prisma.appUser.updateMany({
      where: { username },
      data: { status: input.status },
    });
    if (updated.count === 0) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    const user = await this.prisma.appUser.findUnique({
      where: { username },
      select: { id: true, username: true, status: true, createdAt: true, updatedAt: true },
    });
    return { user };
  }

  async adminUpdateUserPassword(username: string, raw: unknown) {
    const schema = z.object({
      password: z.string().min(6),
    });
    const input = schema.parse(raw);
    const passwordHash = await bcrypt.hash(input.password, 10);

    // 先查管理员表（如 root），支持修改管理员密码
    const admin = await this.prisma.adminUser.findUnique({ where: { username } });
    if (admin) {
      await this.prisma.adminUser.update({
        where: { username },
        data: { passwordHash },
      });
      return { ok: true };
    }

    const user = await this.prisma.appUser.findUnique({ where: { username } });
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

    await this.prisma.appUser.update({
      where: { username },
      data: { passwordHash },
    });

    return { ok: true };
  }

  async logoutCurrentSession(payload: JwtAuthPayload) {
    const now = new Date();
    await this.prisma.authSession.updateMany({
      where: {
        id: payload.sid,
        userId: payload.userId,
        role: payload.role,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokedReason: 'LOGOUT',
      },
    });
    return { ok: true };
  }

  private async issueTokenWithSession(payload: Omit<JwtAuthPayload, 'sid'>) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AUTH_SESSION_TTL_MS);
    const session = await this.prisma.authSession.create({
      data: {
        userId: payload.userId,
        usernameSnapshot: payload.username,
        role: payload.role,
        lastActivityAt: now,
        expiresAt,
      },
      select: { id: true },
    });
    return this.signToken({ ...payload, sid: session.id });
  }

  private signToken(payload: JwtAuthPayload) {
    return signJwtAccessToken(payload).token;
  }

  async ensureDefaultRootAdmin() {
    try {
      const root = await this.prisma.adminUser.findUnique({ where: { username: 'root' } });
      if (root) return;
      const passwordHash = await bcrypt.hash('root', 10);
      await this.prisma.adminUser.create({
        data: { username: 'root', passwordHash },
      });
    } catch {
      // 忽略：若数据库尚未就绪/权限不足，直接走后续逻辑（登录会失败，由调用方处理）
    }
  }
}

function generateRandomPassword(length: number) {
  // 排除易混淆字符：0/O、1/l/I、等
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    out += chars[idx];
  }
  return out;
}

