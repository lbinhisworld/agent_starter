/**
 * [INPUT]: 推理图任务 5.5 价值流阶段、5.2 字段集、任务 1 痛点/现有表格
 * [OUTPUT]: 任务 6「关键场景推理」按阶段循环的 user 块
 * [POS]: `runTask6L3ScenarioPipeline`；与 `designDetailL3ScenarioSystemPrompt.js` Input 1–3 对齐
 *
 * [PROTOCOL]: `targeted_value_phase` 须与 Input 1 的 `phase_name` 字面一致；变更时同步进度行 migrate 模块
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  isTask2L1PainPointRadarFeatureRow,
  orderTask2L1Input2FeaturesForReverseValidation,
} from './buildTask2L1InferenceInputFromTaskGraph';
import { pickTask52FieldSetFeaturesFromGraphTasks } from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';
import { DESIGN_DETAIL_TASK55_LINE_TASK_ID } from './designDetailLogicGraphMerge';
import { readPhaseNameFromStructuredRow } from './designDetailStructuredFeatureValue';

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

function existingSpreadsheetTokenHead(f: Task2L1TaskGraphFeatureRow): string {
  const raw = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  if (!raw || raw === '—') return '';
  return raw.includes('·') ? (raw.split(/\s*·\s*/)[0]?.trim() ?? raw) : raw;
}

function isTask1ExistingSpreadsheetFeatureRow(f: Task2L1TaskGraphFeatureRow): boolean {
  return existingSpreadsheetTokenHead(f).startsWith('现有表格/');
}

/** 任务 5.5 VSM 阶段（统一 Feature_Key「价值流阶段」或历史 `价值流阶段_*`） */
export function pickTask55VsmStageFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t55 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === DESIGN_DETAIL_TASK55_LINE_TASK_ID || id.includes('任务 5.5') || id.includes('VSM');
  });
  const feats = Array.isArray(t55?.features) ? t55.features : [];
  return feats.filter((f) => {
    const td = String(f.tokenDisplay ?? '').trim();
    const tokenOne = td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
    return tokenOne === '价值流阶段' || /^价值流阶段[_\s]*\d+/i.test(tokenOne);
  });
}

/** 任务 1：痛点雷达 + 现有表格化石（Input 3） */
export function pickTask1PainPointAndLedgerFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t1 = tasks.find((x) => {
    const id = String(x?.taskId ?? '').trim();
    return id === 'customer_basic' || id.includes('客户基本情况');
  });
  const feats = Array.isArray(t1?.features) ? t1!.features! : [];
  return orderTask2L1Input2FeaturesForReverseValidation(feats).filter(
    (f) => isTask2L1PainPointRadarFeatureRow(f) || isTask1ExistingSpreadsheetFeatureRow(f),
  );
}

/** @deprecated 使用 pickTask1PainPointAndLedgerFeaturesFromGraphTasks */
export function pickTask1PainPointRadarFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  return pickTask1PainPointAndLedgerFeaturesFromGraphTasks(tasks).filter(isTask2L1PainPointRadarFeatureRow);
}

export { pickTask52FieldSetFeaturesFromGraphTasks };

export type Task6VsmPhaseSubtask = {
  phaseFeature: Task2L1TaskGraphFeatureRow;
  phaseLabel: string;
};

export function readTask55PhaseNameFromFeature(f: Task2L1TaskGraphFeatureRow): string {
  return readPhaseNameFromStructuredRow(f);
}

/** 自 5.5 价值流阶段特征行构建任务 6 外循环子任务列表 */
export function buildTask6VsmPhaseSubtaskList(
  phaseFeatures: Task2L1TaskGraphFeatureRow[],
): Task6VsmPhaseSubtask[] {
  return phaseFeatures.map((phaseFeature) => {
    const phaseLabel = readTask55PhaseNameFromFeature(phaseFeature) || '（未命名价值流阶段）';
    return { phaseFeature, phaseLabel };
  });
}

