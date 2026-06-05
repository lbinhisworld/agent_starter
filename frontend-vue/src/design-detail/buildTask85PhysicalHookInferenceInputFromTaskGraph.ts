/**
 * [INPUT]: 推理图任务 8 状态转移矩阵、任务 0 工具原语、任务 1~4 商业基因
 * [OUTPUT]: 任务 8.5 L4.7 技术集成大模型 user 块
 * [POS]: `runTask85PhysicalHookPipeline` 拼装 LLM 输入
 *
 * [PROTOCOL]: 与 `designDetailL475PhysicalHookSystemPrompt.js` Input 1–3 对齐；Input 1=任务7「协作节点」+任务8「状态转移矩阵」；含 **Validation_Status** / **Predecessor_Value**；TVM **Target_FeatureID** 仅来自任务 1 节点
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  formatFeatureTsvLines,
  pickTask1Through4FeaturesFromGraphTasks,
  pickTask7CollaborationNodesOnlyFromGraphTasks,
} from './buildTask8L45PrototypeInferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK0_LINE_TASK_ID,
  LOGIC_GRAPH_TASK0_TITLE,
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
  DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID,
} from './designDetailLogicGraphMerge';

function tokenKeyOne(tokenDisplay: string): string {
  const td = String(tokenDisplay ?? '').trim();
  return td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
}

function formatStmTsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  return features
    .map((f) => {
      const id = String(f.featureId ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[\t\n\r]/g, ' ')
        .trim();
      const tok = String(f.tokenDisplay ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[\t\n\r]/g, ' ')
        .trim();
      const op = String(f.operator ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[\t\n\r]/g, ' ')
        .trim();
      const val = String(f.name ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[\t\n\r]/g, ' ')
        .trim();
      if (withVs) {
        const vs = String(f.validationStatus ?? '').trim() || 'Pending';
        return `${id}\t${tok}\t${op}\t${val}\t${vs.replace(/[\t\n\r]/g, ' ')}`;
      }
      return `${id}\t${tok}\t${op}\t${val}`;
    })
    .join('\n');
}

/** 任务 8 Input 1 辅：「状态转移矩阵」行（与协作节点配对供 L4.7 对撞） */
export function pickTask8StmFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t8 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK8_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY ||
      id.includes('任务 8')
    );
  });
  const feats = Array.isArray(t8?.features) ? t8.features : [];
  return feats.filter((f) => tokenKeyOne(String(f.tokenDisplay ?? '')) === '状态转移矩阵');
}

/** @deprecated 任务 8.5 现用 pickTask8StmFeaturesFromGraphTasks */
export function pickTask8FsmFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  return pickTask8StmFeaturesFromGraphTasks(tasks);
}

/**
 * 任务 8.5 Input 1：任务 7「协作节点」全量 + 任务 8「状态转移矩阵」特征对（L4.7 打标边界）。
 */
export function pickTask85Input1CollaborationHostFeatures(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const collab = pickTask7CollaborationNodesOnlyFromGraphTasks(tasks);
  const stm = pickTask8StmFeaturesFromGraphTasks(tasks);
  return [...collab, ...stm];
}

function formatTask85Input1TsvLines(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const collab = features.filter((f) => tokenKeyOne(String(f.tokenDisplay ?? '')) === '协作节点');
  const stm = features.filter((f) => tokenKeyOne(String(f.tokenDisplay ?? '')) === '状态转移矩阵');
  const parts: string[] = [];
  if (collab.length) {
    parts.push('【协作节点】');
    parts.push(formatTask7CollaborationTsvForTask85(collab));
  }
  if (stm.length) {
    parts.push('【状态转移矩阵】');
    parts.push(formatStmTsvLines(stm));
  }
  return parts.length ? parts.join('\n') : '（无）';
}

/** 协作节点 TSV：含 Predecessor_Value（从 logic/summary 尽力还原） */
function formatTask7CollaborationTsvForTask85(features: Task2L1TaskGraphFeatureRow[]): string {
  if (!features.length) return '（无）';
  const withVs = features.some((f) => String(f.validationStatus ?? '').trim().length > 0);
  return features
    .map((f) => {
      const id = String(f.featureId ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[\t\n\r]/g, ' ')
        .trim();
      const tok = String(f.tokenDisplay ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[\t\n\r]/g, ' ')
        .trim();
      const op = String(f.operator ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[\t\n\r]/g, ' ')
        .trim();
      const val = String(f.name ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[\t\n\r]/g, ' ')
        .trim();
      const pred = extractTask7PredecessorHintForTask85(f);
      if (withVs) {
        const vs = String(f.validationStatus ?? '').trim() || 'Pending';
        return `${id}\t${tok}\t${op}\t${val}\t${pred.replace(/[\t\n\r]/g, ' ')}\t${vs.replace(/[\t\n\r]/g, ' ')}`;
      }
      return `${id}\t${tok}\t${op}\t${val}\t${pred.replace(/[\t\n\r]/g, ' ')}`;
    })
    .join('\n');
}

