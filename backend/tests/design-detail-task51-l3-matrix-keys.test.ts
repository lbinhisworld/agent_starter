import { describe, expect, it } from 'vitest';
import {
  buildTask51IntraValuePropositionForwardLinks,
  normalizeTask51L3MappedFeatureKey,
  parseTask51L3TargetKvSyncRows,
  parseTokenValidationMappingFromL51ValuePropositionRaw,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task51-l3-matrix-keys', () => {
  it('normalizes Mapped_L5_Feature to 业务能力单元', () => {
    expect(normalizeTask51L3MappedFeatureKey('业务能力单元')).toBe('业务能力单元');
    expect(normalizeTask51L3MappedFeatureKey('核心价值主张')).toBe(null);
  });

  it('parses Value_Proposition synthetic rows and 业务能力单元 Target_KV', () => {
    const raw = JSON.stringify({
      L3_Value_Proposition_Matrix: {
        Value_Proposition: {
          core_value_claim: '高定制智力资产全案交付',
          delivery_model_character: '智力资产 / 敏捷订单交付模式',
        },
        Target_KV: [
          {
            Feature_Key: '业务能力单元',
            Operator: '等于',
            Feature_Value: '前线拉单与大客户意向管理单元（销售部）',
            business_function: '规范前线签约、堵住口头调价导致的坏账漏洞。',
            Validation_Status: 'Pending',
          },
        ],
      },
    });
    const parsed = parseTask51L3TargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows.length).toBeGreaterThanOrEqual(3);
    expect(parsed.rows.some((r) => r.featureKey === '核心价值主张')).toBe(true);
    expect(parsed.rows.some((r) => r.featureKey === '交付模式定性')).toBe(true);
    expect(parsed.rows.some((r) => r.featureKey === '业务能力单元')).toBe(true);
    const unit = parsed.rows.find((r) => r.featureKey === '业务能力单元');
    expect(unit?.businessFunction).toContain('坏账');
  });

  it('parses Evidence_Support_Chain on 业务能力单元 rows for forward-link sync', () => {
    const raw = JSON.stringify({
      L3_Value_Proposition_Matrix: {
        Target_KV: [
          {
            Feature_Key: '业务能力单元',
            Operator: '等于',
            Feature_Value: '单元A',
            Evidence_Support_Chain: [
              {
                SourceFeature: { FeatureID: 'ft_000000000002' },
                logic: '自任务 2 归纳',
                contribution: 1,
              },
            ],
          },
        ],
      },
    });
    const parsed = parseTask51L3TargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const unit = parsed.rows.find((r) => r.featureKey === '业务能力单元');
    expect(unit?.evidenceLinks?.length).toBe(1);
    expect(unit?.evidenceLinks?.[0]?.sourceFeatureId).toBe('ft_000000000002');
  });

  it('buildTask51IntraValuePropositionForwardLinks links VP rows to each capability unit', () => {
    const rows = [
      { featureKey: '核心价值主张', featureValue: '抢单与领料规范' },
      { featureKey: '交付模式定性', featureValue: '前线极速抢单' },
      {
        featureKey: '业务能力单元',
        featureValue: '前线拉单单元（销售部）',
        inferenceWeight: 0.9,
        causalitySummary: '销售部是抢单源头。',
      },
      {
        featureKey: '业务能力单元',
        featureValue: '车间插单单元（车间）',
        inferenceWeight: 0.8,
      },
    ];
    const fids = ['ft_vp_core', 'ft_vp_delivery', 'ft_cap_a', 'ft_cap_b'];
    const links = buildTask51IntraValuePropositionForwardLinks(rows, fids);
    expect(links.length).toBe(4);
    expect(links.some((l) => l.sourceFeatureId === 'ft_vp_core' && l.targetFeatureId === 'ft_cap_a')).toBe(
      true,
    );
    expect(links.find((l) => l.targetFeatureId === 'ft_cap_a')?.logic).toContain('销售部是抢单源头');
  });

  it('parses causality_summary on 业务能力单元 rows', () => {
    const raw = JSON.stringify({
      L3_Value_Proposition_Matrix: {
        Value_Proposition: {
          core_value_claim: '核心主张',
          delivery_model_character: '交付定性',
        },
        Target_KV: [
          {
            Feature_Key: '业务能力单元',
            Operator: '等于',
            Feature_Value: '单元A',
            causality_summary: '该单元支撑顶层主张的第一推动力。',
          },
        ],
      },
    });
    const parsed = parseTask51L3TargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const unit = parsed.rows.find((r) => r.featureKey === '业务能力单元');
    expect(unit?.causalitySummary).toContain('第一推动力');
  });

  it('parses Token_Validation_Mapping when present', () => {
    const raw = JSON.stringify({
      L3_Value_Proposition_Matrix: {
        Target_KV: [
          {
            Feature_Key: '业务能力单元',
            Operator: '等于',
            Feature_Value: '单元A',
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_000000000051',
            Mapped_L5_Feature: '业务能力单元',
            Consistency: 'Pending',
          },
        ],
      },
    });
    const plans = parseTokenValidationMappingFromL51ValuePropositionRaw(raw);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.mappedL1FeatureKey).toBe('业务能力单元');
  });
});
