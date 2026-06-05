/**
 * [INPUT]: 案例 id、线步 id、对齐暂存冲突 `targetFeatureId`
 * [OUTPUT]: 调用 `POST …/mark-task1-validation-resolved` 将任务 1 节点置为 Resolved_By_Customer
 * [POS]: 任务 2–6 / 5.5 / 10 深访问卷提交后、重跑推理前须先 Mutation，否则 Input 2 仍为 Pending
 */

import type { DesignDetailLineTaskId } from './designDetailLineState';
import { readAlignmentPainPointTargetFeatureIds } from './designDetailAlignmentPainTargets';

function isOnlineMode(): boolean {
  return (
    String((window as unknown as { APP_CONFIG?: { MODE?: string } }).APP_CONFIG?.MODE || '').toLowerCase() ===
    'online'
  );
}

export async function markTask1ValidationResolvedByCustomerForAlignment(
  caseId: string,
  targetFeatureIds: readonly string[],
): Promise<{ ok: boolean; updatedCount?: number; message?: string }> {
  const cid = String(caseId || '').trim();
  const ids = [...new Set(targetFeatureIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!cid || !ids.length) return { ok: true, updatedCount: 0 };
  if (!isOnlineMode()) return { ok: true, updatedCount: 0 };

  const postFn = (
    window as unknown as {
      SmartCto?: {
        problemCaseApi?: {
          postDesignDetailMarkTask1ValidationResolved?: (
            id: string,
            body: { targetFeatureIds: string[] },
          ) => Promise<{ ok?: boolean; updatedCount?: number; message?: string; status?: number } | null>;
        };
      };
    }
  ).SmartCto?.problemCaseApi?.postDesignDetailMarkTask1ValidationResolved;

  if (typeof postFn !== 'function') {
    return { ok: false, message: '未加载 postDesignDetailMarkTask1ValidationResolved' };
  }

  const res = await postFn(cid, { targetFeatureIds: ids });
  if (res?.ok === true) {
    try {
      console.warn('[design-detail:mark-validation-resolved]', {
        caseId: cid,
        requested: ids.length,
        updatedCount: res.updatedCount,
      });
    } catch {
      /* ignore */
    }
    return { ok: true, updatedCount: res.updatedCount };
  }
  return {
    ok: false,
    message: typeof res?.message === 'string' ? res.message : '标记 Validation_Status 失败',
  };
}

/** 合并 pending 态与 localStorage 中的对齐冲突 featureId */
export function collectValidationResolvedTargetFeatureIdsForAlignment(
  caseId: string,
  lineTaskId: DesignDetailLineTaskId,
  painPointTargetFeatureIdsFromPending?: readonly string[],
): string[] {
  return [
    ...new Set(
      [
        ...(painPointTargetFeatureIdsFromPending ?? []),
        ...readAlignmentPainPointTargetFeatureIds(caseId, lineTaskId),
      ]
        .map((id) => String(id || '').trim())
        .filter(Boolean),
    ),
  ];
}

/** 深访问卷回复后、本线步重跑 LLM 之前调用 */
export async function markTask1ValidationResolvedForAlignmentLineTask(
  caseId: string,
  lineTaskId: DesignDetailLineTaskId,
  painPointTargetFeatureIdsFromPending?: readonly string[],
): Promise<{ ok: boolean; message?: string; updatedCount?: number }> {
  const ids = collectValidationResolvedTargetFeatureIdsForAlignment(
    caseId,
    lineTaskId,
    painPointTargetFeatureIdsFromPending,
  );
  return markTask1ValidationResolvedByCustomerForAlignment(caseId, ids);
}
