/**
 * [INPUT]: `GET …/design-detail/task-graph` 中任务 2/3/4 的 `features[]`
 * [OUTPUT]: 深访对齐重跑前后特征快照比对与 diff 条目（供任务动态 `alignment_diff_sub`）
 * [POS]: 设计详情任务 2/3/4/5/5.5/6 对齐闭环进度区
 *
 * [PROTOCOL]: 比对键或展示口径变更时须同步 `useDesignDetailChat.ts`、`DesignTaskDynamicsCard.vue` 与 `designDetailProgressWorkspace.ts`
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
  DESIGN_DETAIL_TASK5_LINE_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK55_LINE_TASK_ID,
  DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK6_LINE_TASK_ID,
  DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
} from './designDetailLogicGraphMerge';

/** 任务动态卡 lineTaskId（任务 2/3/4/5/5.5/6 深访对齐） */
export type AlignmentDynamicsLineTaskId =
  | 'scale_org_mode_extract'
  | 'industry_business_profile_extract'
  | 'core_value_driver_inference'
  | 'macro_process_flow_inference'
  | 'vsm_stage_decomposition'
  | 'pain_point_extraction'
  | 'process_type_derivation';

export type AlignmentFeatureSnapshot = Record<string, string>;

export type AlignmentInferenceDiffItem = {
  field: string;
  before: string;
  after: string;
};

type GraphTaskRow = {
  taskId?: string;
  features?: Task2L1TaskGraphFeatureRow[];
};

/** 深访对齐：用户提交后、重跑前主进度行 */
export const ALIGNMENT_FEEDBACK_RECEIVED_LINE = '→ 好的，接收到您的反馈如下：';

/** 深访对齐：进度子行展示用户原文（使用模式下可见，区别于 `user_quote`） */
export function formatAlignmentUserFeedbackProgressText(userText: string): string {
  const t = String(userText ?? '').trim();
  if (!t) return '（未填写）';
  return `「${t}」`;
}

/** 历史快照：深访反馈曾写入 `user_quote`，hydrate 时升级为使用模式可见的 kind */
export function resolveAlignmentUserFeedbackLineKindAfterHydrate(
  lines: ReadonlyArray<{ kind?: string; full?: string }>,
  lineIndex: number,
): 'alignment_user_feedback_sub' | undefined {
  if (lineIndex <= 0) return undefined;
  const prev = String(lines[lineIndex - 1]?.full ?? '').trim();
  if (prev !== ALIGNMENT_FEEDBACK_RECEIVED_LINE) return undefined;
  const kind = String(lines[lineIndex]?.kind ?? '').trim();
  if (kind !== 'user_quote') return undefined;
  return 'alignment_user_feedback_sub';
}

/** 深访对齐：重跑完成后主进度行 */
export const ALIGNMENT_CHANGES_APPLIED_LINE = '→ 按照您的反馈，我进行了如下修改：';

/** 深访对齐：重跑后无结构化字段差异时的灰字说明 */
export const ALIGNMENT_NO_STRUCTURAL_CHANGES_LINE = '（未发现结构化字段变更）';

function featureStableKey(f: Task2L1TaskGraphFeatureRow): string {
  const td = String(f.tokenDisplay ?? '').trim();
  const chinese = td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
  const op = String(f.operator ?? '').trim();
  if (chinese && op) return `${chinese}｜${op}`;
  if (chinese) return chinese;
  return String(f.featureId ?? '').trim();
}

function featureDisplayValue(f: Task2L1TaskGraphFeatureRow): string {
  const val = String(f.name ?? '').trim();
  const op = String(f.operator ?? '').trim();
  if (val && op && op !== '—') return `${op} ${val}`;
  return val || '—';
}

/** 将 task-graph 特征行规范为可比对快照（键稳定、值为展示串） */
export function buildAlignmentFeatureSnapshotFromGraphFeatures(
  features: Task2L1TaskGraphFeatureRow[],
): AlignmentFeatureSnapshot {
  const snap: AlignmentFeatureSnapshot = {};
  for (const f of features) {
    const key = featureStableKey(f);
    if (!key) continue;
    snap[key] = featureDisplayValue(f);
  }
  return snap;
}

