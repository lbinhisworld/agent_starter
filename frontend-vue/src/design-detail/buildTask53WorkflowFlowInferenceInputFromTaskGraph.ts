/**
 * [INPUT]: `GET …/design-detail/task-graph` 任务 5.1/5.2 特征；任务 1 `运营模式/业务流程/` 化石
 * [OUTPUT]: 按业务流程子任务列表；**`buildTask53SingleProcessInferenceUserBlock`**；进度行文案
 * [POS]: 设计详情任务 5.3「流程环节功能理解」；与 `designDetailL53WorkflowFlowSystemPrompt.js` 单流 Input 1/2/3 对齐
 *
 * [PROTOCOL]: 落库 Feature_Key＝关键工作流；`Feature_Value.workflow_name`＝流程名；变更时同步 `runTask53WorkflowFlowPipeline.ts`
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  pickTask51FeaturesFromGraphTasks,
  pickTask52FieldSetFeaturesFromGraphTasks,
} from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';

export type Task53BusinessProcessSubtask = {
  processName: string;
  processFeature: Task2L1TaskGraphFeatureRow;
};

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
}

function operationModelTokenHead(f: Task2L1TaskGraphFeatureRow): string {
  const raw = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  if (!raw || raw === '—') return '';
  return raw.includes('·') ? (raw.split(/\s*·\s*/)[0]?.trim() ?? raw) : raw;
}

/** 任务 1：运营模式下的业务流程节点（TokenStr 形如 `运营模式/业务流程/{流程名}`） */
export function isTask1OperationModelBusinessProcessFeatureRow(f: Task2L1TaskGraphFeatureRow): boolean {
  return operationModelTokenHead(f).startsWith('运营模式/业务流程/');
}

export function task53BusinessProcessNameFromFeatureRow(f: Task2L1TaskGraphFeatureRow): string {
  const head = operationModelTokenHead(f);
  if (!head.startsWith('运营模式/业务流程/')) return '';
  return head.slice('运营模式/业务流程/'.length).trim();
}

/** 扫描任务 1 运营模式业务流程，聚合为理解子任务列表 */
export function buildTask53BusinessProcessSubtaskList(
  task1Features: Task2L1TaskGraphFeatureRow[],
): Task53BusinessProcessSubtask[] {
  const out: Task53BusinessProcessSubtask[] = [];
  const seen = new Set<string>();
  for (const f of task1Features) {
    if (!isTask1OperationModelBusinessProcessFeatureRow(f)) continue;
    const processName = task53BusinessProcessNameFromFeatureRow(f) || '（未命名流程）';
    const dedup = processName.replace(/\s+/g, '');
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    out.push({ processName, processFeature: f });
  }
  return out.sort((a, b) => a.processName.localeCompare(b.processName, 'zh-CN'));
}

/** 进度区子任务行文案（与 LLM callTarget 前缀一致） */
export function task53ProcessUnderstandingProgressLine(processName: string): string {
  return `→ 流程理解：${String(processName ?? '').trim() || '（未命名流程）'}`;
}

function formatTask52FieldSetTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  const lines: string[] = [];
  for (const f of features) {
    const id = escapeTsvCell(String(f.featureId ?? ''));
    const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
    const op = escapeTsvCell(String(f.operator ?? ''));
    const val = escapeTsvCell(String(f.name ?? ''));
    let treeHint = '';
    const treeRaw = f.featureValue ?? f.feature_value;
    if (treeRaw != null) {
      try {
        treeHint = escapeTsvCell(
          typeof treeRaw === 'string' ? treeRaw : JSON.stringify(treeRaw),
        ).slice(0, 2000);
      } catch {
        treeHint = '';
      }
    }
    if (withVs) {
      const vs = escapeTsvCell(String(f.validationStatus ?? '').trim() || 'Pending');
      lines.push(`${id}\t${tok}\t${op}\t${val}\t${treeHint}\t${vs}`);
    } else {
      lines.push(`${id}\t${tok}\t${op}\t${val}\t${treeHint}`);
    }
  }
  return lines.join('\n');
}

