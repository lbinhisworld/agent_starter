import { describe, expect, it } from 'vitest';
import {
  normalizeTask85L475MappedFeatureKey,
  parseTask85L475PhysicalHookTargetKvSyncRows,
  parseTokenValidationMappingFromL85PhysicalHookInferenceRaw,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task85-l47-matrix-keys', () => {
  it('normalizes Mapped_L3_Feature to L4.7 keys', () => {
    expect(normalizeTask85L475MappedFeatureKey('数据承载层')).toBe('数据承载层');
    expect(normalizeTask85L475MappedFeatureKey('衔接互动层')).toBe('衔接互动层');
    expect(normalizeTask85L475MappedFeatureKey('状态转移矩阵')).toBe(null);
  });

  it('parses L4.7 rows with Validation_Status and dual-source evidence', () => {
    const raw = JSON.stringify({
      L4_7_Tech_Integration_Matrix: {
        Target_KV: [
          {
            Feature_Key: '衔接互动层',
            Operator: '等于',
            Feature_Value: '低代码流程引擎级联企业微信机器人异常状态变单气泡通知流',
            Validation_Status: 'Resolved_By_Customer',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000803',
                tokenstr: '状态转移矩阵',
                value: '[NONE] ──(动作A)──> [待校验]',
                logic: '纵向',
              },
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000001502',
                tokenstr: '工具提供连接器',
                value: 'Webhook',
                logic: '横向',
              },
            ],
          },
        ],
      },
    });
    const parsed = parseTask85L475PhysicalHookTargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
    expect(parsed.rows[0]?.evidenceLinks?.length).toBeGreaterThanOrEqual(2);
  });

  it('parses Token_Validation_Mapping with Mapped_L3_Feature', () => {
    const raw = JSON.stringify({
      L4_7_Tech_Integration_Matrix: {
        Target_KV: [
          {
            Feature_Key: '数据承载层',
            Operator: '等于',
            Feature_Value: '精度协议',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000804',
                tokenstr: '状态转移矩阵',
                value: 'stm',
                logic: 'a',
              },
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000001506',
                tokenstr: '工具',
                value: 'tool',
                logic: 'b',
              },
            ],
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_000000000055',
            Mapped_L3_Feature: '数据承载层',
            Consistency: '已通过纠偏修正',
            interview_question: 'N/A',
          },
        ],
      },
    });
    const plans = parseTokenValidationMappingFromL85PhysicalHookInferenceRaw(raw);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.mappedL1FeatureKey).toBe('数据承载层');
  });
});
