/**
 * [INPUT]: 推理图任务 7 协作节点、任务 1 全集、任务 1~4 基本面
 * [OUTPUT]: 任务 8 L4.5 角色/对象/STM 大模型 user 块
 * [POS]: `runTask8L45PrototypePipeline` 拼装 LLM 输入
 *
 * [PROTOCOL]: 与 `designDetailL4PrototypeSystemPrompt.js` Input 1–3 对齐；Input 1 含 **Validation_Status** + **Predecessor_Value**；TVM **Target_FeatureID** 仅来自 Input 2 第一列
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK7_LINE_TASK_ID,
} from './designDetailLogicGraphMerge';

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
}

function tokenKeyOne(tokenDisplay: string): string {
  const td = String(tokenDisplay ?? '').trim();
  const parts = td.split(/\s*[\u00B7\u30FB]\s*/);
  return parts[0]?.trim() || td;
}

export function formatFeatureTsvLines(
  features: Task2L1TaskGraphFeatureRow[],
  legacyConsistencyByFeatureId?: ReadonlyMap<string, string>,
): string {
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
      const consRaw = id && legacyConsistencyByFeatureId?.get(id);
      const cons = consRaw ? escapeTsvCell(consRaw) : '（未标注）';
      lines.push(`${id}\t${tok}\t${op}\t${val}\t${cons}`);
    }
  }
  return lines.join('\n');
}

/** 从落库特征行尽力还原 Predecessor_Value（供 STM 咬合） */
function extractTask7PredecessorHint(f: Task2L1TaskGraphFeatureRow): string {
  const summ = String((f as { inferenceSummary?: string }).inferenceSummary ?? '').trim();
  if (/START/i.test(summ)) return 'START';
  const logic = String((f as { logicRule?: string }).logicRule ?? '').trim();
  const m = logic.match(/Predecessor_Value[：:]\s*([^；;。\n]+)/i);
  if (m?.[1]) return m[1].trim();
  const m2 = summ.match(/前置[^：:]*[：:]\s*([^；;。\n]+)/);
  if (m2?.[1]) return m2[1].trim();
  return '';
}

function task7CollaborationDisplayValue(f: Task2L1TaskGraphFeatureRow): string {
  const name = String(f.name ?? '').trim();
  if (name.startsWith('{')) {
    try {
      const parsed = JSON.parse(name) as Record<string, unknown>;
      const step = String(parsed.current_process_step_name ?? parsed.Current_Process_Step_Name ?? '').trim();
      if (step) return step;
    } catch {
      /* legacy */
    }
  }
  return name;
}

function formatTask7CollaborationTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  return features
    .map((f) => {
      const id = escapeTsvCell(String(f.featureId ?? ''));
      const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
      const op = escapeTsvCell(String(f.operator ?? ''));
      const val = escapeTsvCell(task7CollaborationDisplayValue(f));
      const pred = escapeTsvCell(extractTask7PredecessorHint(f));
      if (withVs) {
        const vs = escapeTsvCell(String(f.validationStatus ?? '').trim() || 'Pending');
        return `${id}\t${tok}\t${op}\t${val}\t${pred}\t${vs}`;
      }
      return `${id}\t${tok}\t${op}\t${val}\t${pred}`;
    })
    .join('\n');
}

/** 任务 7：`所属业务流程` / `协作节点` */
export function pickTask7L4CollaborationFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t7 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === DESIGN_DETAIL_TASK7_LINE_TASK_ID || id.includes('任务 7') || id.includes('协作节点');
  });
  const feats = Array.isArray(t7?.features) ? t7.features : [];
  return feats.filter((f) => {
    const k = tokenKeyOne(String(f.tokenDisplay ?? ''));
    return k === '所属业务流程' || k === '协作节点';
  });
}

/** 任务 8 Input 1：仅「协作节点」行（含 Predecessor_Value） */
export function pickTask7CollaborationNodesOnlyFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  return pickTask7L4CollaborationFeaturesFromGraphTasks(tasks).filter(
    (f) => tokenKeyOne(String(f.tokenDisplay ?? '')) === '协作节点',
  );
}

