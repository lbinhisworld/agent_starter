/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 2 L1 **Input 5 深访洞察** 的浏览器本地持久化（`localStorage`）
 * [POS]: 设计页任务 2；与 `buildTask2L1InferenceUserBlock` **Input 3** 深访段对齐
 *
 * [PROTOCOL]: 仅前端；变更键名或语义时同步 `buildTask2L1InferenceInputFromTaskGraph.ts` 与 `useDesignDetailChat.ts`；**完全重启**或**按锚点重启（任务 2 及之后）**时由 `clearDesignDetailAlignmentLocalStoresFromAnchor` 清键
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task2_l1_deep_insight_v1:';

export function readTask2L1DeepInsightText(caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_KEY_PREFIX + id) || '').trim();
  } catch {
    return '';
  }
}

export function writeTask2L1DeepInsightText(caseId: string, text: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    const t = String(text || '').trim();
    if (t) localStorage.setItem(STORAGE_KEY_PREFIX + id, t);
    else localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearTask2L1DeepInsightText(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
