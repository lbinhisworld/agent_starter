import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('problem-cases actions auth', () => {
  it('denies POST /api/problem-cases/:caseId/messages', async () => {
    const { app } = createApp();
    const res = await request(app).post('/api/problem-cases/case_1/messages').send({ content: 'hi', type: 'taskStartNotification' });
    expect(res.status).toBe(401);
  });

  it('denies DELETE /api/problem-cases/:caseId/messages/:messageId', async () => {
    const { app } = createApp();
    const res = await request(app).delete('/api/problem-cases/case_1/messages/msg_1');
    expect(res.status).toBe(401);
  });

  it('denies PATCH /api/problem-cases/:caseId/messages/:messageId', async () => {
    const { app } = createApp();
    const res = await request(app).patch('/api/problem-cases/case_1/messages/msg_1').send({ content: 'x' });
    expect(res.status).toBe(401);
  });

  it('denies POST /api/problem-cases/:caseId/tasks/:taskId/start', async () => {
    const { app } = createApp();
    const res = await request(app).post('/api/problem-cases/case_1/tasks/task1/start').send({ content: 'start' });
    expect(res.status).toBe(401);
  });

  it('denies POST /api/problem-cases/:caseId/tasks/:taskId/confirm', async () => {
    const { app } = createApp();
    const res = await request(app).post('/api/problem-cases/case_1/tasks/task1/confirm').send({ content: 'confirm' });
    expect(res.status).toBe(401);
  });

  it('denies POST /api/problem-cases/:caseId/tasks/:taskId/revise', async () => {
    const { app } = createApp();
    const res = await request(app).post('/api/problem-cases/case_1/tasks/task1/revise').send({ content: 'revise' });
    expect(res.status).toBe(401);
  });

  it('denies POST /api/problem-cases/:caseId/tasks/:taskId/rollback', async () => {
    const { app } = createApp();
    const res = await request(app).post('/api/problem-cases/case_1/tasks/task1/rollback').send({ content: 'rollback' });
    expect(res.status).toBe(401);
  });
});

