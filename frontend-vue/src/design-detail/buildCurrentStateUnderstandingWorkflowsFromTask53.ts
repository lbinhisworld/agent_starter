/**
 * [INPUT]: `GET …/task-graph` 归并后的 tasks（任务 5.3「关键工作流」特征，须含 `featureValue`）
 * [OUTPUT]: 「现状理解」第三层——业务流程可折叠卡 + 横向环节子卡视图模型
 * [POS]: `buildCurrentStateUnderstandingViewModel` 在 5.3 落库后叠加；解析与逻辑树共用 `designDetailLogicTreeTask53Layout`
 *
 * [PROTOCOL]: 与 `designDetailL53WorkflowFlowSystemPrompt.js` 中 `workflow_steps_topology` 契约对齐；环节 `associated_asset_dataset` 匹配 5.2 字段集并展开 `fields_schema_tree`（主键见 `isTask52SchemaFieldPrimaryKey`）
 */

import {
  DESIGN_DETAIL_TASK53_LINE_TASK_ID,
  normLogicTaskId,
  type DesignDetailLogicGraphFeatureDto,
  type DesignDetailLogicGraphTaskDto,
} from './designDetailLogicGraphMerge';
import { normalizeLogicGraphTasksFromApiPayload } from './designDetailTask2L1SyncUiProgress';
import {
  pickTask52FieldSetFeaturesFromGraphTasks,
} from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';
import type { CurrentStateUnderstandingFieldTag } from './buildCurrentStateUnderstandingFromTask51';
import {
  isTask52SchemaFieldPrimaryKey,
  task52FieldSchemaLeavesFromDisplay,
  task52FieldSetTitleFromDisplay,
} from './designDetailLogicTreeTask52Layout';
import {
  isTask53WorkflowGraphFeatureRow,
  orderTask53WorkflowStepsFromRoot,
  parseTask53FeatureValueRoot,
  readTask53WorkflowNameFromRoot,
} from './designDetailLogicTreeTask53Layout';

export type CurrentStateUnderstandingWorkflowStep = {
  id: string;
  stepName: string;
  /** 任务 5.1 业务能力单元 */
  capabilityUnit: string;
  /** 任务 5.2 业务能力字段集（`表格名称 - 业务能力单元`） */
  assetFieldSet: string;
  /** 与 `assetFieldSet` 匹配的 5.2 字段集 `fields_schema_tree` 字段 */
  fieldTags: CurrentStateUnderstandingFieldTag[];
};

