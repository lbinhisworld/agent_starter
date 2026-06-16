import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('health endpoint', () => {
  it('returns service health payload', async () => {
    const { app } = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      service: 'smart-cto-backend',
    });
  });

  it('returns cors headers for browser requests', async () => {
    const { app } = createApp();

    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:6667');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:6667');
  });
});
