/**
 * [INPUT]: `GET …/design-detail/task-graph` 中任务 2~4、任务 5 与任务 1 特征；任务 5.1 深访/纠偏 localStorage
 * [OUTPUT]: 任务 5.1 L3 大模型 **user** 文本块；进度区截断 **`truncateTask51L3DebugProgressText`**
 * [POS]: 设计详情任务 5.1；与 `designDetailL51ValuePropositionSystemPrompt.js` Input 1/2 对齐
 *
 * [PROTOCOL]: Input 1＝L2/L2.5（任务 2~4）+ 任务 5 历史结构化特征；Input 2＝任务 1~4 前线口白纪要（任务 1 结构化 TSV + 深访/纠偏纯文本；任务 2~4 微观已归纳见 Input 1）
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

/** 供任务 5.1 L3 大模型 **user** 消息 */
export function buildTask51ValuePropositionInferenceUserBlock(
  task1Features: Task2L1TaskGraphFeatureRow[],
  task2Features: Task2L1TaskGraphFeatureRow[],
  task3Features: Task2L1TaskGraphFeatureRow[],
  task4Features: Task2L1TaskGraphFeatureRow[] = [],
  task5Features: Task2L1TaskGraphFeatureRow[] = [],
  deepInsightText?: string,
  userRectificationText?: string,
  upstreamConsistencyByTask1FeatureId?: ReadonlyMap<string, string>,
): string {
  const input1Lines = [...task2Features, ...task3Features, ...task4Features, ...task5Features];
  const colHint =
    input1Lines.some((f) => String(f.validationStatus ?? '').trim()) ||
    task1Features.some((f) => String(f.validationStatus ?? '').trim())
      ? '五列：FeatureID、TokenStr、Operator、Value、Validation_Status'
      : '五列：FeatureID、TokenStr、Operator、Value、Consistency（或 Validation_Status 落库后自动扩列）';

  const insightRaw = String(deepInsightText ?? '').replace(/\r\n/g, '\n').trim();
  const rectRaw = String(userRectificationText ?? '').replace(/\r\n/g, '\n').trim();
  const narrativeBlocks: string[] = [];
  if (insightRaw) narrativeBlocks.push(`【深访洞察补充（非结构化）】\n${insightRaw}`);
  if (rectRaw) narrativeBlocks.push(`【用户纠偏补充（非结构化）】\n${rectRaw}`);
  const narrativeSuffix = narrativeBlocks.length ? `\n\n${narrativeBlocks.join('\n\n')}` : '';

  return `【任务 5.1 L3 战略价值主张与业务能力单元推理输入｜来自设计详情推理图 GET /design-detail/task-graph】
说明：结构化 Feature 段以制表符（Tab）分隔，${colHint}。

Input 1：★【L1/L2/L2.5 推理结果及任务 5 历史输出结果（结构化 Feature 列表）】：
${formatFeatureTsvLines(input1Lines)}

Input 2：★【任务 1~4 全局原始前线协同口白与痛点纪要】（任务 1 为结构化萃取后的前线事实全集；任务 2~4 微观口白已在上游 L2/L2.5 归纳，见 Input 1）：
${formatFeatureTsvLines(task1Features, upstreamConsistencyByTask1FeatureId)}${narrativeSuffix}`;
}

const DEFAULT_PROGRESS_CAP = 100_000;

export function truncateTask51L3DebugProgressText(body: string, maxLen = DEFAULT_PROGRESS_CAP): string {
  const s = String(body ?? '');
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}\n\n…（以下已截断）`;
}
