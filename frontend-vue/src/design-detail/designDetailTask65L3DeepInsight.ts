/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 6.5 L3 **深访洞察** 的浏览器本地持久化（按子任务环节追加）
 * [POS]: 子任务对齐问卷闭环后写入；供 `buildTask65SingleStepItGapInferenceUserBlock` Input 6
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_task65_l3_deep_insight_v1:';

export function readTask65L3DeepInsightText(caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_KEY_PREFIX + id) || '').trim();
  } catch {
    return '';
  }
}

export function appendTask65L3DeepInsightSection(
  caseId: string,
  progressLabel: string,
  text: string,
): void {
  const id = String(caseId || '').trim();
  const sectionLabel = String(progressLabel || '').trim();
  const body = String(text || '').trim();
  if (!id || !sectionLabel || !body || typeof localStorage === 'undefined') return;
  const section = `【${sectionLabel}】\n${body}`;
  const existing = readTask65L3DeepInsightText(id);
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, existing ? `${existing}\n\n${section}` : section);
  } catch {
    /* ignore */
  }
}

export function clearTask65L3DeepInsightText(caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
}
