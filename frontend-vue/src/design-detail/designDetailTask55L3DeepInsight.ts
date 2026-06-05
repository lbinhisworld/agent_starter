/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 5.5 L3.5 **深访洞察** 的浏览器本地持久化（`localStorage`）
 * [POS]: 设计页任务 5.5 对齐问卷深访（主推理 user 块已仅 Input 1）
 *
 * [PROTOCOL]: 仅前端；变更键名或语义时同步 `useDesignDetailChat.ts`；**完全重启**或锚点≥5.5 时由 `clearDesignDetailAlignmentLocalStoresFromAnchor` 清键
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task55_l3_deep_insight_v1:';

export function readTask55L3DeepInsightText(caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_KEY_PREFIX + id) || '').trim();
  } catch {
    return '';
  }
}

export function writeTask55L3DeepInsightText(caseId: string, text: string): void {
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

export function clearTask55L3DeepInsightText(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
