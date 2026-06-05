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

const MB = 1024 * 1024;

/** 构造合法 v1 导入包，通过单条 message.content 控制近似 body 体积 */
function buildMinimalImportPackage(contentRepeat: number) {
  return {
    schemaVersion: 1 as const,
    exportedAt: '2026-03-22T12:00:00.000Z',
    case: {
      customerName: '大包导入',
      customerNeedsOrChallenges: 'n',
      customerItStatus: 's',
      projectTimeRequirement: 't',
    },
    messages: [
      {
        role: 'assistant' as const,
        content: 'x'.repeat(contentRepeat),
        timestamp: '2026-03-22T12:00:00.000Z',
      },
    ],
  };
}

describe('problem case import / export', () => {
  let repository: InMemoryProblemCaseRepository;
  const token = (() => {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
    return jwt.sign({ userId: 'adm_test', username: 'admin_test', role: 'admin', sid: 'sess_stub' }, secret as any, { expiresIn: '2h' } as any);
  })();

  beforeEach(() => {
    repository = new InMemoryProblemCaseRepository();
  });

  it('exports a case as JSON package', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createRes = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '导出客户',
        customerNeedsOrChallenges: '需求',
        customerItStatus: '现状',
        projectTimeRequirement: '一个月',
      });
    expect(createRes.status).toBe(201);
    const caseId = createRes.body.id;

    await request(app)
      .post(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        role: 'user',
        content: 'hello',
        timestamp: new Date().toISOString(),
      });

    const exportRes = await request(app)
      .get(`/api/problem-cases/${caseId}/export`)
      .set('Authorization', 'Bearer ' + token);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toMatch(/application\/json/);
    const disp = String(exportRes.headers['content-disposition'] ?? '');
    expect(disp).toContain('filename*=UTF-8');
    const star = /filename\*=UTF-8''([^;\s]+)/i.exec(disp);
    expect(star?.[1]).toBeDefined();
    expect(decodeURIComponent(star![1])).toBe('导出客户_企业背景洞察.json');
    expect(exportRes.body.schemaVersion).toBe(1);
    expect(exportRes.body.exportedAt).toBeDefined();
    expect(exportRes.body.case.id).toBe(caseId);
    expect(exportRes.body.case.customerName).toBe('导出客户');
    expect(Array.isArray(exportRes.body.messages)).toBe(true);
    expect(exportRes.body.messages.length).toBe(1);
  });

  it('imports package as a new case with regenerated ids', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createRes = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '源案例',
        customerNeedsOrChallenges: 'A',
        customerItStatus: 'B',
        projectTimeRequirement: 'C',
      });
    const oldId = createRes.body.id;

    await request(app)
      .post(`/api/problem-cases/${oldId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        role: 'assistant',
        content: 'm1',
        timestamp: '2026-03-21T10:00:00.000Z',
      });

    const exportRes = await request(app)
      .get(`/api/problem-cases/${oldId}/export`)
      .set('Authorization', 'Bearer ' + token);
    expect(exportRes.status).toBe(200);
    const pkg = exportRes.body;
    pkg.case.id = 'evil_should_be_ignored';
    pkg.messages[0].id = 'evil_msg';
    pkg.messages[0].caseId = 'evil_case';

    const importRes = await request(app)
      .post('/api/problem-cases/import')
      .set('Authorization', 'Bearer ' + token)
      .send(pkg);

    expect(importRes.status).toBe(201);
    expect(importRes.body.schemaVersion).toBe(1);
    expect(importRes.body.importedMessageCount).toBe(1);
    expect(importRes.body.caseId).toBeDefined();
    expect(importRes.body.caseId).not.toBe(oldId);

    const detail = await request(app)
      .get(`/api/problem-cases/${importRes.body.caseId}`)
      .set('Authorization', 'Bearer ' + token);
    expect(detail.status).toBe(200);
    expect(detail.body.customerName).toBe('源案例');

    const msgs = await request(app)
      .get(`/api/problem-cases/${importRes.body.caseId}/messages`)
      .set('Authorization', 'Bearer ' + token);
    expect(msgs.body.items[0].caseId).toBe(importRes.body.caseId);
    expect(msgs.body.items[0].id).not.toBe('evil_msg');
  });

  it('import accepts optional clientMeta on package (ignored for new case)', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const pkg = {
      ...buildMinimalImportPackage(4),
      clientMeta: { displayArchiveNo: 2, displayCustomerName: '大包导入' },
    };

    const importRes = await request(app)
      .post('/api/problem-cases/import')
      .set('Authorization', 'Bearer ' + token)
      .send(pkg);

    expect(importRes.status).toBe(201);
    const detail = await request(app)
      .get(`/api/problem-cases/${importRes.body.caseId}`)
      .set('Authorization', 'Bearer ' + token);
    expect(detail.status).toBe(200);
    expect(detail.body.customerName).toBe('大包导入');
  });

  it('POST :id/restore overwrites same case when customerName matches package', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createRes = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '恢复源',
        customerNeedsOrChallenges: '旧需求',
        customerItStatus: '旧现状',
        projectTimeRequirement: '旧周期',
      });
    expect(createRes.status).toBe(201);
    const caseId = createRes.body.id;

    await request(app)
      .post(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token)
      .send({
        role: 'user',
        content: 'old-msg',
        timestamp: '2026-03-21T10:00:00.000Z',
      });

    const exportRes = await request(app)
      .get(`/api/problem-cases/${caseId}/export`)
      .set('Authorization', 'Bearer ' + token);
    expect(exportRes.status).toBe(200);
    const pkg = exportRes.body;
    pkg.case.customerNeedsOrChallenges = '新需求写回';
    pkg.messages = [
      {
        role: 'assistant' as const,
        content: 'restored-line',
        timestamp: '2026-03-22T15:00:00.000Z',
      },
    ];

    const restoreRes = await request(app)
      .post(`/api/problem-cases/${caseId}/restore`)
      .set('Authorization', 'Bearer ' + token)
      .send(pkg);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.caseId).toBe(caseId);
    expect(restoreRes.body.importedMessageCount).toBe(1);

    const detail = await request(app)
      .get(`/api/problem-cases/${caseId}`)
      .set('Authorization', 'Bearer ' + token);
    expect(detail.status).toBe(200);
    expect(detail.body.customerName).toBe('恢复源');
    expect(detail.body.customerNeedsOrChallenges).toBe('新需求写回');

    const msgs = await request(app)
      .get(`/api/problem-cases/${caseId}/messages`)
      .set('Authorization', 'Bearer ' + token);
    expect(msgs.body.items.length).toBe(1);
    expect(msgs.body.items[0].content).toBe('restored-line');
    expect(msgs.body.items[0].caseId).toBe(caseId);
  });

  it('POST :id/restore returns 400 when package customerName differs', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createRes = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '甲公司',
        customerNeedsOrChallenges: 'a',
        customerItStatus: 'b',
        projectTimeRequirement: 'c',
      });
    const caseId = createRes.body.id;

    const exportRes = await request(app)
      .get(`/api/problem-cases/${caseId}/export`)
      .set('Authorization', 'Bearer ' + token);
    const pkg = exportRes.body;
    pkg.case.customerName = '乙公司';

    const restoreRes = await request(app)
      .post(`/api/problem-cases/${caseId}/restore`)
      .set('Authorization', 'Bearer ' + token)
      .send(pkg);

    expect(restoreRes.status).toBe(400);
    expect(String(restoreRes.body.message)).toContain('客户名称');
  });

  it('export -> import -> GET 保留 requirementDetail/requirementDetailHistory/operationModel/businessStatus/urgencyAnalysis', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const createRes = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '字段保留源案例',
        customerNeedsOrChallenges: 'A',
        customerItStatus: 'B',
        projectTimeRequirement: 'C',
        requirementDetail: { summary: 'detail-v1' },
        requirementDetailHistory: [{ version: 1 }],
        operationModel: { mode: '渠道' },
        businessStatus: { stage: '扩张期' },
        urgencyAnalysis: { deferredFeatures: ['后续能力A'] },
      });
    expect(createRes.status).toBe(201);

    const exportRes = await request(app)
      .get(`/api/problem-cases/${createRes.body.id}/export`)
      .set('Authorization', 'Bearer ' + token);
    expect(exportRes.status).toBe(200);

    const importRes = await request(app)
      .post('/api/problem-cases/import')
      .set('Authorization', 'Bearer ' + token)
      .send(exportRes.body);
    expect(importRes.status).toBe(201);

    const detailRes = await request(app)
      .get(`/api/problem-cases/${importRes.body.caseId}`)
      .set('Authorization', 'Bearer ' + token);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.requirementDetail).toEqual({ summary: 'detail-v1' });
    expect(detailRes.body.requirementDetailHistory).toEqual([{ version: 1 }]);
    expect(detailRes.body.operationModel).toEqual({ mode: '渠道' });
    expect(detailRes.body.businessStatus).toEqual({ stage: '扩张期' });
    expect(detailRes.body.urgencyAnalysis).toEqual({ deferredFeatures: ['后续能力A'] });
  });

  it('export -> import -> GET 保留 preliminaryReq 与 task1 相关 extras（企业背景洞察 V2 初步需求）', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const prelimPayload = {
      version: 2,
      operationModel: { businessProcess: '流程A', orgStructure: '组织B' },
    };
    const createRes = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: '初步需求导入源',
        customerNeedsOrChallenges: 'A',
        customerItStatus: 'B',
        projectTimeRequirement: 'C',
        preliminaryReq: prelimPayload,
        task1PendingPreliminaryRequirement: false,
        task1InitialLlmQuery: { prompt: 'snap' },
      });
    expect(createRes.status).toBe(201);

    const exportRes = await request(app)
      .get(`/api/problem-cases/${createRes.body.id}/export`)
      .set('Authorization', 'Bearer ' + token);
    expect(exportRes.status).toBe(200);

    const importRes = await request(app)
      .post('/api/problem-cases/import')
      .set('Authorization', 'Bearer ' + token)
      .send(exportRes.body);
    expect(importRes.status).toBe(201);

    const detailRes = await request(app)
      .get(`/api/problem-cases/${importRes.body.caseId}`)
      .set('Authorization', 'Bearer ' + token);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.preliminaryReq).toEqual(prelimPayload);
    expect(detailRes.body.task1PendingPreliminaryRequirement).toBe(false);
    expect(detailRes.body.task1InitialLlmQuery).toEqual({ prompt: 'snap' });
  });

  it('rejects import when JSON package is missing required fields', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const res = await request(app)
      .post('/api/problem-cases/import')
      .set('Authorization', 'Bearer ' + token)
      .send({ schemaVersion: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('请求参数不合法');
  });

  it('rejects import when body is not valid JSON', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });

    const res = await request(app)
      .post('/api/problem-cases/import')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json')
      .send('{');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('请求体不是合法 JSON');
  });

  it(
    'accepts import package larger than global 8mb but under import-only 32mb limit',
    async () => {
      const { app } = createApp({
        problemCaseRepository: repository,
        problemCaseParser: new FakeParser(),
      });
      const pkg = buildMinimalImportPackage(9 * MB);
      const importRes = await request(app)
        .post('/api/problem-cases/import')
        .set('Authorization', 'Bearer ' + token)
        .send(pkg);

      expect(importRes.status).toBe(201);
      expect(importRes.body.importedMessageCount).toBe(1);
    },
    60_000,
  );

  it(
    'returns 413 when import JSON body exceeds import-only limit',
    async () => {
      const { app } = createApp({
        problemCaseRepository: repository,
        problemCaseParser: new FakeParser(),
      });
      const pkg = buildMinimalImportPackage(33 * MB);
      const importRes = await request(app)
        .post('/api/problem-cases/import')
        .set('Authorization', 'Bearer ' + token)
        .send(pkg);

      expect(importRes.status).toBe(413);
      expect(importRes.body.message).toBe('请求体超出限制');
    },
    120_000,
  );

  it('keeps other JSON routes on global 8mb limit', async () => {
    const { app } = createApp({
      problemCaseRepository: repository,
      problemCaseParser: new FakeParser(),
    });
    const res = await request(app)
      .post('/api/problem-cases')
      .set('Authorization', 'Bearer ' + token)
      .send({
        customerName: 'c',
        customerNeedsOrChallenges: 'y'.repeat(9 * MB),
        customerItStatus: 's',
        projectTimeRequirement: 't',
      });

    expect(res.status).toBe(413);
    expect(res.body.message).toBe('请求体超出限制');
  }, 60_000);
});
