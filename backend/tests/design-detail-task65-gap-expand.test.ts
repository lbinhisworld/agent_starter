import { describe, expect, it } from 'vitest';
import {
  expandTask65L3ItGapRowsToGapFeatureRows,
  TASK65_CALC_ANALYSIS_GAP_FEATURE_KEY,
  TASK65_DATA_MGMT_GAP_FEATURE_KEY,
  TASK65_INTERACTION_GAP_FEATURE_KEY,
  TASK65_L3_IT_GAP_FEATURE_KEY,
  type Task2L1TargetKvSyncRow,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('expandTask65L3ItGapRowsToGapFeatureRows', () => {
  it('splits one 流程优化Gap方案 row into non-暂无 gap features with shared evidence', () => {
    const parent: Task2L1TargetKvSyncRow = {
      featureKey: TASK65_L3_IT_GAP_FEATURE_KEY,
      operator: '等于',
      featureValue: {
        current_process_step_name: '派工',
        targeted_value_phase: '车间排产',
        interaction_experience_gap: {
          gap_observation: '手工表',
          solution_proposal: '看板',
        },
        data_record_gap: {
          gap_observation: '暂无',
          solution_proposal: '暂无',
        },
        calculation_analysis_gap: {
          gap_observation: '人工改数',
          solution_proposal: '引擎',
        },
      },
      evidenceLinks: [
        {
          sourceFeatureId: 'ft_000000000001',
          logic: 'test',
          weight: 1,
        },
      ],
    };
    const out = expandTask65L3ItGapRowsToGapFeatureRows([parent]);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.featureKey).sort()).toEqual(
      [TASK65_INTERACTION_GAP_FEATURE_KEY, TASK65_CALC_ANALYSIS_GAP_FEATURE_KEY].sort(),
    );
    for (const row of out) {
      expect(row.evidenceLinks).toHaveLength(1);
      expect(row.evidenceLinks![0]!.sourceFeatureId).toBe('ft_000000000001');
    }
    expect(out.some((r) => r.featureKey === TASK65_DATA_MGMT_GAP_FEATURE_KEY)).toBe(false);
  });

  it('returns empty when all three gaps are 暂无', () => {
    const parent: Task2L1TargetKvSyncRow = {
      featureKey: TASK65_L3_IT_GAP_FEATURE_KEY,
      operator: '等于',
      featureValue: {
        interaction_experience_gap: { gap_observation: '暂无', solution_proposal: '暂无' },
        data_record_gap: { gap_observation: '暂无', solution_proposal: '暂无' },
        calculation_analysis_gap: { gap_observation: '暂无', solution_proposal: '暂无' },
      },
    };
    expect(expandTask65L3ItGapRowsToGapFeatureRows([parent])).toHaveLength(0);
  });
});
