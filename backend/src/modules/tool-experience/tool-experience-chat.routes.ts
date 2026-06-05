/**
 * [INPUT]: PrismaClient、Express
 * [OUTPUT]: `GET|PUT /tool-experience/chat-state`（挂载在 `/api/me` 下）
 * [POS]: 工具经验对话区 HTTP 入口
 *
 * [PROTOCOL]: 与 `tool-experience-chat.service.ts` 契约一致；变更时同步 `backend/src/app.ts` 挂载
 */
import { Router } from 'express';
import type { NextFunction, Request, Response as ExpressResponse } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { JwtAuthPayload } from '../auth/auth.service';
import { ToolExperienceChatService, parseToolExpChatBody } from './tool-experience-chat.service';

function readAuthPayload(req: Request) {
  return (req as unknown as { auth?: JwtAuthPayload }).auth;
}

function requireAuthPayload(req: Request, res: ExpressResponse): JwtAuthPayload | null {
  const payload = readAuthPayload(req);
  if (!payload) {
    res.status(401).json({ message: '未登录' });
    return null;
  }
  return payload;
}

function replyKnownError(error: unknown, res: ExpressResponse, next: NextFunction) {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      code: 'BAD_REQUEST',
      message: error.issues[0]?.message || '请求参数不合法',
    });
    return;
  }
  next(error);
}

export function createToolExperienceChatRouter(prisma: PrismaClient) {
  const router = Router();
  const service = new ToolExperienceChatService(prisma);

  router.get('/tool-experience/chat-state', async (req, res, next) => {
    try {
      const auth = requireAuthPayload(req, res);
      if (!auth) return;
      const payload = await service.getPayload(auth.userId);
      res.status(200).json({ payload });
    } catch (error) {
      next(error);
    }
  });

  router.put('/tool-experience/chat-state', async (req, res, next) => {
    try {
      const auth = requireAuthPayload(req, res);
      if (!auth) return;
      const payload = parseToolExpChatBody(req.body);
      await service.savePayload(auth.userId, payload);
      res.status(200).json({ ok: true, payload });
    } catch (error) {
      replyKnownError(error, res, next);
    }
  });

  return router;
}
