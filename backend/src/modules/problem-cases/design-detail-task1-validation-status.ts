/**
 * [INPUT]: 任务 1 `DesignFeatureNode.value` JSON
 * [OUTPUT]: 合并行级 `Validation_Status` 后的 value 对象
 * [POS]: 对齐问卷提交后 Mutation 落库（与 `designDetailL3ScenarioSystemPrompt.js` 方案 A 一致）
 */

import { TASK1_VALIDATION_STATUS_RESOLVED_BY_CUSTOMER } from './design-detail-task1-l1-original-feature';

export { TASK1_VALIDATION_STATUS_RESOLVED_BY_CUSTOMER };

/** 将 `Validation_Status` 写入任务 1 特征 value（保留既有 Feature_Value 等字段） */
export function mergeValidationStatusIntoTask1FeatureValue(
  value: unknown,
  status: string = TASK1_VALIDATION_STATUS_RESOLVED_BY_CUSTOMER,
): Record<string, unknown> {
  const vs = String(status || '').trim() || TASK1_VALIDATION_STATUS_RESOLVED_BY_CUSTOMER;
  if (value === null || value === undefined) {
    return { Validation_Status: vs };
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        return mergeValidationStatusIntoTask1FeatureValue(JSON.parse(t) as unknown, vs);
      } catch {
        return { Feature_Value: t, Validation_Status: vs };
      }
    }
    return { Feature_Value: t, Validation_Status: vs };
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>), Validation_Status: vs };
  }
  return { Validation_Status: vs };
}
