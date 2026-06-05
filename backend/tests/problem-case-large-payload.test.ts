import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { InMemoryProblemCaseRepository } from '../src/modules/problem-cases/in-memory-problem-case.repository';

function makeAdminToken() {
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
  return jwt.sign({ userId: 'adm_test', username: 'admin_test', role: 'admin', sid: 'sess_stub' }, secret as any, {
    expiresIn: '2h',
  } as any);
}

describe('problem case large payload compatibility', () => {
  it('keeps legacy PUT /messages usable for payloads larger than 2mb', async () => {
    const repository = new InMemoryProblemCaseRepository();
    const { app } = createApp({ problemCaseRepository: repository });
    const token = makeAdminToken();

    const createRes = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: 'large payload case',
        customerNeedsOrChallenges: 'compat',
        customerItStatus: 'compat',
        projectTimeRequirement: 'compat',
      });
    expect(createRes.status).toBe(201);

    const caseId = createRes.body.id as string;
    const largeContent = 'A'.repeat(3_200_000);

    const syncRes = await request(app)
      .put(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        items: [
          {
            id: 'msg_large_payload',
            role: 'assistant',
            type: 'bulkSync',
            content: largeContent,
            timestamp: '2026-03-22T00:00:00.000Z',
            confirmed: false,
          },
        ],
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.items).toHaveLength(1);
    expect(syncRes.body.items[0].id).toBe('msg_large_payload');
  });
});
