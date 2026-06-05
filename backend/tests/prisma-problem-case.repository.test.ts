import { describe, expect, it, vi } from 'vitest';
import { PrismaProblemCaseRepository } from '../src/modules/problem-cases/prisma-problem-case.repository';

function buildCaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case_1',
    createdAt: new Date('2026-03-22T00:00:00.000Z'),
    updatedAt: new Date('2026-03-22T00:01:00.000Z'),
    customerName: 'customer',
    customerNeedsOrChallenges: 'needs',
    customerItStatus: 'status',
    projectTimeRequirement: 'time',
    currentMajorStage: 0,
    currentItStrategySubstep: 0,
    completedStages: [],
    workflowAlignCompletedStages: [],
    itGapCompletedStages: [],
    completedTaskIds: [],
    basicInfo: null,
    bmc: null,
    requirementLogic: null,
    valueStream: null,
    e2eFlowWorkspaceSuppressed: null,
    e2eFlowLandscapeJson: null,
    e2eTransactionFlowJson: null,
    e2eRequirementScenarioSupplementJson: null,
    globalItGapAnalysisJson: null,
    localItGapSessions: null,
    localItGapAnalyses: null,
    roleTaskCenterPortalDesignJson: null,
    objectStateMachineJson: null,
    rolePermissionSessions: null,
    coreBusinessObjectSessions: null,
    coreBusinessObjectSystemPromptOverride: null,
    ...overrides,
  };
}

describe('PrismaProblemCaseRepository.update', () => {
  it('updates through update() and then re-reads the case', async () => {
    const findUnique = vi.fn(async () => ({
      id: 'case_1',
      createdAt: new Date('2026-03-22T00:00:00.000Z'),
      updatedAt: new Date('2026-03-22T00:01:00.000Z'),
      customerName: 'customer',
      customerNeedsOrChallenges: 'needs',
      customerItStatus: 'status',
      projectTimeRequirement: 'time',
      currentMajorStage: 2,
      currentItStrategySubstep: 0,
      completedStages: [0, 1],
      workflowAlignCompletedStages: [0],
      itGapCompletedStages: [],
      completedTaskIds: ['task1'],
      basicInfo: null,
      bmc: null,
      requirementLogic: null,
      valueStream: null,
      e2eFlowWorkspaceSuppressed: null,
      e2eFlowLandscapeJson: null,
      e2eTransactionFlowJson: null,
      e2eRequirementScenarioSupplementJson: null,
      globalItGapAnalysisJson: null,
      localItGapSessions: null,
      localItGapAnalyses: null,
      roleTaskCenterPortalDesignJson: null,
      objectStateMachineJson: null,
      rolePermissionSessions: null,
      coreBusinessObjectSessions: null,
      coreBusinessObjectSystemPromptOverride: null,
    }));
    const update = vi.fn(async () => ({}));
    const repository = new PrismaProblemCaseRepository({
      problemCase: {
        update,
        findUnique,
      },
    } as any);

    const result = await repository.update('case_1', {
      currentMajorStage: 2,
      completedStages: [0, 1],
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'case_1' },
      data: {
        currentMajorStage: 2,
        completedStages: [0, 1],
      },
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'case_1' } });
    expect(result?.id).toBe('case_1');
    expect(result?.currentMajorStage).toBe(2);
  });

  it('returns null when no row is updated (P2025)', async () => {
    const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
    const update = vi.fn(async () => {
      throw p2025;
    });
    const findUnique = vi.fn();
    const repository = new PrismaProblemCaseRepository({
      problemCase: {
        update,
        findUnique,
      },
    } as any);

    const result = await repository.update('missing_case', {
      currentMajorStage: 1,
    });

    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('empty updates loads existing row via findUnique and does not call update', async () => {
    const row = {
      id: 'case_1',
      createdAt: new Date('2026-03-22T00:00:00.000Z'),
      updatedAt: new Date('2026-03-22T00:01:00.000Z'),
      customerName: 'customer',
      customerNeedsOrChallenges: 'needs',
      customerItStatus: 'status',
      projectTimeRequirement: 'time',
      currentMajorStage: 0,
      currentItStrategySubstep: 0,
      completedStages: [],
      workflowAlignCompletedStages: [],
      itGapCompletedStages: [],
      completedTaskIds: [],
      basicInfo: null,
      bmc: null,
      requirementLogic: null,
      valueStream: null,
      e2eFlowWorkspaceSuppressed: null,
      e2eFlowLandscapeJson: null,
      e2eTransactionFlowJson: null,
      e2eRequirementScenarioSupplementJson: null,
      globalItGapAnalysisJson: null,
      localItGapSessions: null,
      localItGapAnalyses: null,
      roleTaskCenterPortalDesignJson: null,
      objectStateMachineJson: null,
      rolePermissionSessions: null,
      coreBusinessObjectSessions: null,
      coreBusinessObjectSystemPromptOverride: null,
    };
    const findUnique = vi.fn(async () => row);
    const update = vi.fn();
    const repository = new PrismaProblemCaseRepository({
      problemCase: {
        update,
        findUnique,
      },
    } as any);

    const result = await repository.update('case_1', {});

    expect(update).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'case_1' } });
    expect(result?.id).toBe('case_1');
    expect(result?.customerName).toBe('customer');
  });

  it('empty updates returns null when id is missing', async () => {
    const findUnique = vi.fn(async () => null);
    const update = vi.fn();
    const repository = new PrismaProblemCaseRepository({
      problemCase: {
        update,
        findUnique,
      },
    } as any);

    const result = await repository.update('missing_case', {});

    expect(update).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'missing_case' } });
    expect(result).toBeNull();
  });

  it('保留旧 extras：更新 basicInfo 且未显式传新增字段时，urgencyAnalysis.deferredFeatures 不丢失', async () => {
    const update = vi.fn(async () => ({}));
    const findUnique = vi
      .fn()
      // update 前查旧行（select basicInfo）
      .mockResolvedValueOnce({
        basicInfo: {
          company_name: '旧公司',
          __createContractExtras: {
            urgencyAnalysis: { deferredFeatures: ['A', 'B'] },
            operationModel: { mode: '直营' },
          },
        },
      })
      // update 后回读完整行
      .mockResolvedValueOnce(
        buildCaseRow({
          basicInfo: {
            company_name: '新公司',
            __createContractExtras: {
              urgencyAnalysis: { deferredFeatures: ['A', 'B'] },
              operationModel: { mode: '直营' },
            },
          },
        }),
      );

    const repository = new PrismaProblemCaseRepository({
      problemCase: {
        update,
        findUnique,
      },
    } as any);

    const result = await repository.update('case_1', {
      basicInfo: { company_name: '新公司' },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'case_1' },
      data: expect.objectContaining({
        basicInfo: {
          company_name: '新公司',
          __createContractExtras: {
            urgencyAnalysis: { deferredFeatures: ['A', 'B'] },
            operationModel: { mode: '直营' },
          },
        },
      }),
    });
    expect(result?.urgencyAnalysis).toEqual({ deferredFeatures: ['A', 'B'] });
  });
});

