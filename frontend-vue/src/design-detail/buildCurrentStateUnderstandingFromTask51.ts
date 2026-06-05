/**
 * [INPUT]: 任务 5.1 模型原文 `L3_Value_Proposition_Matrix` JSON；可选 `GET …/task-graph` 归并后的 tasks（任务 5.2 字段集）
 * [OUTPUT]: 「现状理解」画布视图模型（价值主张 + 能力单元/字段集 + 5.3 业务流程层）
 * [POS]: `DesignDetailCurrentStateUnderstandingTab.vue`；5.1 收官写画布；5.2 落库后刷新 task-graph 叠加字段集
 *
 * [PROTOCOL]: 5.1 契约与 `designDetailL51ValuePropositionSystemPrompt.js` 对齐；5.2 字段集按 `associated_capability_unit` 挂载；主键字段标签见 **`isTask52SchemaFieldPrimaryKey`**
 */

import type { DesignDetailLogicGraphFeatureDto, DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import {
  pickTask52FieldSetFeaturesFromGraphTasks,
} from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';
import {
  buildCurrentStateUnderstandingWorkflowsFromTask53,
  type CurrentStateUnderstandingWorkflow,
} from './buildCurrentStateUnderstandingWorkflowsFromTask53';
import {
  buildCurrentStateUnderstandingVsmScenarioPhases,
  type CurrentStateUnderstandingVsmPhaseColumn,
} from './buildCurrentStateUnderstandingScenariosFromTask55And6';
import {
  isTask52SchemaFieldPrimaryKey,
  task52AssociatedCapabilityUnitFromDisplay,
  task52FieldSchemaLeavesFromDisplay,
  task52FieldSetTitleFromDisplay,
} from './designDetailLogicTreeTask52Layout';

/** 现状理解 Tab 内字段集子卡：字段名标签每行个数（与逻辑树 3 列区分） */
export const CSU_FIELD_TAGS_PER_ROW = 4;

/** 第三层环节子卡：引用字段集字段标签每行个数 */
export const CSU_WORKFLOW_STEP_FIELD_TAGS_PER_ROW = 2;

export type CurrentStateUnderstandingFieldTag = {
  fieldName: string;
  dataType: string;
  /** 主键字段：现状理解子卡标签蓝底白字 */
  isPrimaryKey: boolean;
};

export type CurrentStateUnderstandingFieldSetCard = {
  id: string;
  title: string;
  fieldTags: CurrentStateUnderstandingFieldTag[];
};

export type CurrentStateUnderstandingCapabilityUnit = {
  id: string;
  title: string;
  /** 业务能力节点介绍：模型 `business_function`（旧数据可回退 `inference_summary`） */
  businessFunction: string;
  /** 任务 5.2 落库后挂载于本能力单元下的字段集子卡（垂直排列） */
  fieldSets: CurrentStateUnderstandingFieldSetCard[];
};

export type CurrentStateUnderstandingModel = {
  valuePropositionTitle: string;
  coreValueClaim: string;
  coreReasoningLogic: string;
  deliveryModelCharacter: string;
  capabilityUnits: CurrentStateUnderstandingCapabilityUnit[];
  /** 任务 5.3 落库后的核心工作流（第三层） */
  workflows: CurrentStateUnderstandingWorkflow[];
  /** 任务 5.5 + 6：价值流阶段列（第四层） */
  vsmScenarioPhases: CurrentStateUnderstandingVsmPhaseColumn[];
};

export type { CurrentStateUnderstandingWorkflow, CurrentStateUnderstandingWorkflowStep } from './buildCurrentStateUnderstandingWorkflowsFromTask53';
export type {
  CurrentStateUnderstandingScenarioCard,
  CurrentStateUnderstandingVsmPhaseColumn,
  CurrentStateUnderstandingVsmWorkflowCard,
} from './buildCurrentStateUnderstandingScenariosFromTask55And6';

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '');
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function getPropertyCI(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj) return obj[k];
    const lower = k.toLowerCase();
    for (const [pk, pv] of Object.entries(obj)) {
      if (pk.toLowerCase() === lower) return pv;
    }
  }
  return undefined;
}

function parseJsonRoot(raw: string): Record<string, unknown> | null {
  let s = stripBom(String(raw || '').trim());
  if (!s) return null;
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) s = fence[1]!.trim();
  try {
    const v = JSON.parse(s);
    return asRecord(v);
  } catch {
    return null;
  }
}

function readMatrix(root: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(
    getPropertyCI(root, 'L3_Value_Proposition_Matrix', 'l3_value_proposition_matrix') as unknown,
  );
}

function readValueProposition(matrix: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(getPropertyCI(matrix, 'Value_Proposition', 'value_proposition') as unknown);
}

function readTargetKvArray(matrix: Record<string, unknown>): unknown[] {
  const kv = getPropertyCI(matrix, 'Target_KV', 'target_kv');
  return Array.isArray(kv) ? kv : [];
}

function readStringField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = getPropertyCI(row, k);
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function readFeatureKey(row: Record<string, unknown>): string {
  return readStringField(row, 'Feature_Key', 'feature_key', 'featureKey');
}

function slugCapabilityId(index: number): string {
  return `cap-${index}`;
}

/**
 * 由任务 5.1 模型原文构建「现状理解」画布模型；解析失败返回 null。
 */
