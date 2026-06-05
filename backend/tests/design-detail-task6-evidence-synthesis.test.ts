import { describe, expect, it } from 'vitest';
import {
  ensureTask6ScenarioEvidenceLinks,
  registerTask6UpstreamEvidenceAliases,
  synthesizeTask6ScenarioEvidenceLinks,
  type Task2L1TargetKvSyncRow,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task6-evidence-synthesis', () => {
  it('synthesizes 5.5 + 5.3 + task1 forward links from structured Feature_Value', () => {
    const aliasMap = new Map<string, string>();
    registerTask6UpstreamEvidenceAliases(
      [
        {
          featureId: 'ft_000000000442',
          value: {
            phase_name: '外委派工',
            classified_workflows: [
              {
                workflow_feature_id: 'ft_000000000701',
                workflow_name: '商务接单',
              },
            ],
          },
        },
        {
          featureId: 'ft_000000000701',
          value: { workflow_name: '商务接单' },
        },
        {
          featureId: 'ft_000000000360',
          value: '痛点描述',
        },
      ],
      aliasMap,
    );
    aliasMap.set('ft_000000000360', 'ft_000000000360');

    const row: Task2L1TargetKvSyncRow = {
      featureKey: '关键场景',
      featureValue: {
        scenario_name: '基于返点台账的销售合规场景',
        targeted_value_phase: '外委派工',
        belonging_core_workflows: [{ workflow_name: '商务接单' }],
        associated_pain_point: {
          pain_point_feature_id: 'ft_000000000360',
          pain_point_description: '返点台账',
        },
      },
    };

    const links = ensureTask6ScenarioEvidenceLinks(row, aliasMap);
    const srcIds = links.map((l) => l.sourceFeatureId).sort();
    expect(srcIds).toEqual(
      ['ft_000000000360', 'ft_000000000442', 'ft_000000000701'].sort(),
    );
    expect(synthesizeTask6ScenarioEvidenceLinks(row, aliasMap)).toHaveLength(3);
  });
});
