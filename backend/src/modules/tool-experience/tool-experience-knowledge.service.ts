/**
 * [INPUT]: PrismaClient
 * [OUTPUT]: 按用户读写工具经验「知识树」JSON 载荷
 * [POS]: `/api/me/tool-experience/knowledge-tree` 服务层
 *
 * [PROTOCOL]: 变更契约时同步 `tool-experience-knowledge.routes.ts` 与 `frontend` 合并逻辑
 */
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export const toolExpKnowledgePayloadSchema = z.object({
  version: z.number().int().optional(),
  productEntries: z.array(z.unknown()).default([]),
  comparisonEntries: z.array(z.unknown()).default([]),
  scenarioEntries: z.array(z.unknown()).default([]),
});

export type ToolExpKnowledgePayload = z.infer<typeof toolExpKnowledgePayloadSchema>;

export function emptyToolExpKnowledgePayload(): ToolExpKnowledgePayload {
  return {
    version: 1,
    productEntries: [],
    comparisonEntries: [],
    scenarioEntries: [],
  };
}

export function parseToolExpKnowledgeBody(body: unknown): ToolExpKnowledgePayload {
  const raw =
    body && typeof body === 'object' && body !== null && 'payload' in body
      ? (body as { payload: unknown }).payload
      : body;
  return toolExpKnowledgePayloadSchema.parse(raw);
}

export class ToolExperienceKnowledgeService {
  constructor(private prisma: PrismaClient) {}

  async getPayload(userId: string): Promise<ToolExpKnowledgePayload> {
    const row = await this.prisma.toolExperienceKnowledgeTree.findUnique({
      where: { userId },
    });
    if (!row?.payload) {
      return emptyToolExpKnowledgePayload();
    }
    try {
      return toolExpKnowledgePayloadSchema.parse(row.payload);
    } catch {
      return emptyToolExpKnowledgePayload();
    }
  }

  async savePayload(userId: string, payload: ToolExpKnowledgePayload): Promise<void> {
    const normalized = toolExpKnowledgePayloadSchema.parse(payload);
    await this.prisma.toolExperienceKnowledgeTree.upsert({
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
