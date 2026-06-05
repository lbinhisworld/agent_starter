/**
 * [INPUT]: 推理图 5.5 阶段、任务 1、5.3 环节、任务 6 场景、6.5 Gap 方案
 * [OUTPUT]: 任务 7 按「价值流阶段-流程环节」子任务列表与单步 user 块
 * [POS]: `runTask7L4CollaborationPipeline`；与 `designDetailL4CollaborationSystemPrompt.js` Input 1–5 对齐
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  buildTask65ItGapSubtaskList,
  type Task65ItGapSubtask,
} from './buildTask65ItGapInferenceInputFromTaskGraph';
import { pickTask55VsmStageFeaturesFromGraphTasks } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK6_LINE_TASK_ID,
  DESIGN_DETAIL_TASK65_LINE_TASK_ID,
  DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID,
  type DesignDetailLogicGraphTaskDto,
} from './designDetailLogicGraphMerge';
import { readPhaseNameFromStructuredRow } from './designDetailStructuredFeatureValue';
import { phaseNamesMatch } from './buildCurrentStateUnderstandingScenariosFromTask55And6';

export type Task7L4CollaborationSubtask = Task65ItGapSubtask;

export { buildTask65ItGapSubtaskList as buildTask7L4CollaborationSubtaskList };

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

function formatFeatureTsvLines(
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

/** 任务 6 关键场景（Feature_Key「关键场景」或历史 `关键场景_*`） */
export function pickTask6ScenarioFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t6 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === DESIGN_DETAIL_TASK6_LINE_TASK_ID || id.includes('任务 6') || id.includes('关键场景');
  });
  const feats = Array.isArray(t6?.features) ? t6.features : [];
  return feats.filter((f) => {
    const td = String(f.tokenDisplay ?? '').trim();
    const tokenOne = td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
    return tokenOne === '关键场景' || /^关键场景[_\s]*\d+/i.test(tokenOne);
  });
}

/** 任务 6.5：`流程优化Gap方案` 特征全集 */
export function pickTask65ItGapFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t65 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK65_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID ||
      id.includes('任务 6.5') ||
      id.includes('IT-Gap')
    );
  });
  const feats = Array.isArray(t65?.features) ? t65.features : [];
  return feats.filter((f) => {
    const k = tokenKeyOne(String(f.tokenDisplay ?? ''));
    return k === '流程优化Gap方案' || /^流程优化Gap方案[_\s]*\d+/i.test(k);
  });
}

export function task7L4CollaborationProgressLine(progressLabel: string): string {
  const label = String(progressLabel ?? '').trim() || '（未命名环节）';
  return `→ ${label}｜任务节点IT选型`;
}

function formatTask7StepInput3Block(sub: Task7L4CollaborationSubtask): string {
  if (sub.stepFeature) {
    return formatFeatureTsvLines([sub.stepFeature]);
  }
  return `（未在推理图中找到流程环节特征；当前工位：工作流「${sub.workflowName}」环节「${sub.stepName}」；价值流阶段「${sub.phaseLabel}」）`;
}

/** 单「价值流阶段-流程环节」循环工位 user 块 */
export function buildTask7SingleStepL4CollaborationInferenceUserBlock(
  sub: Task7L4CollaborationSubtask,
  allPhaseFeatures: Task2L1TaskGraphFeatureRow[],
  task1Features: Task2L1TaskGraphFeatureRow[],
  task6ScenarioFeatures: Task2L1TaskGraphFeatureRow[],
  task65ItGapFeatures: Task2L1TaskGraphFeatureRow[],
  task7DeepInsightText?: string,
  task7UserRectificationText?: string,
  upstreamConsistencyByTask1FeatureId?: ReadonlyMap<string, string>,
): string {
  const colHint =
    sub.stepFeature && String(sub.stepFeature.validationStatus ?? '').trim()
      ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
      : '四列：FeatureID、TokenStr、Operator、Value';
  const phaseBlock = formatFeatureTsvLines(
    allPhaseFeatures.filter((pf) => phaseNamesMatch(sub.phaseLabel, readPhaseNameFromStructuredRow(pf)))
      .length
      ? allPhaseFeatures.filter((pf) =>
          phaseNamesMatch(sub.phaseLabel, readPhaseNameFromStructuredRow(pf)),
        )
      : [sub.phaseFeature],
  );
  const insightRaw = String(task7DeepInsightText ?? '').replace(/\r\n/g, '\n').trim();
  const rectRaw = String(task7UserRectificationText ?? '').replace(/\r\n/g, '\n').trim();
  const extraBlocks: string[] = [];
  if (insightRaw) {
    extraBlocks.push(`
Input 6（深访洞察；子任务问卷闭环后写入，请优先采纳）：
${insightRaw}`);
  }
  if (rectRaw) {
    extraBlocks.push(`
Input 7（用户纠偏输入；最高优先级反馈渠道）：
${rectRaw}`);
  }

  return `【任务 7 任务节点IT选型｜当前工位：${sub.progressLabel}｜GET /design-detail/task-graph】
说明：结构化 Feature 段以制表符（Tab）分隔。Evidence_Support_Chain 须双源咬合（5.5 价值流阶段 + 6.5 流程优化Gap方案）。**Token_Validation_Mapping.Target_FeatureID** 仅能取自 Input 2 第一列。

Input 1（任务 5.5 价值流阶段全集；当前工位阶段：${sub.phaseLabel}）：
${phaseBlock}

Input 2（★任务 1 节点 Feature 列表全集；TVM 源头）：
${formatFeatureTsvLines(task1Features, upstreamConsistencyByTask1FeatureId)}

Input 3（★当前唯一流程环节特征子集；${colHint}）：
${formatTask7StepInput3Block(sub)}

Input 4（任务 6 关键场景全集）：
${formatFeatureTsvLines(task6ScenarioFeatures)}

Input 5（★任务 6.5 流程优化Gap方案全集）：
${formatFeatureTsvLines(task65ItGapFeatures)}${extraBlocks.join('')}

请仅针对 Input 3 所示流程环节，按系统提示词输出根键 L4_Form_Layout_Matrix 的 Strict JSON（勿 Markdown 围栏）。`;
}

/** @deprecated 整卡单次推理已废弃；保留别名供旧引用编译 */
export function buildTask7L4CollaborationInferenceUserBlock(
  task6ScenarioFeatures: Task2L1TaskGraphFeatureRow[],
  task1Features: Task2L1TaskGraphFeatureRow[],
  deepInsightText?: string,
  userRectificationText?: string,
  upstreamConsistencyByTask1FeatureId?: ReadonlyMap<string, string>,
): string {
  const sub: Task7L4CollaborationSubtask = {
    progressLabel: '（整卡推理·已废弃）',
    phaseLabel: '（未指定）',
    phaseFeature: {
      featureId: '',
      tokenDisplay: '价值流阶段',
      operator: '等于',
      name: '（未指定）',
    },
    workflowName: '',
    stepName: '',
    stepFeature: null,
  };
  return buildTask7SingleStepL4CollaborationInferenceUserBlock(
    sub,
    [],
    task1Features,
    task6ScenarioFeatures,
    [],
    deepInsightText,
    userRectificationText,
    upstreamConsistencyByTask1FeatureId,
  );
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask7L4DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}

export function pickTask55PhaseFeaturesFromGraphTasks(
  graphTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Task2L1TaskGraphFeatureRow[] {
  return pickTask55VsmStageFeaturesFromGraphTasks(graphTasks);
}
