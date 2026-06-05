/**
 * [INPUT]: `GET …/design-detail/task-graph` 中任务 5.1 与任务 1 的 `features[]`
 * [OUTPUT]: 任务 5.2 按表现有表格循环 **user** 块；**`buildTask52SpreadsheetTableSubtaskList`** 子任务列表
 * [POS]: 设计详情任务 5.2「表格字段功能理解」；与 `designDetailL52AssetFieldSetSystemPrompt.js` 单表 Input 1/2 对齐
 *
 * [PROTOCOL]: 每张表现有表格独立 LLM 调用；Feature_Value＝`表格名称 - 业务能力单元`；5.2/5.3 拾取见 **`isTask52FieldSetGraphFeatureRow`**
 */

export type Task52SpreadsheetTableSubtask = {
  tableName: string;
  /** 仅表级化石、无展开列时保留 */
  tableLevelFeature?: Task2L1TaskGraphFeatureRow;
  columnFeatures: Task2L1TaskGraphFeatureRow[];
};

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { isTask2L1ExistingSpreadsheetFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  isTask51BusinessCapabilityUnitFeatureKey,
  isTask51ValuePropositionFeatureKey,
} from './designDetailLogicTreeTask51Layout';
import {
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
  DESIGN_DETAIL_TASK52_LINE_TASK_ID,
  normLogicTaskId,
  type DesignDetailLogicGraphTaskDto,
} from './designDetailLogicGraphMerge';
import { isTask52FieldSetGraphFeatureRow } from './designDetailLogicTreeTask52Layout';
import { normalizeLogicGraphTasksFromApiPayload } from './designDetailTask2L1SyncUiProgress';

const TASK51_CAPABILITY_UNIT_KEY = '业务能力单元' as const;
const TASK1_SPREADSHEET_TABLE_HEADER_LABEL = '原始数据模型表头' as const;

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
}

function readBusinessFunctionFromFeatureRow(f: Task2L1TaskGraphFeatureRow): string {
  const raw = f.featureValue ?? f.feature_value;
  if (raw == null) return '';
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith('{')) {
      try {
        const v = JSON.parse(s) as unknown;
        obj = v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
      } catch {
        return '';
      }
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return '';
  const bf = obj.business_function ?? obj.businessFunction ?? obj.Business_Function;
  return String(bf ?? '').trim();
}

function formatTask51CapabilityUnitTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  const lines: string[] = [];
  for (const f of features) {
    const id = escapeTsvCell(String(f.featureId ?? ''));
    const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
    const op = escapeTsvCell(String(f.operator ?? ''));
    const val = escapeTsvCell(String(f.name ?? ''));
    const biz = escapeTsvCell(readBusinessFunctionFromFeatureRow(f));
    if (withVs) {
      const vs = escapeTsvCell(String(f.validationStatus ?? '').trim() || 'Pending');
      lines.push(`${id}\t${tok}\t${op}\t${val}\t${biz}\t${vs}`);
    } else {
      lines.push(`${id}\t${tok}\t${op}\t${val}\t${biz}`);
    }
  }
  return lines.join('\n');
}

function formatFeatureTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  const lines: string[] = [];
  for (const f of features) {
    const id = escapeTsvCell(String(f.featureId ?? ''));
    const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
    const op = escapeTsvCell(String(f.operator ?? ''));
    const val = escapeTsvCell(String(f.name ?? ''));
    if (withVs) {
      const vs = escapeTsvCell(String(f.validationStatus ?? '').trim() || 'Pending');
      lines.push(`${id}\t${tok}\t${op}\t${val}\t${vs}`);
    } else {
      lines.push(`${id}\t${tok}\t${op}\t${val}`);
    }
  }
  return lines.join('\n');
}

/** 与逻辑树 `resolveTask5LogicTreeFeatureKey` 一致：token 首段优先，避免 task-graph `themeKey=task_misc` 误判 */
function resolveTask51FeatureKeyFromGraphRow(f: Task2L1TaskGraphFeatureRow): string {
  const tok = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  const head = tok && tok !== '—' ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : '';
  if (head) {
    if (head === TASK51_CAPABILITY_UNIT_KEY || head.startsWith(`${TASK51_CAPABILITY_UNIT_KEY}/`)) {
      return TASK51_CAPABILITY_UNIT_KEY;
    }
    if (head === '核心价值主张' || head === '交付模式定性') return head;
    return head;
  }
  const theme = String(f.themeKey ?? f.theme_key ?? '').trim();
  if (theme && theme !== 'task_misc') return theme;
  const nm = String(f.name ?? '').trim();
  return nm;
}

