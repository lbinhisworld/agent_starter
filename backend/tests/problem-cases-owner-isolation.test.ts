import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { InMemoryProblemCaseRepository } from '../src/modules/problem-cases/in-memory-problem-case.repository';
import { ProblemCaseParsePreview, ProblemCaseParser } from '../src/modules/problem-cases/types';

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

describe('problem case owner isolation (online mode)', () => {
  let repository: InMemoryProblemCaseRepository;

  const signToken = (payload: { userId: string; username: string; role: 'user' | 'admin' }) => {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    return jwt.sign({ ...payload, sid: `sess_${payload.userId}` }, secret as any, { expiresIn: '2h' } as any);
  };

  const userA = signToken({ userId: 'user_A', username: 'userA', role: 'user' });
  const userB = signToken({ userId: 'user_B', username: 'userB', role: 'user' });
  const admin = signToken({ userId: 'adm_test', username: 'admin_test', role: 'admin' });

  beforeEach(() => {
    repository = new InMemoryProblemCaseRepository();
  });

  it('user A 创建后仅自己列表可见；user B 访问详情/消息/任务/报告/导出及写案例 均 404', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createRes = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + userA)
      .send({
        customerName: 'case_A',
        customerNeedsOrChallenges: 'needs',
        customerItStatus: 'status',
        projectTimeRequirement: 'time',
      });

    expect(createRes.status).toBe(201);
    const caseId = createRes.body.id as string;

    const listA = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + userA);
    expect(listA.status).toBe(200);
    expect(listA.body.items).toHaveLength(1);
    expect(listA.body.items[0].id).toBe(caseId);
    expect(listA.body.items[0]).not.toHaveProperty('createdBy');

    const listB = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + userB);
    expect(listB.status).toBe(200);
    expect(listB.body.items).toHaveLength(0);

    const listAdmin = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + admin);
    expect(listAdmin.status).toBe(200);
    expect(listAdmin.body.items).toHaveLength(1);
    expect(listAdmin.body.items[0].id).toBe(caseId);
    expect(listAdmin.body.items[0].createdBy).toBe('userA');

    const endpoints404: Array<[string, string?]> = [
      [`/api/problem-cases/${caseId}`, 'get detail'],
      [`/api/problem-cases/${caseId}/messages`, 'get messages'],
      [`/api/problem-cases/${caseId}/tasks`, 'get tasks'],
      [`/api/problem-cases/${caseId}/report`, 'get report'],
      [`/api/problem-cases/${caseId}/export`, 'get export'],
    ] as any;

    for (const [url] of endpoints404) {
      const res = await request(app).get(url).set('Authorization', 'Bearer ' + userB);
      expect(res.status).toBe(404);
    }

    const putCaseRes = await request(app)
      .put(`/api/problem-cases/${caseId}`)
      .set('Authorization', 'Bearer ' + userB)
      .send({ customerName: 'hijack' });
    expect(putCaseRes.status).toBe(404);
  });

  it('import 后新案例 owner 归导入者：user B 列表看不到，访问详情 404', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const pkg = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      case: {
        id: 'legacy_case_id',
        customerName: 'import_client',
        customerNeedsOrChallenges: 'needs',
        customerItStatus: 'status',
        projectTimeRequirement: 'time',
      },
      messages: [
        {
          id: 'msg_legacy_1',
          role: 'system',
          type: 'basicInfoCard',
          content: 'hello',
          timestamp: '2026-03-15T10:00:00.000Z',
          confirmed: true,
          payloadJson: { data: [{ label: '企业名称', value: 'import_client' }] },
        },
      ],
    };

    const importRes = await request(app)
      .post('/api/problem-cases/import')
      .set('Authorization', 'Bearer ' + userA)
      .send(pkg);

    expect(importRes.status).toBe(201);
    const caseId = importRes.body.caseId as string;
    expect(caseId).toBeDefined();

    const listB = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + userB);
    expect(listB.status).toBe(200);
    expect(listB.body.items).toHaveLength(0);

    const detailB = await request(app)
      .get(`/api/problem-cases/${caseId}`)
      .set('Authorization', 'Bearer ' + userB);
    expect(detailB.status).toBe(404);

    const listA = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + userA);
    expect(listA.status).toBe(200);
    expect(listA.body.items).toHaveLength(1);
  });

  it('owner 为空历史案例：user 不可见、admin 可见', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    // 直接调用 repository 创建，绕过服务端 owner 注入 -> 制造历史 owner 为空的 case
    const seeded = await repository.create({
      customerName: 'legacy_hist_case',
      customerNeedsOrChallenges: 'needs',
      customerItStatus: 'status',
      projectTimeRequirement: 'time',
    });

    const seededId = seeded.id;
    expect(seeded.ownerSubjectId).toBeUndefined();
    expect(seeded.ownerSubjectType).toBeUndefined();

    const listUser = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + userA);
    expect(listUser.status).toBe(200);
    expect(listUser.body.items).toHaveLength(0);

    const detailUser = await request(app)
      .get(`/api/problem-cases/${seededId}`)
      .set('Authorization', 'Bearer ' + userA);
    expect(detailUser.status).toBe(404);

    const listAdmin = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + admin);
    expect(listAdmin.status).toBe(200);
    expect(listAdmin.body.items).toHaveLength(1);
    expect(listAdmin.body.items[0].createdBy).toBe('未归属');

    const detailAdmin = await request(app)
      .get(`/api/problem-cases/${seededId}`)
      .set('Authorization', 'Bearer ' + admin);
    expect(detailAdmin.status).toBe(200);
  });

  it('owner 存在但 snapshot 为空时：admin list createdBy=未知用户', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    // 直接 seed：制造 owner 存在但 snapshot 为空串的历史数据
    const seeded = await repository.create({
      ownerSubjectId: 'user_seeded_x',
      ownerSubjectType: 'user',
      ownerUsernameSnapshot: '',
      customerName: 'legacy_owner_without_snapshot',
      customerNeedsOrChallenges: 'needs',
      customerItStatus: 'status',
      projectTimeRequirement: 'time',
    });

    const seededId = seeded.id;

    const listAdmin = await request(app).get('/api/problem-cases').set('Authorization', 'Bearer ' + admin);
    expect(listAdmin.status).toBe(200);
    const found = (listAdmin.body.items as any[]).find((x) => x && x.id === seededId);
    expect(found).toBeTruthy();
    expect(found.createdBy).toBe('未知用户');
  });
});

