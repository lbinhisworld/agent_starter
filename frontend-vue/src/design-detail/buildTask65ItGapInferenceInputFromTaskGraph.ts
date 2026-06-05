/**
 * [INPUT]: 推理图 5.5 阶段、5.2 字段集、5.3 流程环节、任务 6 关键场景、任务 1 痛点
 * [OUTPUT]: 任务 6.5 按「价值流阶段-流程环节」子任务列表与单步 user 块
 * [POS]: `runTask65ItGapPipeline`；与 `designDetailL65ItGapSystemPrompt.js` Input 1–5 对齐
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  pickTask1PainPointAndLedgerFeaturesFromGraphTasks,
  pickTask52FieldSetFeaturesFromGraphTasks,
  pickTask55VsmStageFeaturesFromGraphTasks,
} from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import { pickTask6ScenarioFeaturesFromGraphTasks } from './buildTask7L4CollaborationInferenceInputFromTaskGraph';
import {
  buildCurrentStateUnderstandingWorkflowsFromTask53,
  type CurrentStateUnderstandingWorkflow,
} from './buildCurrentStateUnderstandingWorkflowsFromTask53';
import {
  DESIGN_DETAIL_TASK53_LINE_TASK_ID,
  normLogicTaskId,
  type DesignDetailLogicGraphTaskDto,
} from './designDetailLogicGraphMerge';
import {
  buildTask53StepFeatureIdLookup,
  task53StepFeatureIdForWorkflowAndStep,
} from './designDetailLogicTreeTask53Layout';
import { readClassifiedWorkflowsFromStructuredRow, readPhaseNameFromStructuredRow } from './designDetailStructuredFeatureValue';
import { phaseNamesMatch } from './buildCurrentStateUnderstandingScenariosFromTask55And6';

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
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

function normalizeWorkflowNameKey(name: string): string {
  return String(name ?? '').replace(/\s+/g, '').trim().toLowerCase();
}

function findWorkflowByName(
  workflows: CurrentStateUnderstandingWorkflow[],
  workflowName: string,
): CurrentStateUnderstandingWorkflow | undefined {
  const needle = normalizeWorkflowNameKey(workflowName);
  if (!needle) return undefined;
  return workflows.find((w) => {
    const k = normalizeWorkflowNameKey(w.workflowName);
    return k === needle || k.includes(needle) || needle.includes(k);
  });
}

export type Task65ItGapSubtask = {
  /** 进度区展示：价值流阶段-流程环节名 */
  progressLabel: string;
  phaseLabel: string;
  phaseFeature: Task2L1TaskGraphFeatureRow;
  workflowName: string;
  stepName: string;
  stepFeature: Task2L1TaskGraphFeatureRow | null;
};

export function task65ItGapProgressLine(progressLabel: string): string {
  const label = String(progressLabel ?? '').trim() || '（未命名环节）';
  return `→ ${label}｜三维 IT-Gap 分析`;
}