function isTask51CapabilityUnitGraphRow(f: Task2L1TaskGraphFeatureRow): boolean {
  const key = resolveTask51FeatureKeyFromGraphRow(f);
  if (isTask51ValuePropositionFeatureKey(key)) return false;
  if (isTask51BusinessCapabilityUnitFeatureKey(key)) return true;
  // token 缺失时：5.1 能力单元行通常带 business_function
  return readBusinessFunctionFromFeatureRow(f).length > 0;
}

function readExistingSpreadsheetHeaderListFromRow(f: Task2L1TaskGraphFeatureRow): string[] {
  const raw = f.featureValue ?? f.feature_value;
  if (raw != null) {
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (s.length) return splitSpreadsheetColumnHeaders(s);
    } else if (typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      const nested = o.Feature_Value ?? o.feature_value ?? o.value ?? o.content;
      if (typeof nested === 'string' && nested.trim()) {
        return splitSpreadsheetColumnHeaders(nested.trim());
      }
    }
  }
  const nm = String(f.name ?? '').trim();
  if (nm && nm !== TASK1_SPREADSHEET_TABLE_HEADER_LABEL) {
    return splitSpreadsheetColumnHeaders(nm);
  }
  return [];
}

function splitSpreadsheetColumnHeaders(raw: string): string[] {
  return String(raw ?? '')
    .split(/[,，、;；\n]/)
    .map((h) => h.trim())
    .filter(Boolean);
}

function existingSpreadsheetTokenHead(f: Task2L1TaskGraphFeatureRow): string {
  const raw = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  if (!raw || raw === '—') return '';
  return raw.includes('·') ? (raw.split(/\s*·\s*/)[0]?.trim() ?? raw) : raw;
}

/** 任务 1 表级化石 `现有表格/{表名}` → 按 value/表头串展开为 `现有表格/{表名}.{列名}` 送模行 */
export function expandTask1ExistingSpreadsheetFeaturesForTask52Inference(
  features: Task2L1TaskGraphFeatureRow[],
): Task2L1TaskGraphFeatureRow[] {
  const out: Task2L1TaskGraphFeatureRow[] = [];
  for (const f of features) {
    const head = existingSpreadsheetTokenHead(f);
    if (!head.startsWith('现有表格/')) {
      out.push(f);
      continue;
    }
    const pathAfter = head.slice('现有表格/'.length);
    if (pathAfter.includes('.')) {
      out.push(f);
      continue;
    }
    const columns = readExistingSpreadsheetHeaderListFromRow(f);
    if (!columns.length) {
      out.push(f);
      continue;
    }
    for (const col of columns) {
      out.push({
        ...f,
        tokenDisplay: `${head}.${col}`,
        name: col,
      });
    }
  }
  return out;
}

/** 自推理图任务卡提取任务 5.2「业务能力字段集」特征行（含 fields_schema_tree 须 featureValue） */
export function pickTask52FieldSetFeaturesFromGraphTasks(
  tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const merged = normalizeLogicGraphTasksFromApiPayload(tasks as DesignDetailLogicGraphTaskDto[]);
  const out: Task2L1TaskGraphFeatureRow[] = [];
  const seen = new Set<string>();

  const pushRow = (f: Task2L1TaskGraphFeatureRow) => {
    if (!isTask52FieldSetGraphFeatureRow(f)) return;
    const id = String(f.featureId ?? '').trim();
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    out.push(f);
  };

  for (const t of merged) {
    if (normLogicTaskId(t.taskId) !== DESIGN_DETAIL_TASK52_LINE_TASK_ID) continue;
    for (const f of t.features ?? []) {
      pushRow(f);
    }
  }

  /** 5.2 特征偶发仍挂在中文落库 taskId 卡、未并入线步卡时，从全图兜底拾取 */
  if (!out.length) {
    for (const t of merged) {
      const norm = normLogicTaskId(t.taskId);
      if (norm === DESIGN_DETAIL_TASK51_LINE_TASK_ID) continue;
      for (const f of t.features ?? []) {
        pushRow(f);
      }
    }
  }

  return out;
}

