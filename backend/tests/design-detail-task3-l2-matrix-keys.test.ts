import { describe, expect, it } from 'vitest';
import {
  normalizeTask3L2MappedFeatureKey,
  parseTask3L2TargetKvSyncRows,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task3-l2-matrix-keys', () => {
  it('normalizes legacy Mapped_L2_Feature aliases', () => {
    expect(normalizeTask3L2MappedFeatureKey('核心资产属性')).toBe('核心资产属性');
    expect(normalizeTask3L2MappedFeatureKey('资产属性特征')).toBe('核心资产属性');
    expect(normalizeTask3L2MappedFeatureKey('交付模式')).toBe('交付模式');
    expect(normalizeTask3L2MappedFeatureKey('交易交付模式')).toBe('交付模式');
    expect(normalizeTask3L2MappedFeatureKey('行业类别')).toBe('行业类别');
  });

  it('parses three-key Target_KV with Validation_Status', () => {
    const raw = JSON.stringify({
      L2_Business_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '核心资产属性',
            Operator: '等于',
            Feature_Value: '跨境重资金流动链接资产',
            Validation_Status: 'Resolved_By_Customer',
          },
          {
            Feature_Key: '交付模式',
            Operator: '等于',
            Feature_Value: '跨区域级联交付模式',
            Validation_Status: 'Pending',
          },
          {
            Feature_Key: '行业类别',
            Operator: '等于',
            Feature_Value: '跨境数字金融与贸易供应链服务业',
            Validation_Status: 'Resolved_By_Customer',
          },
        ],
      },
    });
    const parsed = parseTask3L2TargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((r) => r.featureKey).sort()).toEqual(
      ['交付模式', '核心资产属性', '行业类别'].sort(),
    );
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
  });
});
