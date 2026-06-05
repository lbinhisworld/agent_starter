import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

/**
 * 工具经验：/api/me/tool-experience/* 须挂在统一 meRouter 上（Express 5 下同 path 多次 use 不会顺延）。
 */
describe('tool experience me routes', () => {
  const makeUserToken = () => {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    return jwt.sign(
      { userId: 'tool_exp_rt', username: 'tool_exp_rt', role: 'user', sid: 'sess_stub' },
      secret as string,
      { expiresIn: '2h' } as jwt.SignOptions,
    );
  };

  it('returns 401 without auth for knowledge-tree', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/me/tool-experience/knowledge-tree');
    expect(res.status).toBe(401);
  });

  it('returns 401 without auth for chat-state', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/me/tool-experience/chat-state');
    expect(res.status).toBe(401);
  });

  it('GET knowledge-tree returns payload with valid JWT', async () => {
    const { app } = createApp();
    const token = makeUserToken();
    const res = await request(app)
      .get('/api/me/tool-experience/knowledge-tree')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.payload).toMatchObject({
      version: 1,
      productEntries: [],
      comparisonEntries: [],
      scenarioEntries: [],
    });
  });

  it('PUT knowledge-tree returns ok with valid JWT', async () => {
    const { app } = createApp();
    const token = makeUserToken();
    const body = {
      payload: {
        version: 1,
        productEntries: [],
        comparisonEntries: [],
        scenarioEntries: [],
      },
    };
    const res = await request(app)
      .put('/api/me/tool-experience/knowledge-tree')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET chat-state returns payload with valid JWT', async () => {
    const { app } = createApp();
    const token = makeUserToken();
    const res = await request(app)
      .get('/api/me/tool-experience/chat-state')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.payload).toMatchObject({
      version: 1,
      messages: [],
      inputDraft: '',
    });
  });

  it('PUT chat-state returns ok with valid JWT', async () => {
    const { app } = createApp();
    const token = makeUserToken();
    const body = {
      payload: {
        version: 1,
        messages: [],
        inputDraft: '',
      },
    };
    const res = await request(app)
      .put('/api/me/tool-experience/chat-state')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