export function buildCurrentStateUnderstandingFromTask51(
  l51Raw: string,
  customerDisplayName: string,
): CurrentStateUnderstandingModel | null {
  const root = parseJsonRoot(l51Raw);
  if (!root) return null;
  const matrix = readMatrix(root);
  if (!matrix) return null;

  const vp = readValueProposition(matrix);
  const coreValueClaim = vp
    ? readStringField(vp, 'core_value_claim', 'coreValueClaim')
    : '';
  const valuePropositionInferenceSummary = vp
    ? readStringField(vp, 'inference_summary', 'Inference_Summary', 'inferenceSummary')
    : '';
  const deliveryModel = vp
    ? readStringField(vp, 'delivery_model_character', 'deliveryModelCharacter')
    : '';

  const capabilityUnits: CurrentStateUnderstandingCapabilityUnit[] = [];
  const seenUnits = new Set<string>();

  for (const item of readTargetKvArray(matrix)) {
    const row = asRecord(item);
    if (!row) continue;
    const fk = readFeatureKey(row);
    if (fk !== '业务能力单元') continue;
    const title = readStringField(row, 'Feature_Value', 'feature_value', 'featureValue');
    if (!title) continue;
    const dedup = title;
    if (seenUnits.has(dedup)) continue;
    seenUnits.add(dedup);
    const businessFunction =
      readStringField(row, 'business_function', 'Business_Function', 'businessFunction') ||
      readStringField(row, 'inference_summary', 'Inference_Summary', 'inferenceSummary');
    capabilityUnits.push({
      id: slugCapabilityId(capabilityUnits.length),
      title,
      businessFunction: businessFunction || '（未提供 business_function）',
      fieldSets: [],
    });
  }

  const customer = String(customerDisplayName || '').trim() || '客户';
  const valuePropositionTitle = `${customer}核心价值主张`;

  if (!coreValueClaim && !valuePropositionInferenceSummary && capabilityUnits.length === 0) {
    return null;
  }

  return {
    valuePropositionTitle,
    coreValueClaim: coreValueClaim || '（未提供 core_value_claim）',
    coreReasoningLogic:
      valuePropositionInferenceSummary || '（未提供 Value_Proposition.inference_summary）',
    deliveryModelCharacter: deliveryModel || '（未提供 delivery_model_character）',
    capabilityUnits,
    workflows: [],
    vsmScenarioPhases: [],
  };
}

function normalizeCapabilityUnitMatchKey(raw: string): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function resolveCapabilityUnitIdForFieldSet(
  associatedUnit: string,
  units: CurrentStateUnderstandingCapabilityUnit[],
): string | null {
  const needle = normalizeCapabilityUnitMatchKey(associatedUnit);
  if (!needle || !units.length) return null;
  for (const u of units) {
    const hay = normalizeCapabilityUnitMatchKey(u.title);
    if (!hay) continue;
    if (hay === needle || hay.includes(needle) || needle.includes(hay)) return u.id;
  }
  return units[units.length - 1]!.id;
}

function attachTask52FieldSetsToCapabilityUnits(
  units: CurrentStateUnderstandingCapabilityUnit[],
  graphTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto> | null | undefined,
): void {
  for (const u of units) {
    u.fieldSets = [];
  }
  const rows = pickTask52FieldSetFeaturesFromGraphTasks(
    (graphTasks ?? []) as Array<{ taskId?: string; features?: unknown[] }>,
  );
  if (!rows.length) return;

  const byUnit = new Map<string, CurrentStateUnderstandingFieldSetCard[]>();
  for (const u of units) {
    byUnit.set(u.id, []);
  }

  rows.forEach((f, idx) => {
    const fid = String(f.featureId ?? '').trim() || `fs-${idx}`;
    const display = f as DesignDetailLogicGraphFeatureDto;
    const title = task52FieldSetTitleFromDisplay(display);
    const acu = task52AssociatedCapabilityUnitFromDisplay(display);
    const unitId = resolveCapabilityUnitIdForFieldSet(acu, units);
    if (!unitId) return;
    const leaves = task52FieldSchemaLeavesFromDisplay(display);
    const card: CurrentStateUnderstandingFieldSetCard = {
      id: fid,
      title,
      fieldTags: leaves.map((leaf) => ({
        fieldName: leaf.fieldName,
        dataType: leaf.dataType || '—',
        isPrimaryKey: isTask52SchemaFieldPrimaryKey(leaf.dataType, leaf.constraints),
      })),
    };
    byUnit.get(unitId)!.push(card);
  });

  for (const u of units) {
    u.fieldSets = byUnit.get(u.id) ?? [];
  }
}

/**
 * 构建「现状理解」完整视图：5.1 价值主张 + 业务能力单元，并叠加 5.2 字段集子卡。
 */
export function buildCurrentStateUnderstandingViewModel(
  l51Raw: string,
  customerDisplayName: string,
  graphTasks?: ReadonlyArray<DesignDetailLogicGraphTaskDto> | null,
): CurrentStateUnderstandingModel | null {
  const base = buildCurrentStateUnderstandingFromTask51(l51Raw, customerDisplayName);
  if (!base) return null;
  attachTask52FieldSetsToCapabilityUnits(base.capabilityUnits, graphTasks);
  base.workflows = buildCurrentStateUnderstandingWorkflowsFromTask53(graphTasks);
  base.vsmScenarioPhases = buildCurrentStateUnderstandingVsmScenarioPhases(graphTasks);
  return base;
}

/** hydrate：从任务 5.1 动态卡 `task51_inference_sub` 行恢复模型原文 */
export function recoverTask51RawFromDynamicsInferenceSub(
  cards: ReadonlyArray<{ lineTaskId?: string; lines?: ReadonlyArray<{ kind?: string; full?: string }> }>,
): string {
  const card = cards.find((c) => c.lineTaskId === 'value_proposition_capability_units');
  if (!card?.lines?.length) return '';
  for (const line of card.lines) {
    if (line.kind === 'task51_inference_sub') {
      return String(line.full || '').trim();
    }
  }
  return '';
}
