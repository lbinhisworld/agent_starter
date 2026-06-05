import { describe, expect, it } from 'vitest';
import {
  normalizeL5BlueprintInferenceRawForServerSync,
  normalizeTask9L5MappedFeatureKey,
  parseTask9L5BlueprintTargetKvSyncRows,
  parseTokenValidationMappingFromL9BlueprintInferenceRaw,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

const SAMPLE_DOMAIN_MATRIX = JSON.stringify({
  L5_Blueprint_Domain_Matrix: {
    Target_KV: [
      {
        Feature_Key: '系统一级模块',
        Operator: '等于',
        Feature_Value: '排产变更控制模块',
        value_ref_domain: '排产变更控制模块',
        Tech_Host_Platform: '七巧低代码平台容器',
        Evidence_Support_Chain: [
          {
            SourceType: 'Derived_Feature',
            FeatureID: 'ft_000000000912',
            tokenstr: '技术组件映射',
            value: '岗位鉴权硬绑定企业微信外部用户体系',
            logic: '单据重力收拢',
          },
        ],
        Inference_Weight: 1.0,
        inference_summary: '宏观大伞',
      },
    ],
    Token_Validation_Mapping: [],
  },
});

describe('design-detail-task9-l5-matrix-keys', () => {
  it('normalizes Mapped_L5_Feature to 系统一级模块', () => {
    expect(normalizeTask9L5MappedFeatureKey('系统一级模块')).toBe('系统一级模块');
    expect(normalizeTask9L5MappedFeatureKey('数据承载层')).toBe(null);
  });

  it('parses Validation_Status on module rows', () => {
    const raw = JSON.stringify({
      L5_Blueprint_Domain_Matrix: {
        Target_KV: [
          {
            Feature_Key: '系统一级模块',
            Operator: '等于',
            Feature_Value: '核心单据履约与多阶变更控制模块',
            Tech_Host_Platform: '七巧低代码平台容器',
            Validation_Status: 'Resolved_By_Customer',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000912',
                tokenstr: '衔接互动层',
                value: 'hook',
                logic: '收拢',
              },
            ],
            Inference_Weight: 1.0,
          },
        ],
      },
    });
    const parsed = parseTask9L5BlueprintTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
  });

  it('parses Token_Validation_Mapping with Mapped_L5_Feature', () => {
    const raw = JSON.stringify({
      L5_Blueprint_Domain_Matrix: {
        Target_KV: [
          {
            Feature_Key: '系统一级模块',
            Operator: '等于',
            Feature_Value: '模块A',
            Tech_Host_Platform: '平台A',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
            Inference_Weight: 1,
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_000000000055',
            Mapped_L5_Feature: '系统一级模块',
            Consistency: '已通过纠偏修正',
            interview_question: 'N/A',
          },
        ],
      },
    });
    const plans = parseTokenValidationMappingFromL9BlueprintInferenceRaw(raw);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.mappedL1FeatureKey).toBe('系统一级模块');
  });
});

describe('parseTask9L5BlueprintTargetKvSyncRows', () => {
  it('accepts L5_Blueprint_Domain_Matrix with Tech_Host_Platform', () => {
    const parsed = parseTask9L5BlueprintTargetKvSyncRows(SAMPLE_DOMAIN_MATRIX);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.featureKey).toBe('系统一级模块');
    expect(parsed.rows[0]?.techHostPlatform).toBe('七巧低代码平台容器');
  });

  it('rejects secondary menu rows in V4.1 contract', () => {
    const raw = JSON.stringify({
      L5_Blueprint_Domain_Matrix: {
        Target_KV: [
          {
            Feature_Key: '系统一级模块',
            Operator: '等于',
            Feature_Value: '模块A',
            Tech_Host_Platform: '平台A',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
            Inference_Weight: 1,
          },
          {
            Feature_Key: '二级功能菜单',
            Operator: '等于',
            Feature_Value: '菜单A',
            Belongs_To_Primary_Module: '模块A',
            Evidence_Support_Chain: [
              { FeatureID: 'ft_000000000002', logic: 'x' },
              { FeatureID: 'ft_000000000003', logic: 'y' },
            ],
            Inference_Weight: 0.9,
          },
        ],
      },
    });
    const parsed = parseTask9L5BlueprintTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain('二级功能菜单');
  });

  it('rejects module row without Tech_Host_Platform', () => {
    const raw = JSON.stringify({
      L5_Blueprint_Domain_Matrix: {
        Target_KV: [
          {
            Feature_Key: '系统一级模块',
            Operator: '等于',
            Feature_Value: '模块A',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
            Inference_Weight: 1,
          },
        ],
      },
    });
    const parsed = parseTask9L5BlueprintTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain('Tech_Host_Platform');
  });
});

describe('normalizeL5BlueprintInferenceRawForServerSync (task 9)', () => {
  it('normalizes domain matrix payload', () => {
    const norm = normalizeL5BlueprintInferenceRawForServerSync(SAMPLE_DOMAIN_MATRIX);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
    expect(obj.L5_Blueprint_Domain_Matrix).toBeTruthy();
  });
});
