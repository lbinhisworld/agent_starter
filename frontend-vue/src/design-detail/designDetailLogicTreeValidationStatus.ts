/**
 * [INPUT]: `DesignDetailLogicGraphFeatureDto`（含 `validationStatus` 或 `featureValue` 内 JSON）
 * [OUTPUT]: 解析行级 `Validation_Status`、判断是否 `Resolved_By_Customer`
 * [POS]: 逻辑树节点角标（`DesignDetailLogicTreeModal`）
 *
 * [PROTOCOL]: 与任务 1 L1 `Validation_Status` 落库口径一致；变更时同步 `DesignDetailLogicTreeModal.vue`
 */

import type { DesignDetailLogicGraphFeatureDto } from './designDetailLogicGraphMerge';

/** 从特征 DTO 读取 `Validation_Status`（顶层字段优先，其次 `featureValue` JSON） */
export function resolveLogicTreeFeatureValidationStatus(
  f: DesignDetailLogicGraphFeatureDto | null | undefined,
): string {
  if (!f) return '';
  const top = f.validationStatus ?? (f as { validation_status?: string }).validation_status;
  if (top != null && String(top).trim()) return String(top).trim();

  const raw = f.featureValue ?? (f as { feature_value?: unknown }).feature_value;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const v = o.Validation_Status ?? o.validation_status ?? o.validationStatus;
    if (v != null && String(v).trim()) return String(v).trim();
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{')) {
      try {
        const o = JSON.parse(t) as Record<string, unknown>;
        const v = o.Validation_Status ?? o.validation_status ?? o.validationStatus;
        if (v != null && String(v).trim()) return String(v).trim();
      } catch {
        /* ignore */
      }
    }
  }
  return '';
}

/** 方案 A：客户纠偏已消解（大小写/连字符不敏感） */
export function isLogicTreeResolvedByCustomerStatus(status: string): boolean {
  const n = String(status || '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
  return n === 'resolved_by_customer';
}

export function isLogicTreeFeatureResolvedByCustomer(
  f: DesignDetailLogicGraphFeatureDto | null | undefined,
): boolean {
  return isLogicTreeResolvedByCustomerStatus(resolveLogicTreeFeatureValidationStatus(f));
}
