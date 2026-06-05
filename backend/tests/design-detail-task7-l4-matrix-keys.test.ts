import { describe, expect, it } from 'vitest';
import {
  normalizeL4CollaborationInferenceRawForServerSync,
  normalizeTask7L4MappedFeatureKey,
  parseTask7L4CollaborationTargetKvSyncRows,
  parseTokenValidationMappingFromL7CollaborationInferenceRaw,
  task7SyncRowFeatureValueLabel,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

const sampleFeatureValue = {
  current_process_step_name: '车间机台柔性派工排产',
  belonging_value_phase: '车间排产',
  selected_it_tool_proposal: {
    ui_layout_interface_tool: '低代码表单视图',
    data_schema_storage_base: '表单类产品重存储',
    integration_behavior_hook: 'Webhook 通知',
  },
  technical_selection_rationale: '数据量超 10 万行须重存储。',
  achieved_business_impact: '从手工改为系统自动排产与看板展示。',
};

describe('design-detail-task7-l4-matrix-keys', () => {
  it('normalizes Mapped_L3_Feature to 协作节点 and IT selection keys', () => {
    expect(normalizeTask7L4MappedFeatureKey('协作节点')).toBe('协作节点');
    expect(normalizeTask7L4MappedFeatureKey('所属业务流程')).toBe('所属业务流程');
    expect(normalizeTask7L4MappedFeatureKey('交互工具选型')).toBe('交互工具选型');
    expect(normalizeTask7L4MappedFeatureKey('存储工具选型')).toBe('存储工具选型');
    expect(normalizeTask7L4MappedFeatureKey('关键场景')).toBe(null);
  });

  it('parses L4_Form_Layout_Matrix rows with structured Feature_Value and expands IT selection', () => {
    const raw = JSON.stringify({
      L4_Form_Layout_Matrix: {
        Target_KV: [
          {
            Feature_Key: '协作节点',
            Operator: '等于',
            Feature_Value: sampleFeatureValue,
            Validation_Status: 'Resolved_By_Customer',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000225',
                tokenstr: '价值流阶段/车间排产',
                logic: '横向车道',
              },
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000865',
                tokenstr: '流程优化Gap方案/车间排产-Gap方案',
                logic: '6.5 处方',
              },
            ],
          },
        ],
      },
    });
    const parsed = parseTask7L4CollaborationTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(6);
    expect(parsed.rows[0]?.featureKey).toBe('协作节点');
    expect(parsed.rows.some((r) => r.featureKey === '交互工具选型')).toBe(true);
    expect(parsed.rows.some((r) => r.featureKey === '存储工具选型')).toBe(true);
    const parentRow = parsed.rows.find((r) => r.featureKey === '协作节点');
    expect(parentRow?.validationStatus).toBe('Resolved_By_Customer');
    expect(task7SyncRowFeatureValueLabel(parentRow?.featureValue)).toBe('车间机台柔性派工排产');
    expect(parentRow?.featureValue).toContain('current_process_step_name');
  });

  it('normalizes L4_Form_Layout_Matrix for server sync', () => {
    const raw = JSON.stringify({
      L4_Form_Layout_Matrix: {
        Target_KV: [
          {
            Feature_Key: '协作节点',
            Operator: '等于',
            Feature_Value: sampleFeatureValue,
            Evidence_Support_Chain: [
              { SourceType: 'Derived_Feature', FeatureID: 'ft_000000000225', logic: 'a' },
              { SourceType: 'Derived_Feature', FeatureID: 'ft_000000000865', logic: 'b' },
            ],
          },
        ],
      },
    });
    const norm = normalizeL4CollaborationInferenceRawForServerSync(raw);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    expect(norm.normalized).toContain('L4_Form_Layout_Matrix');
  });

  it('parses Token_Validation_Mapping with Mapped_L3_Feature', () => {
    const raw = JSON.stringify({
      L4_Form_Layout_Matrix: {
        Target_KV: [
          {
            Feature_Key: '协作节点',
            Operator: '等于',
            Feature_Value: sampleFeatureValue,
            Evidence_Support_Chain: [
              { SourceType: 'Derived_Feature', FeatureID: 'ft_000000000225', logic: 'a' },
              { SourceType: 'Derived_Feature', FeatureID: 'ft_000000000865', logic: 'b' },
            ],
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_000000000055',
            Mapped_L3_Feature: '协作节点',
            Consistency: '已通过纠偏修正',
            interview_question: 'N/A',
          },
        ],
      },
    });
    const plans = parseTokenValidationMappingFromL7CollaborationInferenceRaw(raw);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.mappedL1FeatureKey).toBe('协作节点');
  });

  it('still parses legacy L4_Collaboration_Inference_Matrix', () => {
    const raw = JSON.stringify({
      L4_Collaboration_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '协作节点',
            Operator: '等于',
            Feature_Value: '动作A',
            Evidence_Support_Chain: [
              {
                SourceType: 'Derived_Feature',
                FeatureID: 'ft_000000000206',
                tokenstr: '关键场景',
                value: '场景A',
                logic: 'y',
              },
            ],
          },
        ],
      },
    });
    const parsed = parseTask7L4CollaborationTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows.some((r) => r.featureKey === '协作节点')).toBe(true);
  });
});
