/**
 * [INPUT]: 推理图 tasks（任务 5.5 价值流阶段 + 任务 6 关键场景）
 * [OUTPUT]: 「现状理解」第四层——价值流阶段横向列 + 业务流程 / 关键场景子栏
 * [POS]: `buildCurrentStateUnderstandingViewModel`；任务 6 落库后随 task-graph 刷新
 */

import {
  DESIGN_DETAIL_TASK6_LINE_TASK_ID,
  type DesignDetailLogicGraphTaskDto,
} from './designDetailLogicGraphMerge';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { pickTask55VsmStageFeaturesFromGraphTasks } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import { pickTask6ScenarioFeaturesFromGraphTasks } from './buildTask7L4CollaborationInferenceInputFromTaskGraph';
import {
  readClassifiedWorkflowsFromStructuredRow,
  readPhaseNameFromStructuredRow,
  parseStructuredFeatureValueRoot,
} from './designDetailStructuredFeatureValue';

export type CurrentStateUnderstandingVsmWorkflowCard = {
  id: string;
  workflowName: string;
};

export type CurrentStateUnderstandingScenarioCard = {
  id: string;
  scenarioName: string;
  painPointDescription: string;
  defenseRationale: string;
};

export type CurrentStateUnderstandingVsmPhaseColumn = {
  id: string;
  phaseName: string;
  workflows: CurrentStateUnderstandingVsmWorkflowCard[];
  scenarios: CurrentStateUnderstandingScenarioCard[];
};

/** 推理图 taskId 是否归属任务 6（与 `pickTask6ScenarioFeaturesFromGraphTasks` 一致） */
export function isCurrentStateUnderstandingTask6GraphTaskId(taskId: string | undefined): boolean {
  const id = String(taskId ?? '').trim();
  return (
    id === DESIGN_DETAIL_TASK6_LINE_TASK_ID || id.includes('任务 6') || id.includes('关键场景')
  );
}

/** 重启任务 6 时先从内存快照摘掉任务 6，再 `refreshCurrentStateUnderstandingFromTaskGraph` 与后端对齐 */
export function stripTask6FromGraphTasksForCurrentStateUnderstanding(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): DesignDetailLogicGraphTaskDto[] {
  return tasks.filter((t) => !isCurrentStateUnderstandingTask6GraphTaskId(t.taskId));
}

/** 价值流阶段名对齐（容忍「阶段」后缀差异） */
export function normalizeVsmPhaseNameForMatch(name: string): string {
  const s = String(name ?? '').trim();
  if (!s) return '';
  return s.endsWith('阶段') ? s : `${s}阶段`;
}

export function phaseNamesMatch(phaseA: string, phaseB: string): boolean {
  const a = normalizeVsmPhaseNameForMatch(phaseA);
  const b = normalizeVsmPhaseNameForMatch(phaseB);
  if (!a || !b) return false;
  if (a === b) return true;
  const aShort = a.replace(/阶段$/u, '').trim();
  const bShort = b.replace(/阶段$/u, '').trim();
  return aShort.length > 0 && aShort === bShort;
}

function phaseBucketKeys(phaseId: string, phaseName: string): string[] {
  const keys = new Set<string>();
  const id = String(phaseId ?? '').trim();
  const name = String(phaseName ?? '').trim();
  if (id) keys.add(id);
  if (name) {
    keys.add(name);
    keys.add(normalizeVsmPhaseNameForMatch(name));
    if (name.endsWith('阶段')) keys.add(name.replace(/阶段$/u, '').trim());
  }
  return [...keys];
}

function appendScenariosToBuckets(
  map: Map<string, CurrentStateUnderstandingScenarioCard[]>,
  keys: string[],
  card: CurrentStateUnderstandingScenarioCard,
): void {
  for (const k of keys) {
    if (!k) continue;
    const bucket = map.get(k) ?? [];
    if (!bucket.some((c) => c.id === card.id)) bucket.push(card);
    map.set(k, bucket);
  }
}

