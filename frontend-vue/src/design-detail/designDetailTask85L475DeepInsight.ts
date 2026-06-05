/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 8.5 L4.7 **Input 4 深访洞察** 的浏览器本地持久化
 * [POS]: 与 `buildTask85PhysicalHookInferenceUserBlock` Input 4 段对齐
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task85_l475_deep_insight_v1:';

export function readTask85L475DeepInsightText(caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_KEY_PREFIX + id) || '').trim();
  } catch {
    return '';
  }
}

export function writeTask85L475DeepInsightText(caseId: string, text: string): void {
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

export function clearTask85L475DeepInsightText(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