export function task6PhaseScenarioProgressLine(phaseLabel: string): string {
  const label = String(phaseLabel ?? '').trim() || '（未命名价值流阶段）';
  const phaseTitle = label.endsWith('阶段') ? label : `${label}阶段`;
  return `→ ${phaseTitle}｜关键场景推理`;
}

function formatTask6PhaseInput1Block(sub: Task6VsmPhaseSubtask): string {
  const f = sub.phaseFeature;
  const id = escapeTsvCell(String(f.featureId ?? ''));
  const tok = escapeTsvCell(String(f.tokenDisplay ?? ''));
  const op = escapeTsvCell(String(f.operator ?? '等于'));
  let valCell = escapeTsvCell(sub.phaseLabel);
  const raw = f.featureValue ?? f.feature_value;
  if (raw != null) {
    try {
      const serialized =
        typeof raw === 'string' ? raw.trim() : JSON.stringify(raw, null, 0);
      if (serialized) valCell = escapeTsvCell(serialized);
    } catch {
      /* 保留 phaseLabel */
    }
  }
  const vs = escapeTsvCell(String(f.validationStatus ?? '').trim() || 'Pending');
  return `${id}\t${tok}\t${op}\t${valCell}\t${vs}`;
}

/** 单价值流阶段循环工位 user 块 */
export function buildTask6SinglePhaseInferenceUserBlock(
  phaseSubtask: Task6VsmPhaseSubtask,
  task52FieldSetFeatures: Task2L1TaskGraphFeatureRow[],
  task1PainAndLedgerFeatures: Task2L1TaskGraphFeatureRow[],
): string {
  const colHint52 = task52FieldSetFeatures.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
    : '四列：FeatureID、TokenStr、Operator、Value';
  const colHint3 =
    [...task1PainAndLedgerFeatures].some((f) => String(f.validationStatus ?? '').trim()) ||
    task52FieldSetFeatures.some((f) => String(f.validationStatus ?? '').trim())
      ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
      : '四列：FeatureID、TokenStr、Operator、Value';

  return `【任务 6：关键场景推理｜当前循环价值流阶段：${phaseSubtask.phaseLabel}｜GET /design-detail/task-graph】
说明：结构化 Feature 段以制表符（Tab）分隔。本工位仅处理下述**唯一**价值流阶段；\`targeted_value_phase\` 须与 Input 1 中 \`phase_name\` **完全字面一致**。

Input 1：★【🔥当前外部循环步注入的唯一一个特定价值流阶段特征节点】（五列：FeatureID、TokenStr、Operator、Value、Validation_Status）：
${formatTask6PhaseInput1Block(phaseSubtask)}

Input 2：★【任务 5.2 业务能力字段集特征全集】（${colHint52}；格式 \`表格名称 - 业务能力单元\`）：
${formatFeatureTsvLines(task52FieldSetFeatures)}

Input 3：★【任务 1 痛点雷达及现有表格老账本特征行全集】（${colHint3}）：
${formatFeatureTsvLines(task1PainAndLedgerFeatures)}`;
}

/** @deprecated 整批送模已改为按 5.5 价值流阶段循环；保留供测试/兼容 */
export function buildTask6L3ScenarioInferenceUserBlock(
  task55VsmFeatures: Task2L1TaskGraphFeatureRow[],
  task1PainPointRadarFeatures: Task2L1TaskGraphFeatureRow[],
  task52FieldSetFeatures: Task2L1TaskGraphFeatureRow[] = [],
): string {
  const sub = buildTask6VsmPhaseSubtaskList(task55VsmFeatures)[0];
  if (!sub) {
    return `【任务 6：关键场景推理】\n（无 5.5 价值流阶段可推理）`;
  }
  return buildTask6SinglePhaseInferenceUserBlock(
    sub,
    task52FieldSetFeatures,
    task1PainPointRadarFeatures,
  );
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask6L3DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
