/**
 * [INPUT]: 单表 LLM 原始 JSON、`capability_field_set_mapping` 动态卡进度行
 * [OUTPUT]: 表子任务子进度文案；`buildTask52TableSubtaskProgressEntries`（使用模式不含 JSON）
 * [POS]: 任务 5.2 按表「功能理解」子任务下的大模型 JSON（仅调试）与字段集提炼进度
 *
 * [PROTOCOL]: 与 `runTask52AssetFieldSetPipeline.ts`、`designDetailTask52ProgressLineMigrate.ts` 同步
 */

import { truncateTask52L3DebugProgressText } from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';
import {
  isTask52TableProgressLineForTable,
  stripTask52TableProgressLineDecorations,
} from './designDetailTask52ProgressLineMigrate';
import { normalizeL52AssetMappingRawForServerSync } from './designDetailTask2L1SyncUiProgress';

/** 调试模式：表子任务下「大模型返回」箭头行 */
export const TASK52_DEBUG_LLM_JSON_ARROW_LINE = '→ 大模型返回 json';

export type Task52TableFieldSetProgressItem = {
  fieldSetName: string;
  causalitySummary: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readCausalitySummary(row: Record<string, unknown>): string {
  const raw =
    row.causality_summary ??
    row.Causality_Summary ??
    row.causalitySummary ??
    '';
  return String(raw ?? '').trim();
}

function isTask52BusinessFieldSetKvRow(row: Record<string, unknown>): boolean {
  const key = String(row.Feature_Key ?? row.feature_key ?? row.featureKey ?? '').trim();
  return key === '业务能力字段集' || key.includes('业务能力字段集');
}

/** 自单表模型输出解析字段集名称与 causality_summary（仅 Feature_Key=业务能力字段集） */
export function parseTask52TableFieldSetsFromLlmRaw(tableRaw: string): Task52TableFieldSetProgressItem[] {
  const norm = normalizeL52AssetMappingRawForServerSync(tableRaw);
  if (!norm.ok) return [];
  let matrix: Record<string, unknown>;
  try {
    const root = JSON.parse(norm.normalized) as Record<string, unknown>;
    matrix = asRecord(root.L3_Asset_Mapping_Matrix) ?? {};
  } catch {
    return [];
  }
  const tk = matrix.Target_KV ?? matrix.target_kv;
  if (!Array.isArray(tk)) return [];
  const out: Task52TableFieldSetProgressItem[] = [];
  for (const item of tk) {
    const row = asRecord(item);
    if (!row || !isTask52BusinessFieldSetKvRow(row)) continue;
    const fieldSetName = String(row.Feature_Value ?? row.feature_value ?? row.featureValue ?? '').trim();
    if (!fieldSetName) continue;
    out.push({
      fieldSetName,
      causalitySummary: readCausalitySummary(row),
    });
  }
  return out;
}

export function task52FieldSetExtractProgressLine(fieldSetName: string): string {
  return `→ 提炼字段集：${String(fieldSetName ?? '').trim() || '（未命名字段集）'}`;
}

/** 进度行正文中「逻辑理解」标签（与 `task52FieldSetLogicProgressLine` 一致） */
export const TASK52_LOGIC_PROGRESS_LABEL = '逻辑理解：';

export function task52FieldSetLogicProgressLine(causalitySummary: string): string {
  const body = String(causalitySummary ?? '').trim() || '（无）';
  return `→ ${TASK52_LOGIC_PROGRESS_LABEL}${body}`;
}

/** 自已揭示的进度行文案取出逻辑理解正文（不含「逻辑理解：」前缀） */
export function task52LogicUnderstandingBodyFromProgressText(text: string): string {
  const t = String(text ?? '');
  const body = t.startsWith('→') ? t.slice(1).trimStart() : t.trim();
  if (body.startsWith(TASK52_LOGIC_PROGRESS_LABEL)) {
    return body.slice(TASK52_LOGIC_PROGRESS_LABEL.length);
  }
  return body;
}

/** 表子任务下「大模型返回 json」箭头行或 JSON 灰块（使用模式须隐藏） */
export function isTask52TableLlmJsonProgressLine(full: string, kind?: string | null): boolean {
  const k = String(kind ?? '').trim();
  if (k === 'task52_inference_sub') return true;
  const bare = stripTask52TableProgressLineDecorations(full);
  return bare === TASK52_DEBUG_LLM_JSON_ARROW_LINE;
}

/** 是否属于某表「功能理解」子任务下的子进度行（含 JSON 与字段集提炼） */
export function isTask52TableSubtaskDebugChildLine(full: string, kind?: string | null): boolean {
  if (isTask52TableLlmJsonProgressLine(full, kind)) return true;
  const k = String(kind ?? '').trim();
  if (k === 'task52_logic_understanding') return true;
  const bare = stripTask52TableProgressLineDecorations(full);
  if (bare.startsWith('→ 提炼字段集：')) return true;
  if (bare.startsWith('→ 逻辑理解：')) return true;
  return false;
}

/** 在对应「→ 功能理解：表名」行之后、下一张表子任务行之前的 splice 插入位置 */
export function findTask52TableSubtaskBlockEndIndex(
  lines: Array<{ full?: string | null; kind?: string | null }>,
  tableName: string,
): number {
  let tableIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isTask52TableProgressLineForTable(String(lines[i]?.full ?? ''), tableName)) {
      tableIdx = i;
      break;
    }
  }
  if (tableIdx < 0) return -1;
  let end = tableIdx + 1;
  while (end < lines.length) {
    const full = String(lines[end]?.full ?? '');
    const kind = lines[end]?.kind;
    if (full.startsWith('→ 功能理解：') && !isTask52TableProgressLineForTable(full, tableName)) {
      break;
    }
    if (isTask52TableSubtaskDebugChildLine(full, kind)) {
      end++;
      continue;
    }
    break;
  }
  return end;
}

