import { describe, expect, it } from 'vitest';
import {
  buildTask53WorkflowAndStepForwardLinks,
  buildTask53WorkflowStepFeaturePlans,
  task53StepFeatureIdMapKey,
  task53WorkflowStepTokenSurface,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task53-step-forward-links', () => {
  const workflowPayload = {
    workflow_name: '外委开工',
    workflow_steps_topology: [
      {
        step_name: '接单',
        associated_capability_unit: '销售部单元',
        associated_asset_dataset: '表A | 字段集A',
        predecessor_step_name: 'START_NODE',
        successor_step_name: '派工',
      },
      {
        step_name: '派工',
        associated_capability_unit: '销售部单元',
        associated_asset_dataset: '表A | 字段集A',
        predecessor_step_name: '接单',
        successor_step_name: 'END_NODE',
      },
    ],
  };

  it('builds step feature plans with token surfaces', () => {
    const plans = buildTask53WorkflowStepFeaturePlans([
      { featureValue: workflowPayload },
    ]);
    expect(plans).toHaveLength(2);
    expect(plans[0]?.stepName).toBe('接单');
    expect(plans[0]?.tokenSurface).toBe(
      task53WorkflowStepTokenSurface('外委开工', '接单'),
    );
    expect(plans[1]?.stepName).toBe('派工');
  });

  it('synthesizes cap/fs/workflow → step forward links', () => {
    const cleaned = [{ featureValue: workflowPayload, inferenceWeight: 0.9 }];
    const stepMap = new Map<string, string>([
      [task53StepFeatureIdMapKey(0, '接单'), 'ft_step_001'],
      [task53StepFeatureIdMapKey(0, '派工'), 'ft_step_002'],
    ]);
    const links = buildTask53WorkflowAndStepForwardLinks(
      cleaned,
      ['ft_wf_001'],
      stepMap,
      [{ featureId: 'ft_cap_001', label: '销售部单元' }],
      [{ featureId: 'ft_fs_001', label: '表A | 字段集A' }],
    );
    const pairs = links.map((l) => `${l.sourceFeatureId}->${l.targetFeatureId}`);
    expect(pairs).toContain('ft_wf_001->ft_step_001');
    expect(pairs).toContain('ft_cap_001->ft_step_001');
    expect(pairs).toContain('ft_fs_001->ft_step_001');
    expect(pairs).toContain('ft_cap_001->ft_step_002');
    expect(links.every((l) => l.logic.includes('正向归纳'))).toBe(true);
  });
});
