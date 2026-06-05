/**
 * [INPUT]: `GET …/design-detail/task-graph` 中任务 1、3 的 `features[]`；**Input 3** `readTask4L2DeepInsightText`；**Input 4** `readTask4L2UserRectificationText`
 * [OUTPUT]: 任务 4 L2 大模型 **user** 文本块；进度区截断 **`truncateTask4L2DebugProgressText`**
 * [POS]: 设计详情任务 4 L2；与 `designDetailL4L2ValueDriverSystemPrompt.js` Input 1–4 对齐
 *
 * [PROTOCOL]: Input 1＝任务 1 原始特征集；Input 2＝任务 3 业务属性（含 Validation_Status）；TVM **Target_FeatureID** 仅来自 Input 1 第一列
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

function escapeTsvCell(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t\n\r]/g, ' ')
    .trim();
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

/** 供任务 4 L2 大模型 **user** 消息 */
export function buildTask4L2InferenceUserBlock(
  task1Features: Task2L1TaskGraphFeatureRow[],
  task3Features: Task2L1TaskGraphFeatureRow[],
  deepInsightText?: string,
  userRectificationText?: string,
  upstreamConsistencyByTask1FeatureId?: ReadonlyMap<string, string>,
): string {
  const insightRaw = String(deepInsightText ?? '').replace(/\r\n/g, '\n').trim();
  const insightBody = insightRaw || '（暂无）';
  const rectRaw = String(userRectificationText ?? '').replace(/\r\n/g, '\n').trim();
  const rectBody = rectRaw || '（暂无）';
  const colHint = task1Features.some((f) => String(f.validationStatus ?? '').trim()) ||
    task3Features.some((f) => String(f.validationStatus ?? '').trim())
    ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
    : '五列：FeatureID、TokenStr、Operator、Value、Consistency（或 Validation_Status 落库后自动扩列）';

  return `【任务 4 L2 价值链分析推理输入｜来自设计详情推理图 GET /design-detail/task-graph】
说明：下列每一行为一条特征，以制表符（Tab）分隔，${colHint}。

Input 1：任务 1 原始特征集全集（★跨代 TVM 源头物证；**Token_Validation_Mapping.Target_FeatureID 仅能取自本段 TSV 第一列**）：
${formatFeatureTsvLines(task1Features, upstreamConsistencyByTask1FeatureId)}

Input 2：★【任务 3 节点 Feature 列表全集】（本步前向顺推直接因果源头；行级 **Validation_Status** 须中继透传至 Target_KV）：
${formatFeatureTsvLines(task3Features)}

Input 3：深访洞察（非结构化纯文本）：
${insightBody}

Input 4：用户纠偏输入（非结构化纯文本）：
${rectBody}`;
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask4L2DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
