import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

/** 任务 0 工具原语落库路由须注册在 problem-cases 路由器上（404 多为未 build/未重启） */
describe('design-detail sync-task0-toolbox-primitives route', () => {
  it('returns 401 without auth (route registered, not 404)', async () => {
    const { app } = createApp();
    const res = await request(app)
      .post('/api/problem-cases/case_stub/design-detail/sync-task0-toolbox-primitives')
      .set('Content-Type', 'application/json')
      .send({ primitives: [{ featureKey: 'k', tokenDisplay: 'k/t', toolName: 't', value: 'v' }] });
    expect(res.status).toBe(401);
  });

  it('returns 400 when primitives lack featureKey/value (featureId 由服务端分配，非必填)', async () => {
    const { app } = createApp();
    const res = await request(app)
      .post('/api/problem-cases/case_stub/design-detail/sync-task0-toolbox-primitives')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer invalid')
      .send({ primitives: [{ featureKey: 'k', value: '' }] });
    expect(res.status).not.toBe(404);
  });
});
