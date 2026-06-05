/**
 * [INPUT]: Prisma 事务、`caseId`、源特征 id 列表
 * [OUTPUT]: 删除 **任务 N 特征 → 任务 1 特征** 的 **`REVERSE_VALIDATION`** 边（对齐前重跑 TVM 时避免遗留「潜在冲突」）
 * [POS]: `replaceTask2L1TargetKvFeatureKeyTokens` / `replaceTask3L2TargetKvFeatureKeyTokens` / `replaceTask4L2TargetKvFeatureKeyTokens` 写入 TVM 前
 *
 * [PROTOCOL]: 与 `design-detail-logic-link-kind.ts` 任务 1 taskId 集合一致；变更时同步 `prisma-problem-case.repository.ts` 与 `docs/agents/backend/01-context.md`
 */
import type { Prisma } from '@prisma/client';
import { DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID } from './design-detail-customer-req-section-graph';
import { DESIGN_DETAIL_TASK1_LINE_TASK_ID } from './design-detail-task1-basic-graph';
import { DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID } from './design-detail-task-graph-catalog';

const TASK1_TOKEN_TASK_IDS_FOR_RV = [
  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK1_LINE_TASK_ID,
  DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID,
  'customer_basic',
  'customer_requirement',
] as const;

/**
 * 在写入新一轮 `Token_Validation_Mapping` 前，清掉指定源特征指向任务 1 的反向验证边（同端点对仅保留当次 sync 结果）。
 */
export async function replaceReverseValidationLinksFromSourcesToTask1(
  tx: Prisma.TransactionClient,
  caseId: string,
  sourceFeatureIds: readonly string[],
): Promise<number> {
  const cid = String(caseId || '').trim();
  const sources = [...new Set(sourceFeatureIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!cid || !sources.length) return 0;

  const task1Nodes = await tx.designFeatureNode.findMany({
    where: {
      tokenRow: {
        caseId: cid,
        taskId: { in: [...TASK1_TOKEN_TASK_IDS_FOR_RV] },
      },
    },
    select: { featureId: true },
  });
  const task1Ids = task1Nodes.map((n) => n.featureId);
  if (!task1Ids.length) return 0;

  const res = await tx.designLogicLink.deleteMany({
    where: {
      linkKind: 'REVERSE_VALIDATION',
      sourceFeatureId: { in: sources },
      targetFeatureId: { in: task1Ids },
    },
  });
  return res.count;
}
