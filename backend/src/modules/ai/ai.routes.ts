/**
 * [INPUT]: Express、Zod、AiConfigService、当前登录态 `req.auth`、ai-chat-truncation
 * [OUTPUT]: `/api/ai/*` 与 `/api/me/ai-config/*` 路由（含系统配置权限收口、用户级配置门禁与 chat 代理）
 * [POS]: AI 模块 HTTP 入口
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md（若存在）；task1-prelim-*、`tool-experience-capability` 可启用上游 `response_format: json_object`（FE-20260403；工具经验页 FE-20260422）。
 * FE-20260324-31：上游 AI `fetch` 增加 300s `AbortSignal` 超时，避免 Node 侧永久挂起导致前端一直等待。
 * FE-20260408：上游返回 401（多为用户 DeepSeek Key 无效）映射为 **502** + `code: AI_UPSTREAM_AUTH_FAILED`，避免与 JWT 401 混淆导致前端清会话跳登录。
 * FE-20260506：请求体可选 `llmLog`（caseId/taskId/callTarget）；chat 2xx 且注入 `problemCaseService` 时写入 `ProblemCaseLlmLog`。
 */
import { Router } from 'express';
import type { NextFunction, Request, Response as ExpressResponse } from 'express';
import { z } from 'zod';
import type { JwtAuthPayload } from '../auth/auth.service';
import {
  AiConfigService,
  FORBIDDEN_CODE,
} from './ai-config.service';
import {
  inferTruncationFromProvider,
  readDefaultMaxOutputTokensFromEnv,
  resolveEffectiveMaxOutputTokens,
} from './ai-chat-truncation';
import type { ProblemCaseService } from '../problem-cases/problem-case.service';

function upstreamWantsJsonObjectMode(taskTag?: string): boolean {
  if (!taskTag) return false;
  return (
    taskTag === 'task1-prelim-depth-v2' ||
    taskTag === 'task1-prelim-refine' ||
    taskTag === 'task1-prelim-merge' ||
    taskTag === 'tool-experience-capability'
  );
}

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })).min(1),
  /** 可选：与前端任务标签对齐，例如 task11 会保底使用足够大的输出上限 */
  taskTag: z.string().optional(),
  /** 可选：显式指定本次 max_tokens（256～硬封顶，由服务端裁剪） */
  maxOutputTokens: z.number().int().min(256).optional(),
  /** 可选：设计详情等场景，成功返回后落库 ProblemCaseLlmLog */
  llmLog: z
    .object({
      caseId: z.string().trim().min(1),
      taskId: z.string().trim().min(1),
      callTarget: z.string().trim().min(1),
    })
    .optional(),
});

type RouteError = Error & {
  status?: number;
  code?: string;
};

function readAuthPayload(req: Request) {
  return (req as any).auth as JwtAuthPayload | undefined;
}

function requireAuthPayload(req: Request, res: ExpressResponse) {
  const payload = readAuthPayload(req);
  if (!payload) {
    res.status(401).json({ message: '未登录' });
    return null;
  }
  return payload;
}

function requireAdminRole(req: Request, res: ExpressResponse) {
  const payload = requireAuthPayload(req, res);
  if (!payload) return null;
  if (payload.role !== 'admin') {
    res.status(403).json({
      code: FORBIDDEN_CODE,
      message: '仅管理员可访问系统级 AI 配置',
    });
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

  const err = error as RouteError;
  if (typeof err?.status !== 'number') {
    next(error);
    return;
  }

  if (err.code) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }

  res.status(err.status).json({ message: err.message });
}

