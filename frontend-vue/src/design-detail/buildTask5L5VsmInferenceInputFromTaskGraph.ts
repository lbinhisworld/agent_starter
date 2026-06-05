/**
 * [INPUT]: 推理图任务 5.3 核心工作流全集
 * [OUTPUT]: 任务 5.5 价值流阶段大模型 user 块
 * [POS]: `runTask55L3VsmStagePipeline` 拼装 LLM 输入；与 `designDetailL55L3VsmStageSystemPrompt.js` Input 1 对齐
 *
 * [PROTOCOL]: 仅 Input 1；模型须将每条 5.3 工作流 100% 归入某阶段 `classified_workflows`
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK5_LINE_TASK_ID,
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY,
} from './designDetailLogicGraphMerge';
import { pickTask53WorkflowFeaturesFromGraphTasks } from './buildCurrentStateUnderstandingWorkflowsFromTask53';
import type { DesignDetailLogicGraphFeatureDto, DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import { normLogicTaskId } from './designDetailLogicGraphMerge';
import { normalizeLogicGraphTasksFromApiPayload } from './designDetailTask2L1SyncUiProgress';

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
}

function formatFeatureTsvLines(
  features: ReadonlyArray<Task2L1TaskGraphFeatureRow | DesignDetailLogicGraphFeatureDto>,
): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  const lines: string[] = [];
  for (const f of features) {
    const id = escapeTsvCell(String(f.featureId ?? ''));
    const tok = escapeTsvCell(String(f.tokenDisplay ?? f.token_display ?? ''));
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

function graphFeatureRowsToTask2Rows(
  features: ReadonlyArray<DesignDetailLogicGraphFeatureDto>,
): Task2L1TaskGraphFeatureRow[] {
  return features.map((f) => ({
    featureId: f.featureId,
    tokenDisplay: f.tokenDisplay ?? f.token_display,
    operator: f.operator,
    name: f.name,
    validationStatus: f.validationStatus,
  }));
}

/** 任务 1：仅保留 Token/Key 含「状态转移」或「状态机」的迁移矩阵特征（任务 6 等仍用） */
export function pickTask1StateTransitionFeaturesFromGraph(
  task1Features: ReadonlyArray<Task2L1TaskGraphFeatureRow>,
): Task2L1TaskGraphFeatureRow[] {
  return task1Features.filter((f) => {
    const tok = String(f.tokenDisplay ?? '').trim();
    const head = tok && tok !== '—' ? (tok.split(/\s*·\s*/)[0]?.trim() ?? tok) : '';
    return head.includes('状态转移') || head.includes('状态机');
  });
}

/** 精准流转要素总线（任务 6 Input 3 等仍用） */
export function pickTask55StrategicBusFeaturesFromGraphTasks(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto | { taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const merged = normalizeLogicGraphTasksFromApiPayload(tasks as DesignDetailLogicGraphTaskDto[]);
  const out: Task2L1TaskGraphFeatureRow[] = [];

  const pushTask = (taskId: string) => {
    const t = merged.find((x) => normLogicTaskId(x.taskId) === taskId);
    if (!t?.features?.length) return;
    out.push(...t.features);
  };

  pushTask(DESIGN_DETAIL_TASK2_LINE_TASK_ID);
  pushTask(DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID);
  pushTask(DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY);
  pushTask(DESIGN_DETAIL_TASK3_LINE_TASK_ID);
  pushTask(DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID);
  pushTask(DESIGN_DETAIL_TASK4_LINE_TASK_ID);
  pushTask(DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID);
  pushTask(DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY);

  const t1 = merged.find((x) => {
    const id = String(x.taskId ?? '').trim();
    return id === 'customer_basic' || id.includes('客户基本情况');
  });
  const t1Feats = Array.isArray(t1?.features) ? t1.features : [];
  out.push(...pickTask1StateTransitionFeaturesFromGraph(t1Feats));

  return out;
}

/** 自推理图任务卡提取任务 5 宏观流程特征行（报告章节等仍用） */
export function pickTask5MacroFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t5 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === DESIGN_DETAIL_TASK5_LINE_TASK_ID || id.includes('任务 5') || id.includes('宏观流程');
  });
  return Array.isArray(t5?.features) ? t5.features : [];
}

export function buildTask55L3VsmInferenceUserBlock(
  task53WorkflowFeatures: ReadonlyArray<DesignDetailLogicGraphFeatureDto | Task2L1TaskGraphFeatureRow>,
): string {
  const colHint = task53WorkflowFeatures.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
    : '四列：FeatureID、TokenStr、Operator、Value';

  const in1 =
    task53WorkflowFeatures.length && 'featureId' in (task53WorkflowFeatures[0] ?? {})
      ? formatFeatureTsvLines(task53WorkflowFeatures as Task2L1TaskGraphFeatureRow[])
      : formatFeatureTsvLines(graphFeatureRowsToTask2Rows(task53WorkflowFeatures as DesignDetailLogicGraphFeatureDto[]));

  const n = task53WorkflowFeatures.length;

  return `【任务 5.5 价值流阶段拓扑收拢输入｜GET /design-detail/task-graph】
说明：结构化 Feature 段以制表符（Tab）分隔，${colHint}。须将以下 **${n}** 条 5.3 核心工作流 100% 归入各阶段 \`classified_workflows\`，禁止孤儿工作流。

Input 1：★【任务 5.3 循环追加拼装完毕的核心工作流列表全集】：
${in1}`;
}

/** 供 pipeline 调试行：仅统计 5.3 工作流条数 */
export { pickTask53WorkflowFeaturesFromGraphTasks };

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask55L3DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