export type Task52TableDebugProgressEntry = {
  full: string;
  kind: 'default' | 'task52_inference_sub' | 'scope_green' | 'task52_logic_understanding';
  startFullyRevealed?: boolean;
};

export type BuildTask52TableSubtaskProgressOpts = {
  /** 为 false 时不推送「→ 大模型返回 json」与 `task52_inference_sub` 灰块（使用模式） */
  includeLlmJson?: boolean;
};

function appendTask52FieldSetSubtaskProgressEntries(
  entries: Task52TableDebugProgressEntry[],
  tableRaw: string,
): void {
  for (const fs of parseTask52TableFieldSetsFromLlmRaw(tableRaw)) {
    entries.push({
      full: task52FieldSetExtractProgressLine(fs.fieldSetName),
      kind: 'scope_green',
      startFullyRevealed: true,
    });
    entries.push({
      full: task52FieldSetLogicProgressLine(fs.causalitySummary),
      kind: 'task52_logic_understanding',
      startFullyRevealed: true,
    });
  }
}

/** 单表 LLM 返回后的子进度行序列；`includeLlmJson: false` 时仅字段集提炼/逻辑理解 */
export function buildTask52TableSubtaskProgressEntries(
  tableRaw: string,
  opts?: BuildTask52TableSubtaskProgressOpts,
): Task52TableDebugProgressEntry[] {
  const includeLlmJson = opts?.includeLlmJson !== false;
  const entries: Task52TableDebugProgressEntry[] = [];
  if (includeLlmJson) {
    entries.push(
      { full: TASK52_DEBUG_LLM_JSON_ARROW_LINE, kind: 'default', startFullyRevealed: true },
      {
        full: truncateTask52L3DebugProgressText(String(tableRaw ?? '').trim() || '（无）'),
        kind: 'task52_inference_sub',
        startFullyRevealed: true,
      },
    );
  }
  appendTask52FieldSetSubtaskProgressEntries(entries, tableRaw);
  return entries;
}

/** @deprecated 使用 `buildTask52TableSubtaskProgressEntries` */
export function buildTask52TableDebugProgressEntries(tableRaw: string): Task52TableDebugProgressEntry[] {
  return buildTask52TableSubtaskProgressEntries(tableRaw, { includeLlmJson: true });
}
