import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { InMemoryProblemCaseRepository } from '../src/modules/problem-cases/in-memory-problem-case.repository';
import { ProblemCaseParser, ProblemCaseParsePreview } from '../src/modules/problem-cases/types';

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

describe('problem case routes', () => {
  let repository: InMemoryProblemCaseRepository;
  const token = (() => {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    return jwt.sign({ userId: 'adm_test', username: 'admin_test', role: 'admin', sid: 'sess_stub' }, secret as any, { expiresIn: '2h' } as any);
  })();

  beforeEach(() => {
    repository = new InMemoryProblemCaseRepository();
  });

  it('returns parse preview', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const response = await request(app)
      .post('/api/problem-cases/parse-preview')
      .set('Authorization', 'Bearer ' + token)
      .send({ input: '客户名称：测试客户' });

    expect(response.status).toBe(200);
    expect(response.body.customerName).toBe('测试客户');
  });

  it('creates, lists, and deletes a problem case', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
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
    expect(createResponse.body.currentMajorStage).toBe(0);

    const listResponse = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + token);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);

    const deleteResponse = await request(app)
      .delete(`/api/problem-cases/${createResponse.body.id}`)
      .set('Authorization', 'Bearer ' + token);
    expect(deleteResponse.status).toBe(204);

    const afterDeleteResponse = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + token);
    expect(afterDeleteResponse.body.items).toHaveLength(0);
  });

  it('POST 创建时可写入新增字段（operationModel/businessStatus/urgencyAnalysis/requirementDetailHistory）', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const payload = {
      customerName: '新增字段客户',
      customerNeedsOrChallenges: '需要梳理数字化需求',
      customerItStatus: '现有系统分散',
      projectTimeRequirement: '三个月内',
      operationModel: { model: '直营+渠道' },
      businessStatus: { stage: '增长期' },
      urgencyAnalysis: { level: 'P0' },
      requirementDetailHistory: [{ at: '2026-03-23T10:00:00.000Z', note: 'v1' }],
    };

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send(payload);

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.operationModel).toEqual(payload.operationModel);
    expect(createResponse.body.businessStatus).toEqual(payload.businessStatus);
    expect(createResponse.body.urgencyAnalysis).toEqual(payload.urgencyAnalysis);
    expect(createResponse.body.requirementDetailHistory).toEqual(payload.requirementDetailHistory);
  });

  it('创建后 GET 同 case 仍返回新增字段', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const payload = {
      customerName: 'GET 保留客户',
      customerNeedsOrChallenges: '需要梳理数字化需求',
      customerItStatus: '现有系统分散',
      projectTimeRequirement: '三个月内',
      requirementDetail: { flow: '核心业务流程梳理' },
      operationModel: { model: '项目制' },
      businessStatus: { status: '经营稳定' },
      urgencyAnalysis: { overall: '高' },
      requirementDetailHistory: [{ version: 1, text: '初版需求' }],
    };

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send(payload);
    expect(createResponse.status).toBe(201);

    const caseId = createResponse.body.id as string;
    const detailResponse = await request(app)
      .get(`/api/problem-cases/${caseId}`)
      .set('Authorization', 'Bearer ' + token);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.requirementDetail).toEqual(payload.requirementDetail);
    expect(detailResponse.body.operationModel).toEqual(payload.operationModel);
    expect(detailResponse.body.businessStatus).toEqual(payload.businessStatus);
    expect(detailResponse.body.urgencyAnalysis).toEqual(payload.urgencyAnalysis);
    expect(detailResponse.body.requirementDetailHistory).toEqual(payload.requirementDetailHistory);
  });

  it('GET design-detail/task-graph returns 200 with tasks for existing case', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });
    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '逻辑图路由探测',
        customerNeedsOrChallenges: 'n',
        customerItStatus: 'n',
        projectTimeRequirement: 'n',
      });
    expect(createResponse.status).toBe(201);
    const caseId = createResponse.body.id as string;
    const graphRes = await request(app)
      .get(`/api/problem-cases/${encodeURIComponent(caseId)}/design-detail/task-graph`)
      .set('Authorization', 'Bearer ' + token);
    expect(graphRes.status).toBe(200);
    expect(graphRes.body.caseId).toBe(caseId);
    expect(Array.isArray(graphRes.body.tasks)).toBe(true);
    expect(graphRes.body.tasks.length).toBeGreaterThan(0);
  });

  it('ignores incoming id on create (stops timestamp as primary key)', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const incomingId = '2026-03-20T12:00:00.000Z';

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        id: incomingId,
        customerName: '测试客户2',
        customerNeedsOrChallenges: '需要梳理数字化需求2',
        customerItStatus: '现有系统分散2',
        projectTimeRequirement: '三个月内2',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.id).toBeDefined();
    expect(createResponse.body.id).not.toBe(incomingId);

    const createdCaseId = createResponse.body.id;

    // detail by createdCaseId should work
    const detailRes = await request(app).get('/api/problem-cases/' + createdCaseId).set('Authorization', 'Bearer ' + token);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(createdCaseId);

    // detail by incomingId should be 404 because it is no longer used as primary key
    const legacyRes = await request(app).get('/api/problem-cases/' + incomingId).set('Authorization', 'Bearer ' + token);
    expect(legacyRes.status).toBe(404);
  });

  it('replaces messages for a problem case', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
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

    const caseId = createResponse.body.id;

    const syncResponse = await request(app)
      .put(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            id: 'msg_1',
            role: 'system',
            type: 'taskStartNotification',
            taskId: 'task1',
            taskName: '企业背景洞察',
            content: '任务通知',
            timestamp: '2026-03-15T10:00:00.000Z',
            confirmed: false,
          },
        ],
      });

    expect(syncResponse.status).toBe(200);
    expect(syncResponse.body.items).toHaveLength(1);

    const listResponse = await request(app).get(`/api/problem-cases/${caseId}/messages`).set('Authorization', 'Bearer ' + token);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);

    expect(listResponse.body.items[0]).toMatchObject({
      id: 'msg_1',
      caseId,
      taskId: 'task1',
      role: 'system',
      type: 'taskStartNotification',
      content: '任务通知',
      confirmed: false,
      payloadJson: null,
      timestamp: '2026-03-15T10:00:00.000Z',
    });
  });

  it('patches a single message without full replace', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
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

    const caseId = createResponse.body.id;

    const syncResponse = await request(app)
      .put(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            id: 'msg_patch_1',
            role: 'system',
            type: 'taskStartNotification',
            taskId: 'task1',
            taskName: '企业背景洞察',
            content: '任务通知',
            timestamp: '2026-03-15T10:00:00.000Z',
            confirmed: false,
          },
        ],
      });

    expect(syncResponse.status).toBe(200);

    const patchRes = await request(app)
      .patch(`/api/problem-cases/${caseId}/messages/msg_patch_1`)
      .set('Authorization', 'Bearer ' + token)
      .send({ confirmed: true, content: '已确认' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.id).toBe('msg_patch_1');
    expect(patchRes.body.confirmed).toBe(true);
    expect(patchRes.body.content).toBe('已确认');

    const listResponse = await request(app).get(`/api/problem-cases/${caseId}/messages`).set('Authorization', 'Bearer ' + token);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.items[0].confirmed).toBe(true);
    expect(listResponse.body.items[0].content).toBe('已确认');
  });

  it('accepts legacy sync payloads with null optional fields', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
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

    const caseId = createResponse.body.id;

    const syncResponse = await request(app)
      .put(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            caseId,
            id: 'msg_nullable_1',
            taskId: null,
            role: 'system',
            type: null,
            content: '请输入客户基本信息',
            timestamp: '2026-03-21T16:20:25.000Z',
            confirmed: false,
            payloadJson: { caseId },
          },
          {
            caseId,
            id: 'msg_nullable_2',
            taskId: 'task6',
            taskName: '痛点标注',
            role: null,
            type: 'taskStartNotification',
            content: '',
            timestamp: '2026-03-21T16:20:25.000Z',
            confirmed: false,
            payloadJson: { caseId },
          },
        ],
      });

    expect(syncResponse.status).toBe(200);
    expect(syncResponse.body.items).toHaveLength(2);
    expect(syncResponse.body.items[0]).toMatchObject({
      id: 'msg_nullable_1',
      caseId,
      taskId: null,
      role: 'system',
      type: null,
    });
    expect(syncResponse.body.items[1]).toMatchObject({
      id: 'msg_nullable_2',
      caseId,
      taskId: 'task6',
      taskName: '痛点标注',
      role: null,
      type: 'taskStartNotification',
    });
  });

  it('updates a problem case', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
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

    const updateResponse = await request(app)
      .put(`/api/problem-cases/${createResponse.body.id}`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        currentMajorStage: 1,
        completedStages: [0, 1, 2],
        basicInfo: { company_name: '测试客户' },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.currentMajorStage).toBe(1);
    expect(updateResponse.body.completedStages).toEqual([0, 1, 2]);
    expect(updateResponse.body.basicInfo).toEqual({ company_name: '测试客户' });
  });

  it('PUT existing case with empty body returns 200 and current record (no-op)', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '空更新客户',
        customerNeedsOrChallenges: '需求',
        customerItStatus: '现状',
        projectTimeRequirement: '时间',
      });

    const id = createResponse.body.id as string;
    const before = await request(app).get(`/api/problem-cases/${id}`).set('Authorization', 'Bearer ' + token);
    expect(before.status).toBe(200);

    const putRes = await request(app)
      .put(`/api/problem-cases/${id}`)
      .set('Authorization', 'Bearer ' + token)
      .send({});

    expect(putRes.status).toBe(200);
    expect(putRes.body.id).toBe(id);
    expect(putRes.body.customerName).toBe(before.body.customerName);
  });

  it('PUT missing case with empty body returns 404', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const res = await request(app)
      .put('/api/problem-cases/problem_no_such_case_zzzz')
      .set('Authorization', 'Bearer ' + token)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('案例不存在');
  });

  it('PUT existing case with valid fields returns 200 with updated data', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '原名',
        customerNeedsOrChallenges: '需求',
        customerItStatus: '现状',
        projectTimeRequirement: '时间',
      });

    const id = createResponse.body.id as string;
    const putRes = await request(app)
      .put(`/api/problem-cases/${id}`)
      .set('Authorization', 'Bearer ' + token)
      .send({ customerName: '新名称' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.customerName).toBe('新名称');
  });

  it('PATCH 单条消息可更新 content 与 confirmed', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '测试客户',
        customerNeedsOrChallenges: '需求',
        customerItStatus: '现状',
        projectTimeRequirement: '时间',
      });
    const caseId = createResponse.body.id as string;

    await request(app)
      .put(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            id: 'msg_patch_1',
            role: 'user',
            content: '旧内容',
            timestamp: '2026-03-15T10:00:00.000Z',
            confirmed: false,
          },
        ],
      });

    const patchRes = await request(app)
      .patch(`/api/problem-cases/${caseId}/messages/msg_patch_1`)
      .set('Authorization', 'Bearer ' + token)
      .send({ content: '新内容', confirmed: true });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body).toMatchObject({
      id: 'msg_patch_1',
      caseId,
      content: '新内容',
      confirmed: true,
    });
  });

  it('PUT 整段替换在显式多消息场景下仍覆盖为请求体', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '测试客户',
        customerNeedsOrChallenges: '需求',
        customerItStatus: '现状',
        projectTimeRequirement: '时间',
      });
    const caseId = createResponse.body.id as string;

    const putRes = await request(app)
      .put(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            id: 'm1',
            role: 'system',
            content: 'a',
            timestamp: '2026-03-15T10:00:00.000Z',
          },
          {
            id: 'm2',
            role: 'user',
            content: 'b',
            timestamp: '2026-03-15T10:01:00.000Z',
          },
        ],
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.items).toHaveLength(2);
    expect(putRes.body.items.map((x: { id: string }) => x.id)).toEqual(['m1', 'm2']);
  });

  it('非空历史时 PUT 单条 system 占位「请输入客户基本信息」不会覆盖真实历史', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '测试客户',
        customerNeedsOrChallenges: '需求',
        customerItStatus: '现状',
        projectTimeRequirement: '时间',
      });
    const caseId = createResponse.body.id as string;

    await request(app)
      .put(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            id: 'hist_1',
            role: 'user',
            content: '真实历史 A',
            timestamp: '2026-03-15T10:00:00.000Z',
          },
          {
            id: 'hist_2',
            role: 'assistant',
            content: '真实历史 B',
            timestamp: '2026-03-15T10:01:00.000Z',
          },
        ],
      });

    const dangerPut = await request(app)
      .put(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            id: 'placeholder_1',
            role: 'system',
            content: '请输入客户基本信息',
            timestamp: '2026-03-15T10:02:00.000Z',
          },
        ],
      });

    expect(dangerPut.status).toBe(200);
    expect(dangerPut.body.items).toHaveLength(2);
    const contents = dangerPut.body.items.map((m: { content: string }) => m.content).sort();
    expect(contents).toEqual(['真实历史 A', '真实历史 B']);

    const list = await request(app).get(`/api/problem-cases/${caseId}/messages`).set('Authorization', 'Bearer ' + token);
    expect(list.body.items).toHaveLength(2);
  });

  it('POST 追加消息与 DELETE 删除仍可用', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '测试客户',
        customerNeedsOrChallenges: '需求',
        customerItStatus: '现状',
        projectTimeRequirement: '时间',
      });
    const caseId = createResponse.body.id as string;

    const postRes = await request(app)
      .post(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        id: 'msg_post_del',
        role: 'user',
        content: '追加一条',
        timestamp: '2026-03-15T10:00:00.000Z',
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.id).toBe('msg_post_del');

    const beforeDel = await request(app).get(`/api/problem-cases/${caseId}/messages`).set('Authorization', 'Bearer ' + token);
    expect(beforeDel.body.items).toHaveLength(1);

    const delRes = await request(app)
      .delete(`/api/problem-cases/${caseId}/messages/msg_post_del`)
      .set('Authorization', 'Bearer ' + token);
    expect(delRes.status).toBe(204);

    const afterDel = await request(app).get(`/api/problem-cases/${caseId}/messages`).set('Authorization', 'Bearer ' + token);
    expect(afterDel.body.items).toHaveLength(0);
  });

  /** HTTP 适配器 toMessagePayload 会展开整条消息，内存/合并项上常见 taskId/role 为 null，须与 PATCH 一样通过 Zod（否则 400） */
  it('POST 追加消息允许可选字段为 null（与前端展开形状一致）', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '测试客户',
        customerNeedsOrChallenges: '需求',
        customerItStatus: '现状',
        projectTimeRequirement: '时间',
      });
    const caseId = createResponse.body.id as string;

    const postRes = await request(app)
      .post(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        id: 'msg_null_fields',
        role: null,
        taskId: null,
        taskName: null,
        type: 'system',
        content: 'ok',
        timestamp: '2026-03-15T10:00:00.000Z',
        confirmed: null,
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.id).toBe('msg_null_fields');
  });

  it('GET /api/problem-cases/:id/report 数据缺失时 200，五模块空态不报错', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '空态客户',
        customerNeedsOrChallenges: '',
        customerItStatus: '',
        projectTimeRequirement: '',
      });
    const caseId = createResponse.body.id as string;

    const reportRes = await request(app)
      .get(`/api/problem-cases/${caseId}/report`)
      .set('Authorization', 'Bearer ' + token);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.reportMeta.caseId).toBe(caseId);
    expect(reportRes.body.reportMeta.customerName).toBe('空态客户');
    expect(typeof reportRes.body.reportMeta.generatedAt).toBe('string');
    expect(Array.isArray(reportRes.body.valueStream.stages)).toBe(true);
    expect(reportRes.body.globalItGap.analysis).toBeNull();
    expect(reportRes.body.businessObjects.items).toEqual([]);
    expect(reportRes.body.businessObjects.graph.edges).toEqual([]);
  });

  it('GET /api/problem-cases/:id/report 完整案例字段时五模块可聚合', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createResponse = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '完整客户',
        customerNeedsOrChallenges: '需要数字化',
        customerItStatus: '分散',
        projectTimeRequirement: 'Q2',
      });
    const caseId = createResponse.body.id as string;

    const putRes = await request(app)
      .put(`/api/problem-cases/${caseId}`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        basicInfo: { company_name: '完整公司' },
        requirementLogic:
          '## 1. 行业底层逻辑与竞争共性\n\n行业段\n\n## 2. 初步需求与商业模式的"因果关联"\n\n因果段\n\n## 3. 需求背后的深层动机\n\n动机段\n\n## 4. 逻辑链条总结\n\n总结一句',
        valueStream: {
          stages: [
            {
              name: '阶段甲',
              steps: [
                {
                  name: '环节A',
                  itStatus: { type: '手工', detail: 'Excel' },
                  painPoint: '效率低',
                },
              ],
            },
          ],
        },
        globalItGapAnalysisJson: { gaps: [{ id: 'g1' }] },
        coreBusinessObjectSessions: [
          {
            stepIndex: 0,
            stepName: '环节A',
            coreBusinessObjectJson: {
              entities: [
                {
                  entity_name: '订单',
                  object_usage: '流转',
                  category: '单据',
                  fields: [{ field_name: 'oid', type: 'string', description: '单号' }],
                  relations: [{ target_entity: '客户', relation_type: 'n:1' }],
                },
              ],
            },
          },
        ],
      });
    expect(putRes.status).toBe(200);

    const reportRes = await request(app)
      .get(`/api/problem-cases/${caseId}/report`)
      .set('Authorization', 'Bearer ' + token);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.demandInsight.enterpriseCustomerBackground).toContain('完整公司');
    expect(reportRes.body.demandInsight.requirementLogicSections?.logicChainSummary).toContain('总结一句');
    expect(reportRes.body.valueStream.stages[0].steps[0].name).toBe('环节A');
    expect(reportRes.body.valueStream.stages[0].steps[0].itStatusLabel).toContain('手工');
    expect(reportRes.body.globalItGap.analysis).toEqual({ gaps: [{ id: 'g1' }] });
    expect(reportRes.body.businessObjects.items.length).toBeGreaterThanOrEqual(1);
    expect(reportRes.body.businessObjects.graph.edges.length).toBeGreaterThanOrEqual(1);
    expect(reportRes.body.reportMeta.sectionAvailability.demandInsight).toBe(true);
    expect(reportRes.body.reportMeta.sectionAvailability.valueStream).toBe(true);
    expect(reportRes.body.reportMeta.sectionAvailability.globalItGap).toBe(true);
    expect(reportRes.body.reportMeta.sectionAvailability.businessObjects).toBe(true);
  });
});