describe('PrismaProblemCaseRepository basicInfo mapping', () => {
  it('extras-only basicInfo 不对外暴露为 truthy，但顶层新增字段仍回填', async () => {
    const findUnique = vi.fn(async () =>
      buildCaseRow({
        basicInfo: {
          __createContractExtras: {
            operationModel: { model: '直营+渠道' },
            businessStatus: { stage: '增长期' },
            urgencyAnalysis: { level: 'P0' },
            requirementDetailHistory: [{ note: 'v1' }],
          },
        },
      }),
    );
    const repository = new PrismaProblemCaseRepository({
      problemCase: { findUnique },
    } as any);

    const result = await repository.findById('case_1');

    expect(result).not.toBeNull();
    expect(result?.basicInfo).toBeUndefined();
    expect(result?.operationModel).toEqual({ model: '直营+渠道' });
    expect(result?.businessStatus).toEqual({ stage: '增长期' });
    expect(result?.urgencyAnalysis).toEqual({ level: 'P0' });
    expect(result?.requirementDetailHistory).toEqual([{ note: 'v1' }]);
  });

  it('存在真实客户基本信息字段时，basicInfo 仍正常返回', async () => {
    const findUnique = vi.fn(async () =>
      buildCaseRow({
        basicInfo: {
          company_name: '道一科技',
          __createContractExtras: {
            operationModel: { model: '项目制' },
          },
        },
      }),
    );
    const repository = new PrismaProblemCaseRepository({
      problemCase: { findUnique },
    } as any);

    const result = await repository.findById('case_1');

    expect(result).not.toBeNull();
    expect(result?.basicInfo).toEqual({
      company_name: '道一科技',
      __createContractExtras: {
        operationModel: { model: '项目制' },
      },
    });
    expect(result?.operationModel).toEqual({ model: '项目制' });
  });
});
