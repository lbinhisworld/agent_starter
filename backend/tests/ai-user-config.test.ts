import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiConfigService,
  AI_CONFIG_REQUIRED_CODE,
  AI_CONFIG_VERIFY_FAILED_CODE,
  FORBIDDEN_CODE,
} from '../src/modules/ai/ai-config.service';

type Store = {
  appSettings: any[];
  userAiConfigs: any[];
};

function pickSelected<T extends Record<string, any>>(item: T | null, select?: Record<string, boolean>) {
  if (!item) return null;
  if (!select) return item;

  const out: Record<string, any> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) {
      out[key] = item[key];
    }
  }
  return out;
}

function makeMockPrisma(store: Store) {
  const prisma: any = {
    appSetting: {
      findMany: async ({ where }: any) =>
        store.appSettings
          .filter((item) => where?.key?.in?.includes(item.key))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      upsert: async ({ where, update, create }: any) => {
        const idx = store.appSettings.findIndex((item) => item.key === where.key);
        if (idx >= 0) {
          store.appSettings[idx] = {
            ...store.appSettings[idx],
            ...update,
            updatedAt: new Date(),
          };
          return store.appSettings[idx];
        }

        const item = {
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.appSettings.push(item);
        return item;
      },
    },
    userAiConfig: {
      findUnique: async ({ where, select }: any) => {
        const item = store.userAiConfigs.find((config) => config.userId === where.userId || config.id === where.id) || null;
        return pickSelected(item, select);
      },
      upsert: async ({ where, update, create, select }: any) => {
        const idx = store.userAiConfigs.findIndex((config) => config.userId === where.userId);
        if (idx >= 0) {
          store.userAiConfigs[idx] = {
            ...store.userAiConfigs[idx],
            ...update,
            updatedAt: new Date(),
          };
          return pickSelected(store.userAiConfigs[idx], select);
        }

        const item = {
          id: create.id || `uac_${store.userAiConfigs.length + 1}`,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.userAiConfigs.push(item);
        return pickSelected(item, select);
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  };

  return prisma;
}

describe('AiConfigService user-first gate', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getMyConfigStatus 对未配置用户返回默认摘要', async () => {
    const store: Store = {
      appSettings: [],
      userAiConfigs: [],
    };
    const service = new AiConfigService(makeMockPrisma(store));

    const result = await service.getMyConfigStatus({
      userId: 'user_1',
      username: 'alice',
      role: 'user',
      sid: 'sess_1',
    });

    expect(result).toMatchObject({
      provider: 'deepseek',
      configured: false,
      verified: false,
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      verifiedAt: null,
    });
  });

  it('saveMyConfig 验证成功后以密文落库并标记 verifiedAt', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'OK' } }],
      }),
    });

    const store: Store = {
      appSettings: [],
      userAiConfigs: [],
    };
    const service = new AiConfigService(makeMockPrisma(store));

    const result = await service.saveMyConfig(
      {
        userId: 'user_1',
        username: 'alice',
        role: 'user',
        sid: 'sess_1',
      },
      {
        apiKey: 'sk-valid-user-key',
      },
    );

    expect(result.verified).toBe(true);
    expect(result.verifiedAt).toEqual(expect.any(String));
    expect(store.userAiConfigs).toHaveLength(1);
    expect(store.userAiConfigs[0].apiKeyCiphertext).not.toBe('sk-valid-user-key');
    expect(store.userAiConfigs[0].verifiedAt).toBeInstanceOf(Date);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('saveMyConfig 上游验证失败时不得错误放行或入库', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'Invalid API key' },
      }),
    });

    const store: Store = {
      appSettings: [],
      userAiConfigs: [],
    };
    const service = new AiConfigService(makeMockPrisma(store));

    await expect(
      service.saveMyConfig(
        {
          userId: 'user_1',
          username: 'alice',
          role: 'user',
          sid: 'sess_1',
        },
        {
          apiKey: 'sk-invalid-user-key',
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: AI_CONFIG_VERIFY_FAILED_CODE,
    });
    expect(store.userAiConfigs).toHaveLength(0);
  });

  it('getResolvedConfigForChat 对未验证业务用户返回 428 AI_CONFIG_REQUIRED，且不回退系统配置', async () => {
    const now = new Date();
    const store: Store = {
      appSettings: [
        { key: 'ai.deepseek.apiKey', value: 'sk-system-key', description: 'system key', createdAt: now, updatedAt: now },
      ],
      userAiConfigs: [],
    };
    const service = new AiConfigService(makeMockPrisma(store));

    await expect(
      service.getResolvedConfigForChat({
        userId: 'user_1',
        username: 'alice',
        role: 'user',
        sid: 'sess_1',
      }),
    ).rejects.toMatchObject({
      status: 428,
      code: AI_CONFIG_REQUIRED_CODE,
    });
  });

  it('getResolvedConfigForChat 对管理员继续读取系统级 AppSetting', async () => {
    const now = new Date();
    const store: Store = {
      appSettings: [
        { key: 'ai.deepseek.apiKey', value: 'sk-system-key', description: 'system key', createdAt: now, updatedAt: now },
        { key: 'ai.deepseek.apiUrl', value: 'https://api.deepseek.com/v1/chat/completions', description: 'system url', createdAt: now, updatedAt: now },
        { key: 'ai.deepseek.model', value: 'deepseek-chat', description: 'system model', createdAt: now, updatedAt: now },
      ],
      userAiConfigs: [],
    };
    const service = new AiConfigService(makeMockPrisma(store));

    const result = await service.getResolvedConfigForChat({
      userId: 'admin_1',
      username: 'root',
      role: 'admin',
      sid: 'sess_admin_1',
    });

    expect(result).toMatchObject({
      source: 'system',
      apiKey: 'sk-system-key',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
    });
  });

  it('getMyConfigStatus / saveMyConfig 对 admin 会被最小权限收口', async () => {
    const store: Store = {
      appSettings: [],
      userAiConfigs: [],
    };
    const service = new AiConfigService(makeMockPrisma(store));

    await expect(
      service.getMyConfigStatus({
        userId: 'admin_1',
        username: 'root',
        role: 'admin',
        sid: 'sess_admin_1',
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: FORBIDDEN_CODE,
    });

    await expect(
      service.saveMyConfig(
        {
          userId: 'admin_1',
          username: 'root',
          role: 'admin',
          sid: 'sess_admin_1',
        },
        {
          apiKey: 'sk-admin-should-not-save',
        },
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: FORBIDDEN_CODE,
    });
  });
});
