import { describe, expect, it } from 'vitest';
import {
  normalizeTask8L45MappedFeatureKey,
  parseTask8L45PrototypeTargetKvSyncRows,
  parseTokenValidationMappingFromL8PrototypeInferenceRaw,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task8-l45-matrix-keys', () => {
  it('normalizes Mapped_L3_Feature to prototype keys', () => {
    expect(normalizeTask8L45MappedFeatureKey('操作角色')).toBe('操作角色');
    expect(normalizeTask8L45MappedFeatureKey('状态转移矩阵')).toBe('状态转移矩阵');
    expect(normalizeTask8L45MappedFeatureKey('协作节点')).toBe(null);
  });

  it('parses L4.5 rows with Validation_Status', () => {
    const raw = JSON.stringify({
      L4_Prototype_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '操作角色',
            Operator: '等于',
            Feature_Value: '前线接单业务员',
            Validation_Status: 'Resolved_By_Customer',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000316',
                tokenstr: '协作节点',
                value: '前线接单业务员发起核心业务主表单据头信息提交动作',
                logic: '权限',
              },
            ],
          },
          {
            Feature_Key: '单据对象',
            Operator: '等于',
            Feature_Value: '核心业务事实主表与时序明细从表级联数据体',
            Validation_Status: 'Resolved_By_Customer',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000316',
                tokenstr: '协作节点',
                value: '前线接单业务员发起核心业务主表单据头信息提交动作',
                logic: '对象',
              },
            ],
          },
        ],
      },
    });
    const parsed = parseTask8L45PrototypeTargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
  });

  it('parses Token_Validation_Mapping with Mapped_L3_Feature', () => {
    const raw = JSON.stringify({
      L4_Prototype_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '操作角色',
            Operator: '等于',
            Feature_Value: '角色A',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000316',
                tokenstr: '协作节点',
                value: '动作A',
                logic: 'x',
              },
            ],
          },
          {
            Feature_Key: '单据对象',
            Operator: '等于',
            Feature_Value: '对象A',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000316',
                tokenstr: '协作节点',
                value: '动作A',
                logic: 'y',
              },
            ],
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_000000000055',
            Mapped_L3_Feature: '状态转移矩阵',
            Consistency: '已通过纠偏修正',
            interview_question: 'N/A',
          },
        ],
      },
    });
    const plans = parseTokenValidationMappingFromL8PrototypeInferenceRaw(raw);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.mappedL1FeatureKey).toBe('状态转移矩阵');
  });
});
