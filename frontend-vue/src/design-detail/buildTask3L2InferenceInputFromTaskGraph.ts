/**
 * [INPUT]: `GET …/design-detail/task-graph` 中任务 1、2 的 `features[]`；**Input 3** `readTask3L2DeepInsightText`；**Input 4** `readTask3L2UserRectificationText`
 * [OUTPUT]: 任务 3 L2 大模型 **user** 文本块；进度区截断 **`truncateTask3L2DebugProgressText`**
 * [POS]: 设计详情任务 3 L2；与 `designDetailL3L2IndustryBusinessSystemPrompt.js` Input 1–4 对齐
 *
 * [PROTOCOL]: Input 1＝任务 2 L1 画像；Input 2.1/2.2＝任务 1 实然与痛点雷达；TVM **Target_FeatureID** 仅来自 Input 2 第一列
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import { isTask2L1PainPointRadarFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

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

/** 供任务 3 L2 大模型 **user** 消息 */
export function buildTask3L2InferenceUserBlock(
  task1Features: Task2L1TaskGraphFeatureRow[],
  task2Features: Task2L1TaskGraphFeatureRow[],
  deepInsightText?: string,
  userRectificationText?: string,
  upstreamConsistencyByTask1FeatureId?: ReadonlyMap<string, string>,
): string {
  const insightRaw = String(deepInsightText ?? '').replace(/\r\n/g, '\n').trim();
  const insightBody = insightRaw || '（暂无）';
  const rectRaw = String(userRectificationText ?? '').replace(/\r\n/g, '\n').trim();
  const rectBody = rectRaw || '（暂无）';

  const input21 = task1Features.filter((f) => !isTask2L1PainPointRadarFeatureRow(f));
  const input22 = task1Features.filter(isTask2L1PainPointRadarFeatureRow);
  const input2Total = task1Features.length;
  const painCount = input22.length;

  const colHint =
    task1Features.some((f) => String(f.validationStatus ?? '').trim()) ||
    task2Features.some((f) => String(f.validationStatus ?? '').trim())
      ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
      : '五列：FeatureID、TokenStr、Operator、Value、Consistency（或 Validation_Status 落库后自动扩列）';

  return `【任务 3 L2 推理输入｜来自设计详情推理图 GET /design-detail/task-graph】
说明：下列每一行为一条特征，以制表符（Tab）分隔，${colHint}。

Input 1：L1 推理结果（应然逻辑底座；任务 2 层级结构化 Feature 列表）：
${formatFeatureTsvLines(task2Features)}

Input 2：实然现状与核心痛点集合（来自任务 1；★ **Token_Validation_Mapping.Target_FeatureID 仅能取自下列 Input 2 TSV 第一列**）：
★ **全量审查**：\`Token_Validation_Mapping\` 须覆盖 Input 2 **全部**特征行（共 **${input2Total}** 条），其中 Input 2.2 痛点雷达/核心痛点总结 **${painCount}** 条。

Input 2.1：基础实然现状/业务流程特征：
${formatFeatureTsvLines(input21, upstreamConsistencyByTask1FeatureId)}

Input 2.2：★【任务 1 新生成的痛点雷达/核心痛点总结】（token 以 \`痛点雷达/\` 开头）：
${formatFeatureTsvLines(input22, upstreamConsistencyByTask1FeatureId)}

Input 3：深访洞察（非结构化纯文本）：
${insightBody}

Input 4：用户纠偏输入（非结构化纯文本 - 最高优先级反馈渠道）：
${rectBody}`;
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask3L2DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
