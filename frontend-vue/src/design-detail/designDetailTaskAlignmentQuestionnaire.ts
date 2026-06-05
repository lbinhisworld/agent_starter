/**
 * [INPUT]: `ProblemCase.id`（设计页 `caseId`）
 * [OUTPUT]: 任务 2/3/4/5/5.5/6/7/8/8.5/9/10 对齐**深访问卷**（Agent 展示稿 Markdown + 冲突块）的 `localStorage` 读写
 * [POS]: 与 `useDesignDetailChat` 问卷生成、`POST …/sync-task*-target-kv-tokens` 落库对齐字段 `alignmentQuestionnaire` 对齐
 *
 * [PROTOCOL]: 键名变更时同步 `designDetailTargetKvSyncAlignmentMeta.ts` 与 `clearDesignDetailAlignmentLocalStoresFromAnchor`
 */

const STORAGE_KEY_PREFIX_TASK2 = 'smart_cto_design_detail_task2_l1_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK3 = 'smart_cto_design_detail_task3_l2_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK4 = 'smart_cto_design_detail_task4_l2_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK5 = 'smart_cto_design_detail_task5_l3_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK51 = 'smart_cto_design_detail_task51_l3_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK55 = 'smart_cto_design_detail_task55_l3_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK6 = 'smart_cto_design_detail_task6_l3_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK65 = 'smart_cto_design_detail_task65_l3_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK7 = 'smart_cto_design_detail_task7_l4_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK8 = 'smart_cto_design_detail_task8_l45_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK85 = 'smart_cto_design_detail_task85_l475_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK9 = 'smart_cto_design_detail_task9_l5_alignment_questionnaire_v1:';
const STORAGE_KEY_PREFIX_TASK10 = 'smart_cto_design_detail_task10_l5_alignment_questionnaire_v1:';

type AlignmentQuestionnaireBundle = {
  questionnaireMd: string;
  conflictBlock: string;
};

function parseQuestionnaireStorage(raw: string): AlignmentQuestionnaireBundle {
  const t = String(raw || '').trim();
  if (!t) return { questionnaireMd: '', conflictBlock: '' };
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as Record<string, unknown>;
      return {
        questionnaireMd: String(o.questionnaireMd ?? o.md ?? '').trim(),
        conflictBlock: String(o.conflictBlock ?? o.conflict ?? '').trim(),
      };
    } catch {
      /* 旧版纯 Markdown 字符串 */
    }
  }
  return { questionnaireMd: t, conflictBlock: '' };
}

function serializeQuestionnaireStorage(questionnaireMd: string, conflictBlock?: string): string {
  const md = String(questionnaireMd || '').trim();
  const conflict = String(conflictBlock || '').trim();
  if (!md) return '';
  if (!conflict) return md;
  return JSON.stringify({ questionnaireMd: md, conflictBlock: conflict });
}

function readByPrefix(prefix: string, caseId: string): string {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(prefix + id) || '').trim();
  } catch {
    return '';
  }
}

function readBundleByPrefix(prefix: string, caseId: string): AlignmentQuestionnaireBundle {
  return parseQuestionnaireStorage(readByPrefix(prefix, caseId));
}

function writeByPrefix(prefix: string, caseId: string, text: string, conflictBlock?: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    const t = serializeQuestionnaireStorage(text, conflictBlock);
    if (t) localStorage.setItem(prefix + id, t);
    else localStorage.removeItem(prefix + id);
  } catch {
    /* ignore */
  }
}

function clearByPrefix(prefix: string, caseId: string): void {
  const id = String(caseId || '').trim();
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(prefix + id);
  } catch {
    /* ignore */
  }
}

export function readTask2L1AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK2, caseId).questionnaireMd;
}

export function readTask2L1AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK2, caseId).conflictBlock;
}

export function writeTask2L1AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK2, caseId, text, conflictBlock);
}

export function clearTask2L1AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK2, caseId);
}

export function readTask3L2AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK3, caseId).questionnaireMd;
}

export function readTask3L2AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK3, caseId).conflictBlock;
}

export function writeTask3L2AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK3, caseId, text, conflictBlock);
}

export function clearTask3L2AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK3, caseId);
}

export function readTask4L2AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK4, caseId).questionnaireMd;
}

export function readTask4L2AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK4, caseId).conflictBlock;
}

export function writeTask4L2AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK4, caseId, text, conflictBlock);
}

export function clearTask4L2AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK4, caseId);
}

export function readTask5L3AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK5, caseId).questionnaireMd;
}

export function readTask5L3AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK5, caseId).conflictBlock;
}

export function writeTask5L3AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK5, caseId, text, conflictBlock);
}

export function clearTask5L3AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK5, caseId);
}

export function readTask51L3AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK51, caseId).questionnaireMd;
}

export function readTask51L3AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK51, caseId).conflictBlock;
}

export function writeTask51L3AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK51, caseId, text, conflictBlock);
}

export function clearTask51L3AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK51, caseId);
}

export function readTask55L3AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK55, caseId).questionnaireMd;
}

export function readTask55L3AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK55, caseId).conflictBlock;
}

export function writeTask55L3AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK55, caseId, text, conflictBlock);
}

export function clearTask55L3AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK55, caseId);
}

export function readTask6L3AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK6, caseId).questionnaireMd;
}

export function readTask6L3AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK6, caseId).conflictBlock;
}

export function writeTask6L3AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK6, caseId, text, conflictBlock);
}

export function clearTask6L3AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK6, caseId);
}

export function readTask65L3AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK65, caseId).questionnaireMd;
}

export function readTask65L3AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK65, caseId).conflictBlock;
}

export function writeTask65L3AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK65, caseId, text, conflictBlock);
}

export function clearTask65L3AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK65, caseId);
}

export function readTask7L4AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK7, caseId).questionnaireMd;
}

export function readTask7L4AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK7, caseId).conflictBlock;
}

export function writeTask7L4AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK7, caseId, text, conflictBlock);
}

export function clearTask7L4AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK7, caseId);
}

export function readTask8L45AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK8, caseId).questionnaireMd;
}

export function readTask8L45AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK8, caseId).conflictBlock;
}

export function writeTask8L45AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK8, caseId, text, conflictBlock);
}

export function clearTask8L45AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK8, caseId);
}

export function readTask85L475AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK85, caseId).questionnaireMd;
}

export function readTask85L475AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK85, caseId).conflictBlock;
}

export function writeTask85L475AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK85, caseId, text, conflictBlock);
}

export function clearTask85L475AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK85, caseId);
}

export function readTask9L5AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK9, caseId).questionnaireMd;
}

export function readTask9L5AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK9, caseId).conflictBlock;
}

export function writeTask9L5AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK9, caseId, text, conflictBlock);
}

export function clearTask9L5AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK9, caseId);
}

export function readTask10L5AlignmentQuestionnaireText(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK10, caseId).questionnaireMd;
}

export function readTask10L5AlignmentConflictBlock(caseId: string): string {
  return readBundleByPrefix(STORAGE_KEY_PREFIX_TASK10, caseId).conflictBlock;
}

export function writeTask10L5AlignmentQuestionnaireText(
  caseId: string,
  text: string,
  conflictBlock?: string,
): void {
  writeByPrefix(STORAGE_KEY_PREFIX_TASK10, caseId, text, conflictBlock);
}

export function clearTask10L5AlignmentQuestionnaireText(caseId: string): void {
  clearByPrefix(STORAGE_KEY_PREFIX_TASK10, caseId);
}