export function createAiRouter(
  aiConfigService: AiConfigService,
  options?: { problemCaseService?: ProblemCaseService },
) {
  const router = Router();

  router.get('/config', async (req, res, next) => {
    try {
      if (!requireAdminRole(req, res)) return;
      const config = await aiConfigService.getPublicConfig();
      res.status(200).json(config);
    } catch (error) {
      replyKnownError(error, res, next);
    }
  });

  router.put('/config', async (req, res, next) => {
    try {
      if (!requireAdminRole(req, res)) return;
      const config = await aiConfigService.updateConfig(req.body);
      res.status(200).json(config);
    } catch (error) {
      replyKnownError(error, res, next);
    }
  });

  router.post('/chat', async (req, res, next) => {
    try {
      const auth = requireAuthPayload(req, res);
      if (!auth) return;
      const parsed = chatRequestSchema.parse(req.body);
      const { messages, taskTag, maxOutputTokens, llmLog } = parsed;
      const config = await aiConfigService.getResolvedConfigForChat(auth);

      if (!config.apiKey) {
        res.status(400).json({
          message: 'AI API key is not configured in the system settings.',
        });
        return;
      }

      const envDefault = readDefaultMaxOutputTokensFromEnv();
      const effectiveMaxTokens = resolveEffectiveMaxOutputTokens({
        envDefault,
        taskTag,
        maxOutputTokens,
      });

      const startedAt = Date.now();
      const upstreamTimeoutMs = 300_000;
      const upstreamController = new AbortController();
      const upstreamTimeoutId = setTimeout(() => upstreamController.abort(), upstreamTimeoutMs);
      let response: Response;
      try {
        response = await fetch(config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: 0.7,
            max_tokens: effectiveMaxTokens,
            stream: false,
            ...(upstreamWantsJsonObjectMode(taskTag)
              ? { response_format: { type: 'json_object' as const } }
              : {}),
          }),
          signal: upstreamController.signal,
        });
      } catch (error) {
        clearTimeout(upstreamTimeoutId);
        const err = error as { name?: string; message?: string };
        if (err?.name === 'AbortError') {
          res.status(504).json({
            message: `AI 上游请求超时（已超过 ${upstreamTimeoutMs / 1000} 秒）。请缩小提示或稍后重试。`,
          });
          return;
        }
        const e = error as {
          message?: string;
          cause?: { code?: string; hostname?: string; message?: string };
        };
        const causeCode = e?.cause?.code;
        const causeHost = e?.cause?.hostname;
        const causeMsg = e?.cause?.message || e?.message || 'unknown';
        const netMsg = causeCode
          ? `AI provider request failed (${causeCode}${causeHost ? ` ${causeHost}` : ''}): ${causeMsg}`
          : `AI provider request failed: ${causeMsg}`;
        res.status(502).json({ message: netMsg });
        return;
      }
      clearTimeout(upstreamTimeoutId);

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const parsed = data as { error?: { message?: string } } | null;
        const upstreamMsg =
          parsed?.error?.message != null && String(parsed.error.message).trim() !== ''
            ? String(parsed.error.message)
            : `AI request failed with status ${response.status}`;
        try {
          console.warn('[ai:chat:upstream]', {
            upstreamStatus: response.status,
            message: upstreamMsg,
            model: config.model,
            apiUrl: config.apiUrl,
            configSource: config.source,
          });
        } catch {
          /* ignore */
        }
        // 上游模型商 401（多为用户 API Key 无效）勿映射为 HTTP 401：否则前端会与 JWT 未登录混淆并清 token 跳登录页
        if (response.status === 401) {
          res.status(502).json({
            code: 'AI_UPSTREAM_AUTH_FAILED',
            message: upstreamMsg,
          });
          return;
        }
        res.status(response.status).json({
          message: upstreamMsg,
        });
        return;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        res.status(502).json({
          message: 'No completion received from AI provider.',
        });
        return;
      }

      const rawFinish = data?.choices?.[0]?.finish_reason as string | undefined;
      const usage = data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };
      const { finishReason, truncated } = inferTruncationFromProvider(
        rawFinish,
        usage.completion_tokens,
        effectiveMaxTokens,
      );

      const durationMs = Date.now() - startedAt;
      const resolvedModel = String(data.model || config.model || '');
      if (options?.problemCaseService && llmLog) {
        await options.problemCaseService.recordCaseLlmFromAiChat(auth, {
          caseId: llmLog.caseId,
          taskId: llmLog.taskId,
          callTarget: llmLog.callTarget,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          outputContent: String(content),
          usage: {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
          },
          durationMs,
          model: resolvedModel,
        });
      }

      res.status(200).json({
        content,
        usage,
        model: data.model || config.model,
        durationMs,
        finishReason,
        truncated,
        maxOutputTokens: effectiveMaxTokens,
      });
    } catch (error) {
      replyKnownError(error, res, next);
    }
  });

  return router;
}

export function createMeAiConfigRouter(aiConfigService: AiConfigService) {
  const router = Router();

  router.get('/ai-config/status', async (req, res, next) => {
    try {
      const auth = requireAuthPayload(req, res);
      if (!auth) return;
      const status = await aiConfigService.getMyConfigStatus(auth);
      res.status(200).json(status);
    } catch (error) {
      replyKnownError(error, res, next);
    }
  });

  router.put('/ai-config', async (req, res, next) => {
    try {
      const auth = requireAuthPayload(req, res);
      if (!auth) return;
      const status = await aiConfigService.saveMyConfig(auth, req.body);
      res.status(200).json(status);
    } catch (error) {
      replyKnownError(error, res, next);
    }
  });

  return router;
}
