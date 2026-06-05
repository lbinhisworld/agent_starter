import { describe, expect, it } from 'vitest';
import {
  normalizeTask4L2ValueMatrixFeatureKey,
  parseTask4L2TargetKvSyncRows,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task4-l2-matrix-keys', () => {
  it('normalizes legacy Feature_Key aliases', () => {
    expect(normalizeTask4L2ValueMatrixFeatureKey('核心价值驱动')).toBe('核心价值驱动');
    expect(normalizeTask4L2ValueMatrixFeatureKey('业务价值焦点')).toBe('账面焦点');
    expect(normalizeTask4L2ValueMatrixFeatureKey('账面焦点')).toBe('账面焦点');
  });

  it('parses four-key Target_KV with Validation_Status', () => {
    const raw = JSON.stringify({
      L2_Value_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '核心价值驱动',
            Operator: '等于',
            Feature_Value: '跨境风控与精益周转双核驱动',
            Validation_Status: 'Resolved_By_Customer',
          },
          {
            Feature_Key: '运营重心',
            Operator: '等于',
            Feature_Value: '跨境结算风控与库存周转协同',
            Validation_Status: 'Resolved_By_Customer',
          },
          {
            Feature_Key: '账面焦点',
            Operator: '等于',
            Feature_Value: '坏账率与跨境资金占用双指标',
            Validation_Status: 'Pending',
          },
          {
            Feature_Key: '数字化成熟度预期',
            Operator: '等于',
            Feature_Value: '流程级（部门协同）',
            Validation_Status: 'Pending',
          },
        ],
      },
    });
    const parsed = parseTask4L2TargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
    expect(parsed.rows.map((r) => r.featureKey)).toContain('账面焦点');
  });
});