function formatTask51CapabilityTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const lines: string[] = [];
  for (const f of features) {
    const id = escapeTsvCell(String(f.featureId ?? ''));
    const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
    const op = escapeTsvCell(String(f.operator ?? ''));
    const val = escapeTsvCell(String(f.name ?? ''));
    let biz = '';
    const raw = f.featureValue ?? f.feature_value;
    if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      biz = escapeTsvCell(
        String(o.business_function ?? o.businessFunction ?? o.Business_Function ?? ''),
      );
    }
    lines.push(`${id}\t${tok}\t${op}\t${val}\t${biz}`);
  }
  return lines.join('\n');
}

function formatTask53ProcessInput3Block(sub: Task53BusinessProcessSubtask): string {
  const f = sub.processFeature;
  const id = escapeTsvCell(String(f.featureId ?? ''));
  const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
  const op = escapeTsvCell(String(f.operator ?? '等于'));
  let valCell = escapeTsvCell(String(f.name ?? sub.processName));
  const raw = f.featureValue ?? f.feature_value;
  if (raw != null) {
    try {
      const serialized =
        typeof raw === 'string' ? raw.trim() : JSON.stringify(raw, null, 0);
      if (serialized) valCell = escapeTsvCell(serialized);
    } catch {
      /* 保留 name 列 */
    }
  }
  const vs = escapeTsvCell(String(f.validationStatus ?? '').trim() || 'Pending');
  return `${id}\t${tok}\t${op}\t${valCell}\t${vs}`;
}

/** 单条业务流程循环工位 user 块（Input 3＝当前唯一流程） */
export function buildTask53SingleProcessInferenceUserBlock(
  task52FieldSetFeatures: Task2L1TaskGraphFeatureRow[],
  task51CapabilityFeatures: Task2L1TaskGraphFeatureRow[],
  subtask: Task53BusinessProcessSubtask,
): string {
  const colHint52 = task52FieldSetFeatures.some((f) => String(f.validationStatus ?? '').trim())
    ? '六列：FeatureID、TokenStr、Operator、Value、fields_schema_tree摘要、Validation_Status'
    : '五列：FeatureID、TokenStr、Operator、Value、fields_schema_tree摘要';
  const colHint51 = task51CapabilityFeatures.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、business_function、Validation_Status'
    : '五列：FeatureID、TokenStr、Operator、Value、business_function';

  return `【任务 5.3 流程环节功能理解｜当前循环流程：${subtask.processName}｜GET /design-detail/task-graph】
说明：下列每一行为一条特征，以制表符（Tab）分隔。本工位仅处理下述一条运营模式业务流程。

Input 1：★【任务 5.2 级联产出的「业务能力字段集」结构化 Feature 列表全集】（${colHint52}）：
${formatTask52FieldSetTsvLines(task52FieldSetFeatures)}

Input 2：★【任务 5.1 级联产出的「业务能力单元」结构化 Feature 列表全集】（${colHint51}）：
${formatTask51CapabilityTsvLines(task51CapabilityFeatures)}

Input 3：★【当前唯一一个特定业务流程需求子集（环节链、主要角色与流程化石）】（五列：FeatureID、TokenStr、Operator、Value、Validation_Status）：
${formatTask53ProcessInput3Block(subtask)}`;
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask53L3DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}

/** @deprecated 整批送模已改为按流程循环 */
export function buildTask53WorkflowFlowInferenceUserBlock(
  task52FieldSetFeatures: Task2L1TaskGraphFeatureRow[],
  task51CapabilityFeatures: Task2L1TaskGraphFeatureRow[],
  _preciseFlowBusText: string,
  _businessProcessIntentCount: number,
): string {
  const sub = buildTask53BusinessProcessSubtaskList([])[0];
  if (!sub) {
    return buildTask53SingleProcessInferenceUserBlock(
      task52FieldSetFeatures,
      task51CapabilityFeatures,
      {
        processName: '（无业务流程）',
        processFeature: { featureId: '', tokenDisplay: '运营模式/业务流程/（无）', operator: '等于', name: '（无）' },
      },
    );
  }
  return buildTask53SingleProcessInferenceUserBlock(task52FieldSetFeatures, task51CapabilityFeatures, sub);
}
