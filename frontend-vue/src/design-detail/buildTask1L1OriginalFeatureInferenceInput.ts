/**
 * [INPUT]: 任务 1 三段原文（工商 / 需求会议 / 存量表头）
 * [OUTPUT]: `inferDesignDetailL1OriginalFeatureFromContext` 的 **user** 文本块（Input 1～3）
 * [POS]: 设计详情任务 1 L1 原始实然特征集；落库经 `POST …/sync-task1-l1-original-feature-matrix`
 *
 * [PROTOCOL]: 与 `designDetailL1OriginalFeatureSystemPrompt.js` 之 **# Input Context** 对齐
 */

export type BuildTask1L1OriginalFeatureUserBlockArgs = {
  input1BusinessText?: string;
  input2RequirementText?: string;
  input3SpreadsheetHeadersText?: string;
};

export function buildTask1L1OriginalFeatureInferenceUserBlock(
  args: BuildTask1L1OriginalFeatureUserBlockArgs,
): string {
  const i1 = String(args.input1BusinessText ?? '').trim() || '（无）';
  const i2 = String(args.input2RequirementText ?? '').trim() || '（无）';
  const i3 = String(args.input3SpreadsheetHeadersText ?? '').trim() || '（无）';
  return `【Input 1：工商与组织背景原文】
${i1}

【Input 2：前线需求会议与深访口水话原文】
${i2}

【Input 3：存量 Excel / 表单 / 账本表头列名清单】
${i3}`;
}
