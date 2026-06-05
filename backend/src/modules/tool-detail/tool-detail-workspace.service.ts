/**
 * [INPUT]: PrismaClient
 * [OUTPUT]: 按用户读写工具详情页工作画布（工具知识集 JSON）
 * [POS]: `/api/me/tool-detail/workspace` 服务层
 *
 * [PROTOCOL]: 变更契约时同步 routes 与前端 `tool-detail-knowledge-persist.ts`
 */
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const valueSchema = z.object({
  value: z.string(),
  featureId: z.string().optional(),
});

const groupSchema = z.object({
  featureKey: z.string(),
  values: z.array(valueSchema).default([]),
});

const toolEntrySchema = z.object({
  groups: z.array(groupSchema).default([]),
  summary: z.string().optional(),
});

export const toolDetailWorkspacePayloadSchema = z.object({
  version: z.literal(1).default(1),
  byToolId: z.record(z.string(), toolEntrySchema).default({}),
});

export type ToolDetailWorkspacePayload = z.infer<typeof toolDetailWorkspacePayloadSchema>;

export function emptyToolDetailWorkspacePayload(): ToolDetailWorkspacePayload {
  return { version: 1, byToolId: {} };
}

export function parseToolDetailWorkspaceBody(body: unknown): ToolDetailWorkspacePayload {
  const raw =
    body && typeof body === 'object' && body !== null && 'payload' in body
      ? (body as { payload: unknown }).payload
      : body;
  const parsed = toolDetailWorkspacePayloadSchema.safeParse(raw);
  if (!parsed.success) return emptyToolDetailWorkspacePayload();
  return parsed.data;
}

export class ToolDetailWorkspaceService {
  constructor(private prisma: PrismaClient) {}

  async getPayload(userId: string): Promise<ToolDetailWorkspacePayload> {
    const row = await this.prisma.toolDetailWorkspace.findUnique({
      where: { userId },
    });
    if (!row?.payload) {
      return emptyToolDetailWorkspacePayload();
    }
    return parseToolDetailWorkspaceBody(row.payload);
  }

  async savePayload(userId: string, payload: ToolDetailWorkspacePayload): Promise<void> {
    const normalized = toolDetailWorkspacePayloadSchema.parse(payload);
    await this.prisma.toolDetailWorkspace.upsert({
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
