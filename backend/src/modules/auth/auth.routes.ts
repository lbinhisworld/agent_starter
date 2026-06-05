/**
 * [INPUT]: `AuthService`、（可选）`requireAuth` 中间件
 * [OUTPUT]: `/api/auth/login`、`/api/auth/logout` 以及管理端用户维护路由
 * [POS]: 认证域 HTTP 路由装配层
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md（若存在）
 */
import { Router } from 'express';
import type { AuthService } from './auth.service';
import type { RequestHandler } from 'express';

export function createAuthRouter(service: AuthService, requireAuth?: RequestHandler) {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const data = await service.login(req.body);
      res.json(data);
    } catch (error) {
      const status = (error as any)?.status;
      if (typeof status === 'number') {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  });

  router.post('/logout', ...(requireAuth ? [requireAuth] : []), async (req, res, next) => {
    try {
      const payload = (req as any).auth;
      if (!payload) {
        res.status(401).json({ message: '未登录' });
        return;
      }
      const data = await service.logoutCurrentSession(payload);
      res.json(data);
    } catch (error) {
      const status = (error as any)?.status;
      if (typeof status === 'number') {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  });

  return router;
}

export function createAdminRouter(service: AuthService) {
  const router = Router();

  router.get('/users', async (_req, res, next) => {
    try {
      const data = await service.adminListUsers();
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.post('/users', async (req, res, next) => {
    try {
      const data = await service.adminCreateUser(req.body);
      res.status(201).json(data);
    } catch (error) {
      const status = (error as any)?.status;
      if (typeof status === 'number') {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  });

  router.put('/users/:username', async (req, res, next) => {
    try {
      const data = await service.adminUpdateUserStatus(req.params.username, req.body);
      res.json(data);
    } catch (error) {
      const status = (error as any)?.status;
      if (typeof status === 'number') {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  });

  router.put('/users/:username/password', async (req, res, next) => {
    try {
      const data = await service.adminUpdateUserPassword(req.params.username, req.body);
      res.json(data);
    } catch (error) {
      const status = (error as any)?.status;
      if (typeof status === 'number') {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  });

  return router;
}

