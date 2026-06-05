/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 3 L2 **Input 3 深访洞察** 的浏览器本地持久化（`localStorage`）
 * [POS]: 设计页任务 3；与 `buildTask3L2InferenceUserBlock` 第 3 段对齐
 *
 * [PROTOCOL]: 仅前端；变更键名或语义时同步 `buildTask3L2InferenceInputFromTaskGraph.ts` 与 `useDesignDetailChat.ts`；**完全重启**时清键
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task3_l2_deep_insight_v1:';

export function readTask3L2DeepInsightText(caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_KEY_PREFIX + id) || '').trim();
  } catch {
    return '';
  }
}

export function writeTask3L2DeepInsightText(caseId: string, text: string): void {
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

export function clearTask3L2DeepInsightText(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
