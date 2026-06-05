/**
 * [INPUT]: PrismaClient
 * [OUTPUT]: 按用户读写工具经验「对话区」JSON 载荷
 * [POS]: `/api/me/tool-experience/chat-state` 服务层
 *
 * [PROTOCOL]: 变更契约时同步 `tool-experience-chat.routes.ts` 与 `frontend/js/api.js` 归一化逻辑
 */
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const toolExpChatMetaSchema = z.object({
  model: z.string().max(500),
  durationMs: z.number(),
  promptTokens: z.number().nullable(),
  completionTokens: z.number().nullable(),
  totalTokens: z.number().nullable(),
});

const toolExpChatMessageSchema = z.object({
  key: z.string().min(1).max(200),
  role: z.enum(['user', 'assistant']),
  content: z.string().max(500_000).optional(),
  parsing: z.boolean().optional(),
  kind: z.enum(['tool-exp-done', 'tool-exp-tree']).optional(),
  meta: toolExpChatMetaSchema.optional(),
});

export const toolExpChatStateSchema = z.object({
  version: z.number().int().default(1),
  messages: z.array(toolExpChatMessageSchema).max(400).default([]),
  inputDraft: z.string().max(100_000).optional(),
});

export type ToolExpChatStatePayload = z.infer<typeof toolExpChatStateSchema>;

export function emptyToolExpChatStatePayload(): ToolExpChatStatePayload {
  return { version: 1, messages: [], inputDraft: '' };
}

/** 去掉解析中占位，避免刷新后卡在「正在解析」 */
export function normalizeToolExpChatStatePayload(raw: unknown): ToolExpChatStatePayload {
  const base =
    raw && typeof raw === 'object'
      ? toolExpChatStateSchema.safeParse(raw)
      : { success: false as const };
  if (!base.success) {
    return emptyToolExpChatStatePayload();
  }
  const messages = base.data.messages.filter((m) => !m.parsing);
  return {
    version: 1,
    messages,
    inputDraft: base.data.inputDraft ?? '',
  };
}

export function parseToolExpChatBody(body: unknown): ToolExpChatStatePayload {
  const raw =
    body && typeof body === 'object' && body !== null && 'payload' in body
      ? (body as { payload: unknown }).payload
      : body;
  return normalizeToolExpChatStatePayload(raw);
}

export class ToolExperienceChatService {
  constructor(private prisma: PrismaClient) {}

  async getPayload(userId: string): Promise<ToolExpChatStatePayload> {
    const row = await this.prisma.toolExperienceChatState.findUnique({
      where: { userId },
    });
    if (!row?.payload) {
      return emptyToolExpChatStatePayload();
    }
    return normalizeToolExpChatStatePayload(row.payload);
  }

  async savePayload(userId: string, payload: ToolExpChatStatePayload): Promise<void> {
    const normalized = normalizeToolExpChatStatePayload(payload);
    await this.prisma.toolExperienceChatState.upsert({
      where: { userId },
      create: {
        userId,
        payload: normalized as object,
      },
      update: {
        payload: normalized as object,
      },
    });
  }
}
