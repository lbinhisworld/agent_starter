/**
 * [INPUT]: 推理图任务 9 场景大伞、任务 8 协作网格、任务 1 化石、深访/纠偏（可选）
 * [OUTPUT]: 任务 10 L5 行为驱动场景化事实 Schema / TVM 大模型 user 块
 * [POS]: `runTask10L5TechnicalDdlPipeline` 拼装 LLM 输入
 *
 * [PROTOCOL]: 与 `designDetailL5TechnicalDdlSystemPrompt.js` Input 1–3 对齐；Input 1=任务9 / Input 2=任务8 / Input 3=任务1；**场景化主外键**须与后端 sync/ER 图解析一致
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  formatFeatureTsvLines,
  pickTask7CollaborationNodesOnlyFromGraphTasks,
} from './buildTask8L45PrototypeInferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID_LEGACY,
} from './designDetailLogicGraphMerge';

function tokenKeyOne(tokenDisplay: string): string {
  const td = String(tokenDisplay ?? '').trim();
  return td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
}

/** Input 1：任务 9 系统一级模块大伞（含 Tech_Host_Platform 已落库于 value JSON） */
export function pickTask9SystemModuleFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t9 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK9_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID ||
      id === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID_LEGACY ||
      id.includes('任务 9')
    );
  });
  const feats = Array.isArray(t9?.features) ? t9.features : [];
  return feats.filter((f) => tokenKeyOne(String(f.tokenDisplay ?? '')) === '系统一级模块');
}

/** Input 3：任务 1 全集（跨代 TVM 咬合源头化石） */
export function pickTask1FeaturesFromGraphTasksForTask10(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t1 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return id === 'customer_basic' || id.includes('任务 1') || id.includes('客户基本');
  });
  return Array.isArray(t1?.features) ? t1.features : [];
}

const TASK8_MICRO_GRID_TOKEN_KEYS = new Set(['操作角色', '单据对象', '状态转移矩阵']);

/** 任务 8：操作角色 / 单据对象 / 状态转移矩阵（RBAC 与 STM） */
export function pickTask8RbacAndStmFeaturesFromGraphTasks(
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
  return feats.filter((f) => TASK8_MICRO_GRID_TOKEN_KEYS.has(tokenKeyOne(String(f.tokenDisplay ?? ''))));
}

/** Input 2：任务 8 微观协作节点动作网格 + 有限状态机变迁（协作节点 + RBAC + STM） */
export function pickTask8MicroActionGridFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const collab = pickTask7CollaborationNodesOnlyFromGraphTasks(tasks);
  const rbacStm = pickTask8RbacAndStmFeaturesFromGraphTasks(tasks);
  return [...collab, ...rbacStm];
}

/** @deprecated 请用 pickTask8MicroActionGridFeaturesFromGraphTasks */
export function pickTask78And85MicroActionFeaturesFromGraphTasks(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  return pickTask8MicroActionGridFeaturesFromGraphTasks(tasks);
}

const TASK10_DEBUG_MAX_CHARS = 12_000;

export function truncateTask10L5DebugProgressText(text: string): string {
  const s = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!s.length) return '（模型无输出）';
  if (s.length <= TASK10_DEBUG_MAX_CHARS) return s;
  return `${s.slice(0, TASK10_DEBUG_MAX_CHARS)}\n\n…（以下已截断）`;
}

export type BuildTask10L5InferenceUserBlockOpts = {
  deepInsightText?: string;
  userRectificationText?: string;
};

export function buildTask10L5TechnicalDdlInferenceUserBlock(
  task9ModuleFeatures: Task2L1TaskGraphFeatureRow[],
  task8MicroGridFeatures: Task2L1TaskGraphFeatureRow[],
  task1Features: Task2L1TaskGraphFeatureRow[],
  opts?: BuildTask10L5InferenceUserBlockOpts,
): string {
  const deepInsight = String(opts?.deepInsightText ?? '').trim() || '（无）';
  const rectification = String(opts?.userRectificationText ?? '').trim() || '（无）';
  const input2ColHint = task8MicroGridFeatures.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
    : '四列：FeatureID、TokenStr、Operator、Value';
  const input3ColHint = task1Features.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
    : '四列：FeatureID、TokenStr、Operator、Value';

  return `【任务 10 L5 行为驱动场景化事实 Schema / 纯中文防逃逸 / 场景化主外键 / TVM 推理输入】
说明：须输出 \`L5_Data_Architecture_Matrix\`；\`Target_KV\` 每行 \`Feature_Key=物理技术Schema\`，且 \`Feature_Value\` **必须为内嵌四大要素（table_metadata / columns / row_level_security / data_initialization）的标准 JSON 字符串**（外部大 JSON 须正确转义）。
★ **行为驱动建表**：从 Input 1 场景一级模块大伞垂直索证 Input 2 任务 8 协作节点/角色/状态机，硬化为主从业务事实表 Schema；**table_name 须对齐任务 9 场景大伞名称**。
★ **命名红线**：\`table_name\` / \`field_name\` **禁止英文字母与 snake_case**（严禁 \`insertion_order_main\`、\`id\`、\`status\`、\`关联主表流水键\`）。
★ **场景化主外键**：
  - 主键：\`[表名/场景]编码\` 或 \`唯一标识\`；\`data_type\` = **\`主键\`**。
  - 外键：具象业务纽带中文名（如「插单号」）；\`data_type\` = **\`外键\`**；\`constraints\` = **\`外键，关联至[目标表名]的[主键字段名]字段\`**。
★ \`data_type\` 仅允许：主键 / 外键 / 单行文本 / 长文本 / 高精度数值(2位或8位小数) / 日期时间。
化石 \`Validation_Status=Resolved_By_Customer\` 时方案 A 免疫（\`Consistency=已通过纠偏修正\`、\`interview_question=N/A\`）。Input 2 ${input2ColHint}；Input 3 ${input3ColHint}。Input 4/5 为深访/纠偏纯文本，纠偏优先。

Input 1：★ 任务 9 场景化一级模块大伞（含 Tech_Host_Platform、Validation_Status，全量）：
${formatFeatureTsvLines(task9ModuleFeatures)}

Input 2：★ 任务 8 微观协作节点动作网格与有限状态机变迁全集（协作节点 / 操作角色 / 单据对象 / 状态转移矩阵，全量）：
${formatFeatureTsvLines(task8MicroGridFeatures)}

Input 3：★ 任务 1 原始特征集全集（跨代 TVM 咬合源头化石；ft_ 后接 12 位纯数字，全量）：
${formatFeatureTsvLines(task1Features)}

Input 4：深访洞察（非结构化纯文本）：
${deepInsight}

Input 5：用户纠偏输入（非结构化纯文本 - 最高优先级）：
${rectification}`;
}

/** @deprecated 请用 pickTask78And85MicroActionFeaturesFromGraphTasks */
export function pickTask85FeaturesForTask10(): Task2L1TaskGraphFeatureRow[] {
  return [];
}
