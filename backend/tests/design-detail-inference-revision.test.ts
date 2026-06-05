import { describe, expect, it } from 'vitest';
import {
  buildDiagnosticPainPointRevisionRows,
  buildFeatureValueRevisionRowsFromTargetKv,
  buildDesignDetailInferenceRevisionRows,
  resolveDiagnosticPainPointFeatureId,
} from '../src/modules/problem-cases/design-detail-inference-revision';
import type { DesignDetailTaskGraphFeatureDto } from '../src/modules/problem-cases/types';

describe('design-detail-inference-revision', () => {
  it('detects Target_KV value changes like alignment diff (组织模式 集团管控型 → 集团监控型)', () => {
    const before: DesignDetailTaskGraphFeatureDto[] = [
      {
        featureId: 'ft_000000000178',
        name: '集团管控型',
        themeKey: 't2',
        pillBatchKey: 't2l1-0',
        tokenDisplay: '组织模式',
        operator: '等于',
      },
      {
        featureId: 'ft_000000000179',
        name: '高',
        themeKey: 't2',
        pillBatchKey: 't2l1-0',
        tokenDisplay: '管控复杂度',
        operator: '等于',
      },
    ];
    const afterTargetKvRows = [
      { featureKey: '组织模式', operator: '等于', featureValue: '集团监控型' },
      { featureKey: '管控复杂度', operator: '等于', featureValue: '中' },
    ];
    const rows = buildFeatureValueRevisionRowsFromTargetKv(before, afterTargetKvRows, {
      logicGapReport: '',
      insightResolutionSummary: '',
    });
    expect(rows.length).toBe(2);
    expect(rows[0]?.valueBefore).toContain('集团管控型');
    expect(rows[0]?.valueAfter).toContain('集团监控型');
  });

  it('includes TVM rows when Target_KV unchanged', () => {
    const before: DesignDetailTaskGraphFeatureDto[] = [
      {
        featureId: 'ft_1',
        name: 'A',
        themeKey: 't2',
        pillBatchKey: 't2l1-0',
        tokenDisplay: '组织模式',
        operator: '等于',
      },
    ];
    const all = buildDesignDetailInferenceRevisionRows({
      beforeFeatures: before,
      afterFeatures: before,
      afterTargetKvRows: [{ featureKey: '组织模式', operator: '等于', featureValue: 'A' }],
      tvPlans: [{ targetFeatureId: 'ft_task1_1', validationLogic: '校验说明' }],
      causality: { logicGapReport: 'gap', insightResolutionSummary: 'insight' },
      painPoints: [],
    });
    expect(all.some((r) => r.recordKind === 'TOKEN_VALIDATION')).toBe(true);
  });

  it('maps Conflict_ID DIA-L2-001 to ft_* featureId and keeps conflict id in fieldLabel', () => {
    const featureId = resolveDiagnosticPainPointFeatureId(
      {
        painPointId: 'DIA-L2-001',
        conflictDescription: '与上游不一致',
        insightConfirmation: '',
        rootCauseAnalysis: '',
        designConstraint: '',
      },
      0,
      [{ targetFeatureId: 'ft_000000000186', consistencyLabel: '潜在冲突' }],
    );
    expect(featureId).toBe('ft_000000000186');
    const rows = buildDiagnosticPainPointRevisionRows(
      [
        {
          painPointId: 'DIA-L2-001',
          conflictDescription: '与上游不一致',
          insightConfirmation: '',
          rootCauseAnalysis: '',
          designConstraint: '',
        },
      ],
      { logicGapReport: '', insightResolutionSummary: '' },
      [{ targetFeatureId: 'ft_000000000186', consistencyLabel: '潜在冲突' }],
    );
    expect(rows[0]?.featureId).toBe('ft_000000000186');
    expect(rows[0]?.fieldLabel).toBe('DIA-L2-001');
    expect(rows[0]?.featureId).not.toMatch(/^DIA-/);
  });
});
