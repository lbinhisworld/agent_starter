import { describe, expect, it } from 'vitest';
import {
  buildTask1PainPointConfirmedIndex,
  DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY,
  mergeTokenValidationPlansWithPainPointConfirmedImmunity,
  resolveLineStepIdsForPainPointReset,
} from '../src/modules/problem-cases/design-detail-pain-point-confirmed';
import type { DesignDetailTaskGraphTaskDto } from '../src/modules/problem-cases/types';

describe('design-detail-pain-point-confirmed', () => {
  it('merges TVM plan to 已确认为痛点 when task1 feature is painPointConfirmed', () => {
    const tasks: DesignDetailTaskGraphTaskDto[] = [
      {
        taskId: 'customer_basic',
        title: 't1',
        tokenCount: 0,
        featureCount: 1,
        linkCount: 0,
        tokens: [],
        features: [
          {
            featureId: 'ft_t1_001',
            name: '车间接单',
            themeKey: 'x',
            pillBatchKey: 'cb-0',
            painPointConfirmed: true,
            painPointConfirmedByLineStepId: 'scale_org_mode_extract',
          },
        ],
        links: [],
      },
    ];
    const confirmed = buildTask1PainPointConfirmedIndex(tasks);
    expect(confirmed.has('ft_t1_001')).toBe(true);

    const merged = mergeTokenValidationPlansWithPainPointConfirmedImmunity(
      [
        {
          targetFeatureId: 'ft_t1_001',
          mappedL1FeatureKey: '交付',
          validationLogic: '仍标冲突',
          validationWeight: 0.8,
          consistencyLabel: '潜在冲突',
        },
      ],
      confirmed,
    );
    expect(merged[0]?.consistencyLabel).toBe(DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY);
  });

  it('resolveLineStepIdsForPainPointReset scopes anchor correctly', () => {
    expect(resolveLineStepIdsForPainPointReset('all')).toBe('all');
    expect(resolveLineStepIdsForPainPointReset('line_step', 'scale_org_mode_extract')).toEqual([
      'scale_org_mode_extract',
    ]);
    expect(
      resolveLineStepIdsForPainPointReset('from_line_step', 'industry_business_profile_extract'),
    ).toEqual([
      'industry_business_profile_extract',
      'core_value_driver_inference',
      'macro_process_flow_inference',
    ]);
  });
});
