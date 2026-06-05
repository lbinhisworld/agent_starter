import { describe, expect, it } from 'vitest';
import {
  buildTask1UpstreamValidationConsistencyBySourceTasks,
  mergeTokenValidationPlansWithUpstreamImmunity,
} from '../src/modules/problem-cases/design-detail-upstream-validation-immunity';
import type { DesignDetailTaskGraphTaskDto } from '../src/modules/problem-cases/types';
import {
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
} from '../src/modules/problem-cases/design-detail-task-graph-catalog';

describe('design-detail-upstream-validation-immunity', () => {
  it('inherits task 2 resolved Consistency and clears potential conflict on same task1 target', () => {
    const tasks: DesignDetailTaskGraphTaskDto[] = [
      {
        taskId: 'customer_basic',
        title: 't1',
        tokenCount: 0,
        featureCount: 1,
        linkCount: 1,
        tokens: [],
        features: [{ featureId: 'ft_t1_001', name: '无需审批', themeKey: 'x', pillBatchKey: 'cb-0' }],
        links: [
          {
            linkId: 'lk_1',
            name: 'v',
            linkKind: '反向验证',
            validationConsistency: '已通过洞察修正',
            sourceFeatureId: 'ft_t2_src',
            targetFeatureId: 'ft_t1_001',
            themeKey: 'x',
            pillBatchKey: 't2l1-0',
          },
        ],
      },
      {
        taskId: DESIGN_DETAIL_TASK2_LINE_TASK_ID,
        title: 't2',
        tokenCount: 0,
        featureCount: 1,
        linkCount: 0,
        tokens: [],
        features: [{ featureId: 'ft_t2_src', name: '组织模式', themeKey: 'x', pillBatchKey: 't2l1-0' }],
        links: [],
      },
    ];
    const upstream = buildTask1UpstreamValidationConsistencyBySourceTasks(tasks, [
      DESIGN_DETAIL_TASK2_LINE_TASK_ID,
    ]);
    expect(upstream.get('ft_t1_001')?.consistency).toBe('已通过洞察修正');

    const merged = mergeTokenValidationPlansWithUpstreamImmunity(
      [
        {
          targetFeatureId: 'ft_t1_001',
          mappedL1FeatureKey: '交付模式',
          validationLogic: '模型仍标冲突',
          validationWeight: 0.8,
          consistencyLabel: '潜在冲突',
        },
      ],
      upstream,
    );
    expect(merged[0]?.consistencyLabel).toBe('已通过洞察修正');
    expect(merged[0]?.validationLogic).toContain('继承');
  });

  it('task 4 sync inherits resolved Consistency from both task 2 and task 3 reverse links', () => {
    const tasks: DesignDetailTaskGraphTaskDto[] = [
      {
        taskId: 'customer_basic',
        title: 't1',
        tokenCount: 0,
        featureCount: 1,
        linkCount: 1,
        tokens: [],
        features: [{ featureId: 'ft_t1_002', name: '插单', themeKey: 'x', pillBatchKey: 'cb-0' }],
        links: [
          {
            linkId: 'lk_t2',
            name: 'v2',
            linkKind: '反向验证',
            validationConsistency: '逻辑一致',
            sourceFeatureId: 'ft_t2_src',
            targetFeatureId: 'ft_t1_002',
            themeKey: 'x',
            pillBatchKey: 't2l1-0',
          },
          {
            linkId: 'lk_t3',
            name: 'v3',
            linkKind: '反向验证',
            validationConsistency: '已通过洞察修正',
            sourceFeatureId: 'ft_t3_src',
            targetFeatureId: 'ft_t1_002',
            themeKey: 'x',
            pillBatchKey: 't3l2-0',
          },
        ],
      },
      {
        taskId: DESIGN_DETAIL_TASK2_LINE_TASK_ID,
        title: 't2',
        tokenCount: 0,
        featureCount: 1,
        linkCount: 0,
        tokens: [],
        features: [{ featureId: 'ft_t2_src', name: '组织', themeKey: 'x', pillBatchKey: 't2l1-0' }],
        links: [],
      },
      {
        taskId: DESIGN_DETAIL_TASK3_LINE_TASK_ID,
        title: 't3',
        tokenCount: 0,
        featureCount: 1,
        linkCount: 0,
        tokens: [],
        features: [{ featureId: 'ft_t3_src', name: '交付', themeKey: 'x', pillBatchKey: 't3l2-0' }],
        links: [],
      },
    ];
    const upstream = buildTask1UpstreamValidationConsistencyBySourceTasks(tasks, [
      DESIGN_DETAIL_TASK2_LINE_TASK_ID,
      DESIGN_DETAIL_TASK3_LINE_TASK_ID,
    ]);
    expect(upstream.get('ft_t1_002')?.consistency).toBe('已通过洞察修正');

    const merged = mergeTokenValidationPlansWithUpstreamImmunity(
      [
        {
          targetFeatureId: 'ft_t1_002',
          mappedL1FeatureKey: '交付模式',
          validationLogic: '任务 4 仍标冲突',
          validationWeight: 0.8,
          consistencyLabel: '潜在冲突',
        },
      ],
      upstream,
    );
    expect(merged[0]?.consistencyLabel).toBe('已通过洞察修正');
  });

  it('inherits by task1 feature name token key when plan targetFeatureId is missing or wrong', () => {
    const tasks: DesignDetailTaskGraphTaskDto[] = [
      {
        taskId: 'customer_basic',
        title: 't1',
        tokenCount: 0,
        featureCount: 1,
        linkCount: 1,
        tokens: [],
        features: [{ featureId: 'ft_t1_003', name: '车间接单与核心资产管理', themeKey: 'x', pillBatchKey: 'cb-0' }],
        links: [
          {
            linkId: 'lk_t2',
            name: 'v',
            linkKind: '反向验证',
            validationConsistency: '已通过洞察修正',
            sourceFeatureId: 'ft_t2_src',
            targetFeatureId: 'ft_t1_003',
            themeKey: 'x',
            pillBatchKey: 't2l1-0',
          },
        ],
      },
      {
        taskId: DESIGN_DETAIL_TASK2_LINE_TASK_ID,
        title: 't2',
        tokenCount: 0,
        featureCount: 1,
        linkCount: 0,
        tokens: [],
        features: [{ featureId: 'ft_t2_src', name: '组织模式', themeKey: 'x', pillBatchKey: 't2l1-0' }],
        links: [],
      },
    ];
    const upstream = buildTask1UpstreamValidationConsistencyBySourceTasks(tasks, [
      DESIGN_DETAIL_TASK2_LINE_TASK_ID,
    ]);
    expect(upstream.get('车间接单与核心资产管理')?.consistency).toBe('已通过洞察修正');

    const merged = mergeTokenValidationPlansWithUpstreamImmunity(
      [
        {
          targetFeatureId: 'ft_wrong_id',
          mappedL1FeatureKey: '车间接单与核心资产管理',
          validationLogic: '模型仍标冲突',
          validationWeight: 0.8,
          consistencyLabel: '潜在冲突',
        },
      ],
      upstream,
    );
    expect(merged[0]?.consistencyLabel).toBe('已通过洞察修正');
  });
});
