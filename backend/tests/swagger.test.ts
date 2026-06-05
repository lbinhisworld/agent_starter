import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('swagger endpoints', () => {
  const makeAdminToken = () => {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    return jwt.sign({ userId: 'adm_test', username: 'admin_test', role: 'admin', sid: 'sess_stub' }, secret as any, {
      expiresIn: '2h',
    } as any);
  };

  it('denies openapi json without auth', async () => {
    const { app } = createApp();

    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(401);
  });

  it('serves openapi json with auth', async () => {
    const { app } = createApp();
    const token = makeAdminToken();

    const response = await request(app).get('/openapi.json').set('Authorization', 'Bearer ' + token);

    expect(response.status).toBe(200);
    expect(response.body.info.title).toBe('Smart CTO Backend API');
  });
});