function pickTask2FeaturesFromGraphTasks(tasks: GraphTaskRow[]): Task2L1TaskGraphFeatureRow[] {
  const t2 = tasks.find((x) => {
    const id = String(x?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK2_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY
    );
  });
  return Array.isArray(t2?.features) ? t2!.features! : [];
}

function pickTask3FeaturesFromGraphTasks(tasks: GraphTaskRow[]): Task2L1TaskGraphFeatureRow[] {
  const t3 = tasks.find((x) => {
    const id = String(x?.taskId || '').trim();
    return id === DESIGN_DETAIL_TASK3_LINE_TASK_ID || id === DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID;
  });
  return Array.isArray(t3?.features) ? t3!.features! : [];
}

function pickTask4FeaturesFromGraphTasks(tasks: GraphTaskRow[]): Task2L1TaskGraphFeatureRow[] {
  const t4 = tasks.find((x) => {
    const id = String(x?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK4_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY
    );
  });
  return Array.isArray(t4?.features) ? t4!.features! : [];
}

function pickTask5FeaturesFromGraphTasks(tasks: GraphTaskRow[]): Task2L1TaskGraphFeatureRow[] {
  const t5 = tasks.find((x) => {
    const id = String(x?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK5_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY ||
      id.includes('任务 5')
    );
  });
  return Array.isArray(t5?.features) ? t5!.features! : [];
}

function pickTask55FeaturesFromGraphTasks(tasks: GraphTaskRow[]): Task2L1TaskGraphFeatureRow[] {
  const t55 = tasks.find((x) => {
    const id = String(x?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK55_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID ||
      id.includes('任务 5.5')
    );
  });
  return Array.isArray(t55?.features) ? t55!.features! : [];
}

function pickTask6FeaturesFromGraphTasks(tasks: GraphTaskRow[]): Task2L1TaskGraphFeatureRow[] {
  const t6 = tasks.find((x) => {
    const id = String(x?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK6_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID ||
      id.includes('任务 6')
    );
  });
  return Array.isArray(t6?.features) ? t6!.features! : [];
}

export function pickAlignmentFeaturesForLineTask(
  tasks: GraphTaskRow[],
  lineTaskId: AlignmentDynamicsLineTaskId,
): Task2L1TaskGraphFeatureRow[] {
  if (lineTaskId === 'scale_org_mode_extract') return pickTask2FeaturesFromGraphTasks(tasks);
  if (lineTaskId === 'industry_business_profile_extract') return pickTask3FeaturesFromGraphTasks(tasks);
  if (lineTaskId === 'macro_process_flow_inference') return pickTask5FeaturesFromGraphTasks(tasks);
  if (lineTaskId === 'vsm_stage_decomposition') return pickTask55FeaturesFromGraphTasks(tasks);
  if (lineTaskId === 'pain_point_extraction') return pickTask6FeaturesFromGraphTasks(tasks);
  return pickTask4FeaturesFromGraphTasks(tasks);
}

export function buildAlignmentFeatureSnapshotForLineTask(
  tasks: GraphTaskRow[],
  lineTaskId: AlignmentDynamicsLineTaskId,
): AlignmentFeatureSnapshot {
  return buildAlignmentFeatureSnapshotFromGraphFeatures(pickAlignmentFeaturesForLineTask(tasks, lineTaskId));
}

/** 对比重跑前后快照；仅返回有差异的字段 */
export function buildAlignmentInferenceDiffItems(
  before: AlignmentFeatureSnapshot,
  after: AlignmentFeatureSnapshot,
): AlignmentInferenceDiffItem[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const items: AlignmentInferenceDiffItem[] = [];
  const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  for (const key of sorted) {
    const b = before[key] ?? '—';
    const a = after[key] ?? '—';
    if (b === a) continue;
    items.push({ field: key, before: b, after: a });
  }
  return items;
}