/** 自 5.5 阶段 × 5.3 拓扑构建 6.5 外循环子任务（去重：同阶段-环节仅一次） */
export function buildTask65ItGapSubtaskList(
  graphTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Task65ItGapSubtask[] {
  const tasks = graphTasks ?? [];
  const phaseFeatures = pickTask55VsmStageFeaturesFromGraphTasks(tasks);
  const workflows = buildCurrentStateUnderstandingWorkflowsFromTask53(tasks);
  const stepLookup = buildTask53StepFeatureIdLookup(tasks);
  const stepById = new Map<string, Task2L1TaskGraphFeatureRow>();
  const t53 = tasks.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  for (const f of t53?.features ?? []) {
    const row = f as Task2L1TaskGraphFeatureRow;
    const fid = String(row.featureId ?? '').trim();
    if (fid) stepById.set(fid, row);
  }

  const out: Task65ItGapSubtask[] = [];
  const seen = new Set<string>();

  for (const phaseFeature of phaseFeatures) {
    const phaseLabel = readPhaseNameFromStructuredRow(phaseFeature) || '（未命名价值流阶段）';
    const classified = readClassifiedWorkflowsFromStructuredRow(phaseFeature);
    const wfNames: string[] = classified.length
      ? classified
          .map((w) => String(w.workflow_name ?? '').trim())
          .filter(Boolean)
      : workflows.map((w) => w.workflowName);

    for (const wfName of wfNames) {
      const wf = findWorkflowByName(workflows, wfName);
      if (!wf?.steps.length) continue;
      for (const step of wf.steps) {
        const stepName = String(step.stepName ?? '').trim();
        if (!stepName) continue;
        const progressLabel = `${phaseLabel}-${stepName}`;
        if (seen.has(progressLabel)) continue;
        seen.add(progressLabel);
        const stepFid = task53StepFeatureIdForWorkflowAndStep(stepLookup, wf.workflowName, stepName);
        const stepFeature = stepFid ? stepById.get(stepFid) ?? null : null;
        out.push({
          progressLabel,
          phaseLabel,
          phaseFeature,
          workflowName: wf.workflowName,
          stepName,
          stepFeature,
        });
      }
    }
  }

  if (!out.length && workflows.length) {
    const fallbackPhase = phaseFeatures[0];
    const phaseLabel = fallbackPhase
      ? readPhaseNameFromStructuredRow(fallbackPhase) || '（未匹配价值流阶段）'
      : '（未匹配价值流阶段）';
    for (const wf of workflows) {
      for (const step of wf.steps) {
        const stepName = String(step.stepName ?? '').trim();
        if (!stepName) continue;
        const progressLabel = `${phaseLabel}-${stepName}`;
        if (seen.has(progressLabel)) continue;
        seen.add(progressLabel);
        const stepFid = task53StepFeatureIdForWorkflowAndStep(stepLookup, wf.workflowName, stepName);
        out.push({
          progressLabel,
          phaseLabel,
          phaseFeature:
            fallbackPhase ??
            ({
              featureId: '',
              tokenDisplay: '价值流阶段',
              operator: '等于',
              name: phaseLabel,
            } as Task2L1TaskGraphFeatureRow),
          workflowName: wf.workflowName,
          stepName,
          stepFeature: stepFid ? stepById.get(stepFid) ?? null : null,
        });
      }
    }
  }

  return out;
}

function formatTask65PhaseInput1Block(phaseFeatures: Task2L1TaskGraphFeatureRow[]): string {
  return formatFeatureTsvLines(phaseFeatures);
}

function formatTask65StepInput3Block(sub: Task65ItGapSubtask): string {
  if (sub.stepFeature) {
    return formatFeatureTsvLines([sub.stepFeature]);
  }
  return `（未在推理图中找到流程环节特征；当前工位：工作流「${sub.workflowName}」环节「${sub.stepName}」；价值流阶段「${sub.phaseLabel}」）`;
}

/** 单「价值流阶段-流程环节」循环工位 user 块 */
export function buildTask65SingleStepItGapInferenceUserBlock(
  sub: Task65ItGapSubtask,
  allPhaseFeatures: Task2L1TaskGraphFeatureRow[],
  task52FieldSetFeatures: Task2L1TaskGraphFeatureRow[],
  task6ScenarioFeatures: Task2L1TaskGraphFeatureRow[],
  task1PainAndLedgerFeatures: Task2L1TaskGraphFeatureRow[],
  task65DeepInsightText?: string,
): string {
  const colHint =
    sub.stepFeature && String(sub.stepFeature.validationStatus ?? '').trim()
      ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
      : '四列：FeatureID、TokenStr、Operator、Value';
  const phaseBlock = formatTask65PhaseInput1Block(
    allPhaseFeatures.filter((pf) => {
      const pn = readPhaseNameFromStructuredRow(pf);
      return phaseNamesMatch(sub.phaseLabel, pn);
    }).length
      ? allPhaseFeatures.filter((pf) => phaseNamesMatch(sub.phaseLabel, readPhaseNameFromStructuredRow(pf)))
      : [sub.phaseFeature],
  );
  return `【任务 6.5 三维 IT-Gap 分析｜当前工位：${sub.progressLabel}｜GET /design-detail/task-graph】

Input 1（任务 5.5 价值流阶段全集；当前工位阶段：${sub.phaseLabel}）：
${phaseBlock}

Input 2（任务 5.2 业务能力字段集全集）：
${formatFeatureTsvLines(task52FieldSetFeatures)}

Input 3（★当前唯一流程环节特征子集；${colHint}）：
${formatTask65StepInput3Block(sub)}

Input 4（任务 6 关键场景全集）：
${formatFeatureTsvLines(task6ScenarioFeatures)}

Input 5（任务 1 痛点雷达 + 现有表格化石全集）：
${formatFeatureTsvLines(task1PainAndLedgerFeatures)}
${
  String(task65DeepInsightText ?? '').trim()
    ? `
Input 6（本环节深访对齐洞察；子任务问卷闭环后写入，请优先采纳）：
${String(task65DeepInsightText).trim()}
`
    : ''
}
请仅针对 Input 3 所示流程环节，按系统提示词输出根键 L3_IT_Gap_Analysis_Matrix 的 Strict JSON（勿 Markdown 围栏）。`;
}

const TASK65_DEBUG_MAX_CHARS = 14_000;

export function truncateTask65ItGapDebugProgressText(raw: string, maxChars = TASK65_DEBUG_MAX_CHARS): string {
  const s = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!s.length) return '（模型输出为空）';
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n\n…（以下已截断）`;
}