function takeScenariosFromBuckets(
  map: Map<string, CurrentStateUnderstandingScenarioCard[]>,
  keys: string[],
): CurrentStateUnderstandingScenarioCard[] {
  const seen = new Set<string>();
  const out: CurrentStateUnderstandingScenarioCard[] = [];
  for (const k of keys) {
    const bucket = map.get(k);
    if (!bucket) continue;
    for (const c of bucket) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  for (const k of keys) map.delete(k);
  return out;
}

function parseTask6ScenarioCard(f: Task2L1TaskGraphFeatureRow): CurrentStateUnderstandingScenarioCard | null {
  const root = parseStructuredFeatureValueRoot(f);
  const scenarioName = root
    ? String(root.scenario_name ?? '').trim()
    : String(f.name ?? '').trim().split('；')[0]?.trim() ?? '';
  if (!scenarioName) return null;
  const pp = root?.associated_pain_point ?? root?.Associated_Pain_Point;
  const ppRec =
    pp && typeof pp === 'object' && !Array.isArray(pp) ? (pp as Record<string, unknown>) : null;
  const id = String(f.featureId ?? '').trim() || `scenario-${scenarioName}`;
  return {
    id,
    scenarioName,
    painPointDescription: String(
      ppRec?.pain_point_description ?? ppRec?.Pain_Point_Description ?? '',
    ).trim(),
    defenseRationale: String(root?.to_be_defense_rationale ?? '').trim(),
  };
}

function scenarioTargetPhaseName(f: Task2L1TaskGraphFeatureRow): string {
  const root = parseStructuredFeatureValueRoot(f);
  return String(root?.targeted_value_phase ?? root?.Targeted_Value_Phase ?? '').trim();
}

/**
 * 第四层：按 5.5 价值流阶段横向排列；每列含 classified_workflows 与归属关键场景子卡。
 */
export function buildCurrentStateUnderstandingVsmScenarioPhases(
  graphTasks?: ReadonlyArray<DesignDetailLogicGraphTaskDto> | null,
): CurrentStateUnderstandingVsmPhaseColumn[] {
  const tasks = graphTasks ?? [];
  const phaseFeatures = pickTask55VsmStageFeaturesFromGraphTasks(tasks);
  if (!phaseFeatures.length) return [];

  const scenarioFeatures = pickTask6ScenarioFeaturesFromGraphTasks(tasks);
  const scenariosByPhase = new Map<string, CurrentStateUnderstandingScenarioCard[]>();

  for (const f of scenarioFeatures) {
    const card = parseTask6ScenarioCard(f);
    if (!card) continue;
    const targetPhase = scenarioTargetPhaseName(f);
    let matchedKeys: string[] = [];
    for (const pf of phaseFeatures) {
      const phaseName = readPhaseNameFromStructuredRow(pf);
      if (phaseNamesMatch(targetPhase, phaseName)) {
        matchedKeys = phaseBucketKeys(String(pf.featureId ?? '').trim(), phaseName);
        break;
      }
    }
    if (!matchedKeys.length) {
      matchedKeys = [`__unmatched__${targetPhase || card.id}`];
    }
    appendScenariosToBuckets(scenariosByPhase, matchedKeys, card);
  }

  const columns: CurrentStateUnderstandingVsmPhaseColumn[] = [];

  for (const pf of phaseFeatures) {
    const phaseName = readPhaseNameFromStructuredRow(pf) || '（未命名价值流阶段）';
    const phaseId = String(pf.featureId ?? phaseName).trim() || phaseName;
    const classified = readClassifiedWorkflowsFromStructuredRow(pf);
    const workflows: CurrentStateUnderstandingVsmWorkflowCard[] = classified
      .filter((w) => String(w.workflow_name ?? '').trim())
      .map((w, i) => ({
        id: String(w.workflow_feature_id ?? '').trim() || `${phaseId}-wf-${i}`,
        workflowName: String(w.workflow_name ?? '').trim(),
      }));
    const scenarios = takeScenariosFromBuckets(scenariosByPhase, phaseBucketKeys(phaseId, phaseName));
    columns.push({
      id: phaseId,
      phaseName,
      workflows,
      scenarios,
    });
  }

  const orphanScenarios: CurrentStateUnderstandingScenarioCard[] = [];
  const orphanSeen = new Set<string>();
  for (const list of scenariosByPhase.values()) {
    for (const c of list) {
      if (orphanSeen.has(c.id)) continue;
      orphanSeen.add(c.id);
      orphanScenarios.push(c);
    }
  }
  if (orphanScenarios.length) {
    const dedup = new Map<string, CurrentStateUnderstandingScenarioCard>();
    for (const c of orphanScenarios) dedup.set(c.id, c);
    columns.push({
      id: '__unmatched_scenarios__',
      phaseName: '（未匹配价值流阶段的关键场景）',
      workflows: [],
      scenarios: [...dedup.values()],
    });
  }

  return columns;
}
