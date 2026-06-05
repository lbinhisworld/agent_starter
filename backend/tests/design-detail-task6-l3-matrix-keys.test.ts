import { describe, expect, it } from 'vitest';
import {
  normalizeTask6L3MappedFeatureKey,
  parseTask6L3ScenarioTargetKvSyncRows,
  parseTokenValidationMappingFromL6ScenarioInferenceRaw,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task6-l3-matrix-keys', () => {
  it('normalizes Mapped_L3_Feature and legacy keys to 关键场景', () => {
    expect(normalizeTask6L3MappedFeatureKey('关键场景')).toBe('关键场景');
    expect(normalizeTask6L3MappedFeatureKey('关键场景_3')).toBe('关键场景');
    expect(normalizeTask6L3MappedFeatureKey('价值流阶段')).toBe(null);
  });

  it('parses unified 关键场景 rows with Validation_Status', () => {
    const raw = JSON.stringify({
      L3_Scenario_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '关键场景',
            Operator: '等于',
            Feature_Value: '跨地域变单特批下的多方协同安全准入场景',
            Validation_Status: 'Resolved_By_Customer',
          },
          {
            Feature_Key: '关键场景',
            Operator: '等于',
            Feature_Value: '基于主从主数据联动的全局防呆与安全卡控场景',
            Validation_Status: 'Pending',
          },
        ],
      },
    });
    const parsed = parseTask6L3ScenarioTargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows.every((r) => r.featureKey === '关键场景')).toBe(true);
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
  });

  it('parses Token_Validation_Mapping with Mapped_L3_Feature', () => {
    const raw = JSON.stringify({
      L3_Scenario_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '关键场景',
            Operator: '等于',
            Feature_Value: '场景A',
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_000000000055',
            Mapped_L3_Feature: '关键场景',
            Consistency: '已通过纠偏修正',
            interview_question: 'N/A',
          },
        ],
      },
    });
    const plans = parseTokenValidationMappingFromL6ScenarioInferenceRaw(raw);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.mappedL1FeatureKey).toBe('关键场景');
  });
});
