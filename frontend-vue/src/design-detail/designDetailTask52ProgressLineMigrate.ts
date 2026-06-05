/**
 * [INPUT]: 任务 5.2 动态卡历史进度行 `full` 文案
 * [OUTPUT]: 迁移为「表格字段功能理解」口径；供工作区 hydrate 与 kickoff 判定
 * [POS]: 更名前持久化的进度行仍带 L3.2/存量 Excel 文案时，刷新页面后展示与门闩一致
 *
 * [PROTOCOL]: 与 `runTask52AssetFieldSetPipeline.ts` 进度常量保持语义一致
 */

import { task52TableUnderstandingProgressLine } from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';

/** 与 `runTask52AssetFieldSetPipeline` 中 TASK52_START_LINE 一致 */
export const TASK52_PROGRESS_START_LINE =
  '→ 开始进行表格字段功能理解（按任务 1 现有表格逐表推理）';

const LEGACY_TASK52_PILL = '任务 5.2：存量 Excel 资产与业务能力字段集层次映射';
const NEW_TASK52_PILL = '任务 5.2：表格字段功能理解';

/** 去掉行尾重复的 ✅ 等后缀，保留「→ 功能理解：表名」主文案 */
export function stripTask52TableProgressLineDecorations(full: string): string {
  return String(full ?? '')
    .replace(/\s*✅\s*$/u, '')
    .replace(/\s*✔️?\s*$/u, '')
    .trim();
}

export function isTask52TableProgressLineForTable(full: string, tableName: string): boolean {
  const prefix = task52TableUnderstandingProgressLine(tableName);
  const bare = stripTask52TableProgressLineDecorations(full);
  return bare === prefix || bare.startsWith(`${prefix} `);
}

/** 将更名前的进度行文案迁移为新口径；无法映射的旧「整批 LLM 转圈」行返回空串（调用方应剔除） */
export function migrateTask52ProgressLineFull(full: string): string {
  let s = stripTask52TableProgressLineDecorations(full);
  if (!s) return s;
  if (s.includes(LEGACY_TASK52_PILL)) {
    s = s.split(LEGACY_TASK52_PILL).join(NEW_TASK52_PILL);
  }
  if (s.includes('→ 开始进行 L3.2 存量 Excel 资产与业务能力字段集层次映射推理')) {
    return TASK52_PROGRESS_START_LINE;
  }
  if (
    s.includes('→ 正在进行 L3.2 存量 Excel 字段集层次映射推理') ||
    s === '→ 正在进行 L3.2 存量 Excel 字段集层次映射推理（大模型，最长约 5 分钟）'
  ) {
    return '';
  }
  if (s.startsWith('→ 功能理解：')) {
    return stripTask52TableProgressLineDecorations(s);
  }
  return s;
}

/** 是否已进入 5.2 流水线（含历史 L3.2 口径） */
export function task52ProgressIndicatesPipelineKickoff(full: string): boolean {
  const s = String(full ?? '');
  return (
    s.includes(TASK52_PROGRESS_START_LINE) ||
    s.includes('开始进行表格字段功能理解') ||
    s.includes('功能理解：') ||
    s.includes('开始进行 L3.2') ||
    s.includes('正在进行 L3.2') ||
    s.includes('任务 5.2 Target_KV') ||
    s.includes('任务 5.2 推理') ||
    s.includes('全部表格理解完成')
  );
}

