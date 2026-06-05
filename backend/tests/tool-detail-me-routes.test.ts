import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('tool detail me routes', () => {
  const makeUserToken = () => {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    return jwt.sign(
      { userId: 'tool_detail_rt', username: 'tool_detail_rt', role: 'user', sid: 'sess_stub' },
      secret as string,
      { expiresIn: '2h' } as jwt.SignOptions,
    );
  };

  it('returns 401 without auth for workspace', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/me/tool-detail/workspace');
    expect(res.status).toBe(401);
  });

  it('GET workspace returns payload with valid JWT', async () => {
    const { app } = createApp();
    const token = makeUserToken();
    const res = await request(app)
      .get('/api/me/tool-detail/workspace')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.payload).toMatchObject({ version: 1, byToolId: {} });
  });

  it('PUT workspace returns ok with valid JWT', async () => {
    const { app } = createApp();
    const token = makeUserToken();
    const body = {
      payload: {
        version: 1,
        byToolId: {},
      },
    };
    const res = await request(app)
      .put('/api/me/tool-detail/workspace')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