/** 自推理图任务卡提取任务 5.1「业务能力单元」特征行（含 business_function） */
export function pickTask51FeaturesFromGraphTasks(
  tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const merged = normalizeLogicGraphTasksFromApiPayload(tasks as DesignDetailLogicGraphTaskDto[]);
  const t51 = merged.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK51_LINE_TASK_ID);
  const feats = Array.isArray(t51?.features) ? t51.features : [];
  return feats.filter(isTask51CapabilityUnitGraphRow);
}

/** 任务 1 特征：仅保留 `现有表格/` 分域 */
export function pickTask1ExistingSpreadsheetFeatures(
  task1Features: Task2L1TaskGraphFeatureRow[],
): Task2L1TaskGraphFeatureRow[] {
  return task1Features.filter((f) => isTask2L1ExistingSpreadsheetFeatureRow(f));
}

/** 扫描任务 1 现有表格节点，按表名聚合为理解子任务列表 */
export function buildTask52SpreadsheetTableSubtaskList(
  expandedTask1SpreadsheetFeatures: Task2L1TaskGraphFeatureRow[],
): Task52SpreadsheetTableSubtask[] {
  const byTable = new Map<string, Task52SpreadsheetTableSubtask>();
  for (const f of expandedTask1SpreadsheetFeatures) {
    const head = existingSpreadsheetTokenHead(f);
    if (!head.startsWith('现有表格/')) continue;
    const pathAfter = head.slice('现有表格/'.length);
    const dot = pathAfter.indexOf('.');
    const tableName = (dot >= 0 ? pathAfter.slice(0, dot) : pathAfter).trim();
    if (!tableName) continue;
    let entry = byTable.get(tableName);
    if (!entry) {
      entry = { tableName, columnFeatures: [] };
      byTable.set(tableName, entry);
    }
    if (dot >= 0) {
      entry.columnFeatures.push(f);
    } else {
      entry.tableLevelFeature = f;
    }
  }
  return [...byTable.values()].sort((a, b) =>
    a.tableName.localeCompare(b.tableName, 'zh-CN'),
  );
}

/** 进度区子任务行文案（与 LLM callTarget 前缀一致） */
export function task52TableUnderstandingProgressLine(tableName: string): string {
  return `→ 功能理解：${String(tableName ?? '').trim() || '（未命名表）'}`;
}

/** 单表现有表格循环工位 user 块 */
export function buildTask52SingleTableInferenceUserBlock(
  task51Features: Task2L1TaskGraphFeatureRow[],
  subtask: Task52SpreadsheetTableSubtask,
): string {
  const input2Rows: Task2L1TaskGraphFeatureRow[] = subtask.columnFeatures.length
    ? [...subtask.columnFeatures]
    : subtask.tableLevelFeature
      ? [subtask.tableLevelFeature]
      : [];

  const colHint51 = task51Features.some((f) => String(f.validationStatus ?? '').trim())
    ? '六列：FeatureID、TokenStr、Operator、Value、business_function、Validation_Status'
    : '五列：FeatureID、TokenStr、Operator、Value、business_function';
  const colHint1 = input2Rows.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
    : '四列：FeatureID、TokenStr、Operator、Value';

  return `【任务 5.2 表格字段功能理解｜当前循环表：${subtask.tableName}｜GET /design-detail/task-graph】
说明：下列每一行为一条特征，以制表符（Tab）分隔。本工位仅处理下表一张物理 Excel 及其原子列。

Input 1：★【任务 5.1 级联产出的「业务能力单元」结构化 Feature 列表全集】（${colHint51}）：
${formatTask51CapabilityUnitTsvLines(task51Features)}

Input 2：★【当前唯一一张现有表格及其字段特征子集（TokenStr 形如 现有表格/${subtask.tableName} 或 现有表格/${subtask.tableName}.{列名}）】（${colHint1}）：
${formatFeatureTsvLines(input2Rows)}`;
}

/** @deprecated 整批送模已改为按表循环；保留类型兼容 */
export function buildTask52AssetFieldSetInferenceUserBlock(
  task51Features: Task2L1TaskGraphFeatureRow[],
  task1SpreadsheetFeatures: Task2L1TaskGraphFeatureRow[],
): string {
  const subtasks = buildTask52SpreadsheetTableSubtaskList(task1SpreadsheetFeatures);
  const first = subtasks[0];
  if (!first) {
    return buildTask52SingleTableInferenceUserBlock(task51Features, {
      tableName: '（无现有表格）',
      columnFeatures: [],
    });
  }
  return buildTask52SingleTableInferenceUserBlock(task51Features, first);
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask52L3DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