export type CurrentStateUnderstandingWorkflow = {
  id: string;
  workflowName: string;
  steps: CurrentStateUnderstandingWorkflowStep[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizeFieldSetTitleMatchKey(raw: string): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function buildFieldSetTitleToTagsIndex(
  graphTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto> | null | undefined,
): Map<string, CurrentStateUnderstandingFieldTag[]> {
  const index = new Map<string, CurrentStateUnderstandingFieldTag[]>();
  const rows = pickTask52FieldSetFeaturesFromGraphTasks(
    (graphTasks ?? []) as Array<{ taskId?: string; features?: unknown[] }>,
  );
  for (const f of rows) {
    const display = f as DesignDetailLogicGraphFeatureDto;
    const title = task52FieldSetTitleFromDisplay(display);
    const key = normalizeFieldSetTitleMatchKey(title);
    if (!key) continue;
    const leaves = task52FieldSchemaLeavesFromDisplay(display);
    const tags: CurrentStateUnderstandingFieldTag[] = leaves.map((leaf) => ({
      fieldName: leaf.fieldName,
      dataType: leaf.dataType || '—',
      isPrimaryKey: isTask52SchemaFieldPrimaryKey(leaf.dataType, leaf.constraints),
    }));
    if (!index.has(key)) index.set(key, tags);
  }
  return index;
}

function resolveFieldTagsForAssetFieldSet(
  assetFieldSet: string,
  index: ReadonlyMap<string, CurrentStateUnderstandingFieldTag[]>,
): CurrentStateUnderstandingFieldTag[] {
  const needle = normalizeFieldSetTitleMatchKey(assetFieldSet);
  if (!needle || needle === '—') return [];
  const direct = index.get(needle);
  if (direct?.length) return [...direct];
  for (const [k, tags] of index) {
    if (!k || !tags.length) continue;
    if (k === needle || k.includes(needle) || needle.includes(k)) return [...tags];
  }
  return [];
}

function readStepMetaFromRecord(step: Record<string, unknown>): {
  capabilityUnit: string;
  assetFieldSet: string;
} {
  return {
    capabilityUnit: String(
      step.associated_capability_unit ??
        step.Associated_Capability_Unit ??
        step.associatedCapabilityUnit ??
        '',
    ).trim(),
    assetFieldSet: String(
      step.associated_asset_dataset ??
        step.Associated_Asset_Dataset ??
        step.associatedAssetDataset ??
        '',
    ).trim(),
  };
}

/** 自推理图任务卡提取任务 5.3「关键工作流」特征行 */
export function pickTask53WorkflowFeaturesFromGraphTasks(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto> | null | undefined,
): DesignDetailLogicGraphFeatureDto[] {
  const merged = normalizeLogicGraphTasksFromApiPayload((tasks ?? []) as DesignDetailLogicGraphTaskDto[]);
  const out: DesignDetailLogicGraphFeatureDto[] = [];
  const seen = new Set<string>();

  const pushRow = (f: DesignDetailLogicGraphFeatureDto) => {
    if (!isTask53WorkflowGraphFeatureRow(f)) return;
    const id = String(f.featureId ?? '').trim();
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    out.push(f);
  };

  for (const t of merged) {
    if (normLogicTaskId(t.taskId) !== DESIGN_DETAIL_TASK53_LINE_TASK_ID) continue;
    for (const f of t.features ?? []) {
      pushRow(f as DesignDetailLogicGraphFeatureDto);
    }
  }

  if (!out.length) {
    for (const t of merged) {
      for (const f of t.features ?? []) {
        pushRow(f as DesignDetailLogicGraphFeatureDto);
      }
    }
  }

  return out;
}

function buildStepsForWorkflow(
  workflowId: string,
  root: Record<string, unknown>,
  fieldSetTagsIndex: ReadonlyMap<string, CurrentStateUnderstandingFieldTag[]>,
): CurrentStateUnderstandingWorkflowStep[] {
  const stepsByName = new Map<string, Record<string, unknown>>();
  const topology = root.workflow_steps_topology ?? root.Workflow_Steps_Topology;
  if (Array.isArray(topology)) {
    for (const item of topology) {
      const step = asRecord(item);
      if (!step) continue;
      const name = String(step.step_name ?? step.Step_Name ?? '').trim();
      if (name) stepsByName.set(name, step);
    }
  }

  const ordered = orderTask53WorkflowStepsFromRoot(root);
  const out: CurrentStateUnderstandingWorkflowStep[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ordered.length; i++) {
    const chip = ordered[i]!;
    if (seen.has(chip.stepName)) continue;
    seen.add(chip.stepName);
    const rec = stepsByName.get(chip.stepName);
    const meta = rec ? readStepMetaFromRecord(rec) : { capabilityUnit: '', assetFieldSet: '' };
    const assetFieldSet = meta.assetFieldSet || '—';
    out.push({
      id: `${workflowId}-step-${i}`,
      stepName: chip.stepName,
      capabilityUnit: meta.capabilityUnit || '—',
      assetFieldSet,
      fieldTags: resolveFieldTagsForAssetFieldSet(assetFieldSet, fieldSetTagsIndex),
    });
  }
  return out;
}

/**
 * 自 task-graph 构建第三层「业务流程理解」列表（按 workflow_name 排序）。
 */
export function buildCurrentStateUnderstandingWorkflowsFromTask53(
  graphTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto> | null | undefined,
): CurrentStateUnderstandingWorkflow[] {
  const rows = pickTask53WorkflowFeaturesFromGraphTasks(graphTasks);
  const fieldSetTagsIndex = buildFieldSetTitleToTagsIndex(graphTasks);
  const workflows: CurrentStateUnderstandingWorkflow[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const display = rows[i]!;
    const root = parseTask53FeatureValueRoot(display);
    if (!root) continue;
    const workflowName = readTask53WorkflowNameFromRoot(root) || `（未命名流程 ${i + 1}）`;
    const dedup = workflowName.replace(/\s+/g, '');
    if (seenNames.has(dedup)) continue;
    seenNames.add(dedup);
    const fid = String(display.featureId ?? '').trim() || `wf-${i}`;
    const steps = buildStepsForWorkflow(fid, root, fieldSetTagsIndex);
    workflows.push({
      id: fid,
      workflowName,
      steps,
    });
  }

  workflows.sort((a, b) => a.workflowName.localeCompare(b.workflowName, 'zh-CN'));
  return workflows;
}
