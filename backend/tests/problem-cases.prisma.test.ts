import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { createPrismaClient } from '../src/lib/prisma';
import { ProblemCaseParser, ProblemCaseParsePreview } from '../src/modules/problem-cases/types';
import { PrismaProblemCaseRepository } from '../src/modules/problem-cases/prisma-problem-case.repository';

class FakeParser implements ProblemCaseParser {
  async parse(): Promise<ProblemCaseParsePreview> {
    return {
      customerName: '测试客户',
      customerNeedsOrChallenges: '需要梳理数字化需求',
      customerItStatus: '现有系统分散',
      projectTimeRequirement: '三个月内',
    };
  }
}

const shouldRunPrismaIntegration = process.env.RUN_PRISMA_TESTS === 'true' && Boolean(process.env.DATABASE_URL);
const describeOrSkip = shouldRunPrismaIntegration ? describe : describe.skip;

describeOrSkip('problem case prisma repository integration', () => {
  const prisma = createPrismaClient();
  const token = (() => {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    return jwt.sign({ userId: 'adm_test', username: 'admin_test', role: 'admin', sid: 'sess_stub' }, secret as any, { expiresIn: '2h' } as any);
  })();

  beforeEach(async () => {
    await prisma.problemCaseMessage.deleteMany();
    await prisma.problemCase.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists create/list/delete flow in mysql', async () => {
    const { app } = createApp({
      problemCaseRepository: new PrismaProblemCaseRepository(prisma),
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '测试客户',
        customerNeedsOrChallenges: '需要梳理数字化需求',
        customerItStatus: '现有系统分散',
        projectTimeRequirement: '三个月内',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.customerName).toBe('测试客户');
    expect(createResponse.body.archiveNo).toBe(1);

    const saved = await prisma.problemCase.findUnique({
      where: { id: createResponse.body.id },
    });

    expect(saved).not.toBeNull();
    expect(saved?.customerName).toBe('测试客户');
    expect(saved?.archiveNo).toBe(1);

    const listResponse = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + token);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);

    const deleteResponse = await request(app)
      .delete(`/api/problem-cases/${createResponse.body.id}`)
      .set('Authorization', 'Bearer ' + token);
    expect(deleteResponse.status).toBe(204);

    const afterDelete = await prisma.problemCase.findUnique({
      where: { id: createResponse.body.id },
    });

    expect(afterDelete).toBeNull();
  });

  it('reads stored messages from mysql', async () => {
    const { app } = createApp({
      problemCaseRepository: new PrismaProblemCaseRepository(prisma),
      problemCaseParser: new FakeParser(),
    });

    const created = await prisma.problemCase.create({
      data: {
        id: 'problem_message_seed',
        archiveNo: 1,
        customerName: '测试客户',
        customerNeedsOrChallenges: '需要梳理数字化需求',
        customerItStatus: '现有系统分散',
        projectTimeRequirement: '三个月内',
        completedStages: [],
        workflowAlignCompletedStages: [],
        itGapCompletedStages: [],
        completedTaskIds: [],
      },
    });

    await prisma.problemCaseMessage.create({
      data: {
        id: 'msg_seed_1',
        caseId: created.id,
        taskId: 'task1',
        taskName: '企业背景洞察',
        role: 'assistant',
        type: 'basicInfoCard',
        content: '客户基本信息已生成',
        payloadJson: {
          data: [
            { label: '企业名称', value: '测试客户' },
          ],
        },
        confirmed: true,
        timestamp: new Date('2026-03-15T10:00:00.000Z'),
      },
    });

    const response = await request(app)
      .get(`/api/problem-cases/${created.id}/messages`)
      .set('Authorization', 'Bearer ' + token);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: 'msg_seed_1',
      taskId: 'task1',
      type: 'basicInfoCard',
      confirmed: true,
    });
    expect(response.body.items[0].data).toEqual([
      { label: '企业名称', value: '测试客户' },
    ]);
  });

  it('replaces stored messages in mysql', async () => {
    const { app } = createApp({
      problemCaseRepository: new PrismaProblemCaseRepository(prisma),
      problemCaseParser: new FakeParser(),
    });

    await prisma.problemCase.create({
      data: {
        id: 'problem_sync_seed',
        archiveNo: 1,
        customerName: '测试客户',
        customerNeedsOrChallenges: '需要梳理数字化需求',
        customerItStatus: '现有系统分散',
        projectTimeRequirement: '三个月内',
        completedStages: [],
        workflowAlignCompletedStages: [],
        itGapCompletedStages: [],
        completedTaskIds: [],
      },
    });

    const syncResponse = await request(app)
      .put('/api/problem-cases/problem_sync_seed/messages')
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            id: 'msg_sync_1',
            taskId: 'task1',
            taskName: '企业背景洞察',
            role: 'system',
            type: 'taskStartNotification',
            content: '任务通知',
            timestamp: '2026-03-15T10:00:00.000Z',
            confirmed: false,
          },
          {
            id: 'msg_sync_2',
            taskId: 'task1',
            taskName: '企业背景洞察',
            role: 'assistant',
            type: 'basicInfoCard',
            content: '客户基本信息已生成',
            timestamp: '2026-03-15T10:05:00.000Z',
            confirmed: true,
            data: [
              { label: '企业名称', value: '测试客户' },
            ],
          },
        ],
      });

    expect(syncResponse.status).toBe(200);
    expect(syncResponse.body.items).toHaveLength(2);

    const stored = await prisma.problemCaseMessage.findMany({
      where: { caseId: 'problem_sync_seed' },
      orderBy: { timestamp: 'asc' },
    });

    expect(stored).toHaveLength(2);
    expect(stored[1].type).toBe('basicInfoCard');
    expect((stored[1].payloadJson as { data?: unknown[] }).data).toEqual([
      { label: '企业名称', value: '测试客户' },
    ]);
  });

  it('updates stored problem case in mysql', async () => {
    const { app } = createApp({
      problemCaseRepository: new PrismaProblemCaseRepository(prisma),
      problemCaseParser: new FakeParser(),
    });

    const created = await prisma.problemCase.create({
      data: {
        id: 'problem_update_seed',
        archiveNo: 1,
        customerName: '测试客户',
        customerNeedsOrChallenges: '需要梳理数字化需求',
        customerItStatus: '现有系统分散',
        projectTimeRequirement: '三个月内',
        completedStages: [],
        workflowAlignCompletedStages: [],
        itGapCompletedStages: [],
        completedTaskIds: [],
      },
    });

    const updateResponse = await request(app)
      .put(`/api/problem-cases/${created.id}`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        currentMajorStage: 2,
        workflowAlignCompletedStages: [0, 1],
        valueStream: { title: '采购到交付' },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.currentMajorStage).toBe(2);
    expect(updateResponse.body.workflowAlignCompletedStages).toEqual([0, 1]);

    const stored = await prisma.problemCase.findUnique({
      where: { id: created.id },
    });

    expect(stored?.currentMajorStage).toBe(2);
    expect(stored?.workflowAlignCompletedStages).toEqual([0, 1]);
    expect(stored?.valueStream).toEqual({ title: '采购到交付' });
  });
});