function extractTask7PredecessorHintForTask85(f: Task2L1TaskGraphFeatureRow): string {
  const summ = String((f as { inferenceSummary?: string }).inferenceSummary ?? '').trim();
  if (/START/i.test(summ)) return 'START';
  const logic = String((f as { logicRule?: string }).logicRule ?? '').trim();
  const m = logic.match(/Predecessor_Value[：:]\s*([^；;。\n]+)/i);
  if (m?.[1]) return m[1].trim();
  const m2 = summ.match(/前置[^：:]*[：:]\s*([^；;。\n]+)/);
  if (m2?.[1]) return m2[1].trim();
  return '';
}

const TASK85_FEATURE_KEYS = new Set([
  '界面交互层',
  '数据承载层',
  '衔接互动层',
  '技术组件映射',
  '自动化流Hook',
  '前端交互载体',
  '物理外挂Hook',
  '微观连接器绑定',
  '工具方案裁决',
]);

/** 任务 8.5：技术集成特征（供任务 9 Input 1） */
export function pickTask85PhysicalHookFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t85 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK85_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID ||
      id.includes('任务 8.5') ||
      id.includes('物理外挂')
    );
  });
  const feats = Array.isArray(t85?.features) ? t85.features : [];
  return feats.filter((f) => TASK85_FEATURE_KEYS.has(tokenKeyOne(String(f.tokenDisplay ?? ''))));
}

export { pickTask1Through4FeaturesFromGraphTasks };

/** 任务 0：落库后的工具原语 feature 行（`ft_*` + `tk_task0_*`） */
export function pickTask0FeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t0 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK0_LINE_TASK_ID ||
      id === LOGIC_GRAPH_TASK0_TITLE ||
      id.includes('任务 0')
    );
  });
  return Array.isArray(t0?.features) ? t0!.features! : [];
}

/** 将 sync 响应的 feature 行转为 task-graph TSV 行 */
export function task0SyncedFeaturesToGraphRows(
  features: ReadonlyArray<{
    featureId: string;
    tokenDisplay?: string;
    featureKey?: string;
    operator?: string;
    value?: string;
  }>,
): Task2L1TaskGraphFeatureRow[] {
  return features.map((f) => ({
    featureId: f.featureId,
    tokenDisplay: f.tokenDisplay || f.featureKey || '',
    operator: f.operator || '工具原语',
    name: f.value || '',
  }));
}

export function buildTask85PhysicalHookInferenceUserBlock(
  task85Input1Features: Task2L1TaskGraphFeatureRow[],
  tool0Features: Task2L1TaskGraphFeatureRow[],
  task1Through4Features: Task2L1TaskGraphFeatureRow[],
  deepInsightText?: string,
  userRectificationText?: string,
): string {
  const insightRaw = String(deepInsightText ?? '').replace(/\r\n/g, '\n').trim();
  const insightBody = insightRaw || '（暂无）';
  const rectRaw = String(userRectificationText ?? '').replace(/\r\n/g, '\n').trim();
  const rectBody = rectRaw || '（暂无）';
  const input1ColHint = task85Input1Features.some((f) => String(f.validationStatus ?? '').trim())
    ? '协作节点段六列：FeatureID、TokenStr、Operator、Value、Predecessor_Value、Validation_Status；状态转移矩阵段五列含 Validation_Status'
    : '四列：FeatureID、TokenStr、Operator、Value（协作节点段另含 Predecessor_Value）';

  return `【任务 8.5 L4.7 微观协同动作技术外挂集成打标｜来自设计详情推理图 GET /design-detail/task-graph】
说明：Input 1 ${input1ColHint}。须对 Input 1 中全部「协作节点」100% 穷举打标；每条 Target_KV 的 Evidence_Support_Chain 须同时引用 Input 1 协作节点 FeatureID 与 Input 2 任务 0 FeatureID（各至少 1 条）。**Token_Validation_Mapping.Target_FeatureID** 仅能引用任务 1 节点 \`ft_\`+12 位 ID（由服务端落库校验）。输出须为 \`L4_7_Tech_Integration_Matrix.Target_KV\` 数组，\`Feature_Key\` 仅允许「界面交互层」「数据承载层」「衔接互动层」；须行级中继 Validation_Status；须输出 \`Causality_Analysis\`。

Input 1：★ 任务 7 & 任务 8 协作节点与状态转移矩阵（全量行为打标边界）：
${formatTask85Input1TsvLines(task85Input1Features)}

Input 2：★【任务 0 可选工具箱原语解构结果】（FeatureID 须原样引用 ft_+12 位，勿改写）：
${formatFeatureTsvLines(tool0Features)}

Input 3：★ 任务 1~4 全局商业基本面基因特征（核心对冲过滤器；须含 [所有制]、[合规约束等级]、[管控复杂度]、[数字化成熟度预期]、[资产属性特征]）：
${formatFeatureTsvLines(task1Through4Features)}

Input 4：深访洞察（非结构化纯文本）：
${insightBody}

Input 5：用户纠偏输入（非结构化纯文本 - 最高优先级反馈渠道）：
${rectBody}`;
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask85L475DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
