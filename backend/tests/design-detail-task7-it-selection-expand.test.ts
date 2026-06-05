import { describe, expect, it } from 'vitest';
import {
  expandTask7L4CollaborationRowsToItSelectionFeatures,
  parseTask7L4CollaborationTargetKvSyncRows,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

const sampleFeatureValue = {
  current_process_step_name: '销售日常业绩简报',
  belonging_value_phase: '商务接单',
  selected_it_tool_proposal: {
    ui_layout_interface_tool: '智能表格轻量看板 + 企微推送',
    data_schema_storage_base: '智能表格类产品轻存储',
    integration_behavior_hook: '企微自动化任务连接器',
  },
  technical_selection_rationale: '轻量流水适合智能表格。',
  achieved_business_impact: '自动汇总预计收款并推送销售群。',
};

describe('expandTask7L4CollaborationRowsToItSelectionFeatures', () => {
  it('expands 协作节点 into five IT selection features plus parent row', () => {
    const parent = {
      featureKey: '协作节点',
      operator: '等于',
      featureValue: JSON.stringify(sampleFeatureValue),
      inferenceSummary: '汇总自证',
      inferenceWeight: 0.9,
      evidenceLinks: [
        {
          sourceFeatureId: 'ft_000000000222',
          weight: 0.5,
          logic: '阶段',
        },
        {
          sourceFeatureId: 'ft_000000000860',
          weight: 0.5,
          logic: 'gap',
        },
      ],
    };
    const out = expandTask7L4CollaborationRowsToItSelectionFeatures([parent]);
    expect(out.some((r) => r.featureKey === '协作节点')).toBe(true);
    expect(out.filter((r) => r.featureKey === '交互工具选型')).toHaveLength(1);
    expect(out.filter((r) => r.featureKey === '存储工具选型')).toHaveLength(1);
    expect(out.filter((r) => r.featureKey === '集成行为选型')).toHaveLength(1);
    expect(out.filter((r) => r.featureKey === '技术判断')).toHaveLength(1);
    expect(out.filter((r) => r.featureKey === '业务价值预判')).toHaveLength(1);
    const storage = out.find((r) => r.featureKey === '存储工具选型');
    expect(storage?.featureValue).toContain('智能表格类产品轻存储');
    expect(storage?.evidenceLinks?.[0]?.logic).toBe('汇总自证');
    expect(storage?.evidenceLinks?.[0]?.weight).toBe(0.9);
  });

  it('parseTask7 includes expanded rows', () => {
    const raw = JSON.stringify({
      L4_Form_Layout_Matrix: {
        Target_KV: [
          {
            Feature_Key: '协作节点',
            Operator: '等于',
            Feature_Value: sampleFeatureValue,
            Inference_Weight: 1,
            inference_summary: 'ok',
            Evidence_Support_Chain: [
              { SourceType: 'Derived_Feature', FeatureID: 'ft_000000000222', logic: 'a' },
              { SourceType: 'Derived_Feature', FeatureID: 'ft_000000000860', logic: 'b' },
            ],
          },
        ],
      },
    });
    const parsed = parseTask7L4CollaborationTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows.some((r) => r.featureKey === '交互工具选型')).toBe(true);
    expect(parsed.rows.length).toBeGreaterThanOrEqual(6);
  });
});
