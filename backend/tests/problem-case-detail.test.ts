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

describe('problem case detail routes', () => {
  let repository: InMemoryProblemCaseRepository;
  const token = (() => {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    return jwt.sign({ userId: 'adm_test', username: 'admin_test', role: 'admin', sid: 'sess_stub' }, secret as any, { expiresIn: '2h' } as any);
  })();

  beforeEach(() => {
    repository = new InMemoryProblemCaseRepository();
  });

  it('returns detail, empty messages, and task summaries', async () => {
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

    const detailResponse = await request(app).get(`/api/problem-cases/${caseId}`).set('Authorization', 'Bearer ' + token);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.id).toBe(caseId);

    const messagesResponse = await request(app)
      .get(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token);
    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.body.items).toEqual([]);

    const tasksResponse = await request(app).get(`/api/problem-cases/${caseId}/tasks`).set('Authorization', 'Bearer ' + token);
    expect(tasksResponse.status).toBe(200);
    expect(tasksResponse.body.items).toHaveLength(13);
    expect(tasksResponse.body.items[0]).toMatchObject({
      taskId: 'task1',
      status: 'current',
    });
  });
});