/** 任务 1~4 线步特征（Input 3 全局商业基因） */
export function pickTask1Through4FeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const out: Task2L1TaskGraphFeatureRow[] = [];
  const lineIds = new Set([
    'customer_basic',
    DESIGN_DETAIL_TASK2_LINE_TASK_ID,
    DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
    DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY,
    DESIGN_DETAIL_TASK3_LINE_TASK_ID,
    DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
    DESIGN_DETAIL_TASK4_LINE_TASK_ID,
    DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
    DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY,
  ]);
  for (const t of tasks) {
    const id = String(t?.taskId || '').trim();
    if (!lineIds.has(id) && !id.includes('任务 2') && !id.includes('任务 3') && !id.includes('任务 4')) {
      if (id !== 'customer_basic' && !id.includes('客户基本情况')) continue;
    }
    if (id.includes('任务 5') || id.includes('任务 6') || id.includes('任务 7')) continue;
    const feats = Array.isArray(t?.features) ? t.features : [];
    out.push(...feats);
  }
  return out;
}

/** @deprecated 任务 8 Input 3 现用任务 1~4；保留别名 */
export function pickTask1Through3FeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  return pickTask1Through4FeaturesFromGraphTasks(tasks);
}

/** 任务 1 全集（Input 2 数据化石底座） */
export function pickTask1FeaturesFromGraphTasksForTask8(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t1 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === 'customer_basic' || id.includes('客户基本情况');
  });
  return Array.isArray(t1?.features) ? t1.features : [];
}

export function buildTask8L45PrototypeInferenceUserBlock(
  task7L4Features: Task2L1TaskGraphFeatureRow[],
  task1Features: Task2L1TaskGraphFeatureRow[],
  task1Through4Features: Task2L1TaskGraphFeatureRow[],
  deepInsightText?: string,
  userRectificationText?: string,
  upstreamConsistencyByTask1FeatureId?: ReadonlyMap<string, string>,
): string {
  const insightRaw = String(deepInsightText ?? '').replace(/\r\n/g, '\n').trim();
  const insightBody = insightRaw || '（暂无）';
  const rectRaw = String(userRectificationText ?? '').replace(/\r\n/g, '\n').trim();
  const rectBody = rectRaw || '（暂无）';
  const input1ColHint = task7L4Features.some((f) => String(f.validationStatus ?? '').trim())
    ? '六列：FeatureID、TokenStr、Operator、Value、Predecessor_Value、Validation_Status（所属业务流程行 Predecessor 可留空）'
    : '五列：FeatureID、TokenStr、Operator、Value、Predecessor_Value';
  const input2ColHint =
    task1Features.some((f) => String(f.validationStatus ?? '').trim()) ||
    upstreamConsistencyByTask1FeatureId?.size
      ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
      : '四列：FeatureID、TokenStr、Operator、Value';

  return `【任务 8 L4.5 角色、对象与状态转移矩阵推理输入｜来自设计详情推理图 GET /design-detail/task-graph】
说明：Input 1 ${input1ColHint}。须对全部「协作节点」穷举设计；每个协作节点 FeatureID 须在 Target_KV 的 Evidence_Support_Chain 中至少引用一次。Input 2 ${input2ColHint}；**Token_Validation_Mapping.Target_FeatureID 仅能取自 Input 2 第一列**。Target_KV 仅允许 Feature_Key 为「操作角色」「单据对象」「状态转移矩阵」。

Input 1：任务 7 协作节点（全量血缘遍历边界；Value 为环节名或结构化 JSON 中的 current_process_step_name）：
${formatTask7CollaborationTsvLines(task7L4Features)}

Input 2：★【任务 1 节点 Feature 列表全集】（含「现有表格/」表头化石字段；TVM 源头）：
${formatFeatureTsvLines(task1Features, upstreamConsistencyByTask1FeatureId)}

Input 3：任务 1~4 全局商业基本面基因特征（合规约束等级、管控复杂度等）：
${formatFeatureTsvLines(task1Through4Features)}

Input 4：深访洞察（非结构化纯文本）：
${insightBody}

Input 5：用户纠偏输入（非结构化纯文本 - 最高优先级反馈渠道）：
${rectBody}`;
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask8L45DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
