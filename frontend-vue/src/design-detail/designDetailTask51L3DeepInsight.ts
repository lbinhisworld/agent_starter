/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 5.1 L3 深访洞察的浏览器本地持久化
 * [POS]: 与 `buildTask51ValuePropositionInferenceUserBlock` 深访段对齐
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task51_l3_deep_insight_v1:';

export function readTask51L3DeepInsightText(caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_KEY_PREFIX + id) || '').trim();
  } catch {
    return '';
  }
}

export function writeTask51L3DeepInsightText(caseId: string, text: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    const t = String(text || '').trim();
    if (t) localStorage.setItem(STORAGE_KEY_PREFIX + id, t);
    else localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}

export function clearTask51L3DeepInsightText(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
