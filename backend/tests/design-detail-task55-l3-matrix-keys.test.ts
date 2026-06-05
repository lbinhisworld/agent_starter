import { describe, expect, it } from 'vitest';
import {
  normalizeTask55L3MappedFeatureKey,
  parseTask5L5VsmTargetKvSyncRows,
  parseTokenValidationMappingFromL35VsmInferenceRaw,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task55-l3-matrix-keys', () => {
  it('normalizes Mapped_L5_Feature and legacy stage keys to 价值流阶段', () => {
    expect(normalizeTask55L3MappedFeatureKey('价值流阶段')).toBe('价值流阶段');
    expect(normalizeTask55L3MappedFeatureKey('价值流阶段_25')).toBe('价值流阶段');
    expect(normalizeTask55L3MappedFeatureKey('宏观业务流程模式')).toBe(null);
  });

  it('parses L3_Value_Stream_Matrix root with structured Feature_Value', () => {
    const raw = JSON.stringify({
      L3_Value_Stream_Matrix: {
        Target_KV: [
          {
            Feature_Key: '价值流阶段',
            Operator: '等于',
            Feature_Value: {
              phase_name: '商务接单',
              order_index: 1,
              classified_workflows: [
                { workflow_feature_id: 'ft_000000000701', workflow_name: '测试工作流' },
              ],
              phase_business_essence: '测试',
            },
            Validation_Status: 'Pending',
          },
        ],
      },
    });
    const parsed = parseTask5L5VsmTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.featureKey).toBe('价值流阶段');
  });

  it('parses unified 价值流阶段 rows with Validation_Status', () => {
    const raw = JSON.stringify({
      L3_5_VSM_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '价值流阶段',
            Operator: '等于',
            Feature_Value: '客户紧急变单与意向提报受理阶段',
            Validation_Status: 'Resolved_By_Customer',
          },
          {
            Feature_Key: '价值流阶段',
            Operator: '等于',
            Feature_Value: '基础主数据变更与安全限额控制阶段',
            Validation_Status: 'Pending',
          },
        ],
      },
    });
    const parsed = parseTask5L5VsmTargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows.every((r) => r.featureKey === '价值流阶段')).toBe(true);
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
  });

  it('parses three unified 价值流阶段 rows with distinct structured phase_name', () => {
    const raw = JSON.stringify({
      L3_Value_Stream_Matrix: {
        Target_KV: [
          {
            Feature_Key: '价值流阶段',
            Operator: '等于',
            Feature_Value: { phase_name: '阶段甲', order_index: 1 },
          },
          {
            Feature_Key: '价值流阶段',
            Operator: '等于',
            Feature_Value: { phase_name: '阶段乙', order_index: 2 },
          },
          {
            Feature_Key: '价值流阶段',
            Operator: '等于',
            Feature_Value: { phase_name: '阶段丙', order_index: 3 },
          },
        ],
      },
    });
    const parsed = parseTask5L5VsmTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((r) => r.featureKey)).toEqual(['价值流阶段', '价值流阶段', '价值流阶段']);
  });

  it('parses Token_Validation_Mapping with Mapped_L5_Feature', () => {
    const raw = JSON.stringify({
      L3_5_VSM_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '价值流阶段',
            Operator: '等于',
            Feature_Value: '阶段A',
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_000000000055',
            Mapped_L5_Feature: '价值流阶段',
            Consistency: '已通过纠偏修正',
            interview_question: 'N/A',
          },
        ],
      },
    });
    const plans = parseTokenValidationMappingFromL35VsmInferenceRaw(raw);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.mappedL1FeatureKey).toBe('价值流阶段');
  });
});
