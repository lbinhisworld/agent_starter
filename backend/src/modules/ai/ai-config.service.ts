/**
 * [INPUT]: `PrismaClient`、`crypto`、`zod`、当前登录态 `JwtAuthPayload`
 * [OUTPUT]: 系统级 AI 配置读写、AppUser 个人 AI 配置状态查询 / 保存并验证、AI chat 配置真相源解析
 * [POS]: AI 配置域服务层（系统配置与用户级已验证配置的统一入口）
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md（若存在）
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { JwtAuthPayload } from '../auth/auth.service';
import { buildProductionAiEncryptionMissingMessage } from '../../lib/production-secrets';

const AI_SETTING_KEYS = {
  apiKey: 'ai.deepseek.apiKey',
  apiUrl: 'ai.deepseek.apiUrl',
  model: 'ai.deepseek.model',
} as const;

const DEFAULT_AI_CONFIG = {
  provider: 'deepseek',
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  model: 'deepseek-chat',
} as const;

const AI_CONFIG_REQUIRED_CODE = 'AI_CONFIG_REQUIRED';
const AI_CONFIG_VERIFY_FAILED_CODE = 'AI_CONFIG_VERIFY_FAILED';
const AI_PROVIDER_TIMEOUT_CODE = 'AI_PROVIDER_TIMEOUT';
const AI_PROVIDER_UNREACHABLE_CODE = 'AI_PROVIDER_UNREACHABLE';
const FORBIDDEN_CODE = 'FORBIDDEN';
const BAD_REQUEST_CODE = 'BAD_REQUEST';

const VERIFICATION_TIMEOUT_MS = Number(process.env.AI_CONFIG_VERIFY_TIMEOUT_MS || 20_000);

type SettingMap = {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  updatedAt?: Date;
};

type KnownServiceError = Error & {
  status: number;
  code?: string;
};

type UserAiConfigSnapshot = {
  provider: string;
  apiKeyCiphertext: string;
  apiUrl: string;
  model: string;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
} | null;

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const optionalUrlSchema = z.preprocess(
  normalizeOptionalString,
  z.string().url('API URL 必须是合法 URL').optional(),
);

const optionalNonEmptyStringSchema = z.preprocess(
  normalizeOptionalString,
  z.string().min(1).optional(),
);

const updateAiConfigSchema = z.object({
  apiKey: optionalNonEmptyStringSchema,
  apiUrl: optionalUrlSchema,
  model: optionalNonEmptyStringSchema,
}).refine((value) => value.apiKey || value.apiUrl || value.model, {
  message: '至少提供一个系统级 AI 配置字段',
});

const saveMyAiConfigSchema = z.object({
  apiKey: z.string().trim().min(1, 'DeepSeek API Key 必填'),
  apiUrl: optionalUrlSchema,
  model: optionalNonEmptyStringSchema,
});

function createServiceError(status: number, message: string, code?: string): KnownServiceError {
  return Object.assign(new Error(message), { status, code });
}

function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  }

  const firstIssue = parsed.error.issues[0];
  throw createServiceError(400, firstIssue?.message || '请求参数不合法', BAD_REQUEST_CODE);
}

function toIsoStringOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getAiConfigEncryptionSecret() {
  const explicit = process.env.AI_CONFIG_ENCRYPTION_SECRET?.trim();
  if (explicit) return explicit;

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (jwtSecret) return jwtSecret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(buildProductionAiEncryptionMissingMessage());
  }

  return 'dev_ai_config_encryption_secret';
}

function getAiConfigEncryptionKey() {
  return createHash('sha256')
    .update(getAiConfigEncryptionSecret())
    .digest();
}

function encryptApiKey(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getAiConfigEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

function decryptApiKey(cipherText: string) {
  const [version, ivBase64, tagBase64, encryptedBase64] = cipherText.split('.');
  if (
    version !== 'v1' ||
    !ivBase64 ||
    !tagBase64 ||
    !encryptedBase64
  ) {
    throw new Error('Unsupported AI config ciphertext format');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getAiConfigEncryptionKey(),
    Buffer.from(ivBase64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

function ensureAppUser(payload: JwtAuthPayload) {
  if (payload.role !== 'user') {
    throw createServiceError(403, '仅业务用户可操作个人模型配置', FORBIDDEN_CODE);
  }
}

export class AiConfigService {
  constructor(private readonly prisma: PrismaClient) {}

  async getPublicConfig() {
    const settings = await this.getSettingMap();

    return {
      provider: DEFAULT_AI_CONFIG.provider,
      hasApiKey: Boolean(settings.apiKey),
      apiUrl: settings.apiUrl || DEFAULT_AI_CONFIG.apiUrl,
      model: settings.model || DEFAULT_AI_CONFIG.model,
      updatedAt: toIsoStringOrNull(settings.updatedAt),
    };
  }

  async updateConfig(payload: unknown) {
    const input = parseOrThrow(updateAiConfigSchema, payload);

    await this.prisma.$transaction(async (tx) => {
      if (input.apiKey) {
        await this.upsertSetting(tx, AI_SETTING_KEYS.apiKey, input.apiKey, 'DeepSeek API key');
      }

      if (input.apiUrl) {
        await this.upsertSetting(tx, AI_SETTING_KEYS.apiUrl, input.apiUrl, 'DeepSeek API URL');
      }

      if (input.model) {
        await this.upsertSetting(tx, AI_SETTING_KEYS.model, input.model, 'DeepSeek model');
      }
    });

    return this.getPublicConfig();
  }

  async getMyConfigStatus(auth: JwtAuthPayload) {
    ensureAppUser(auth);

    const record = await this.prisma.userAiConfig.findUnique({
      where: { userId: auth.userId },
      select: {
        provider: true,
        apiKeyCiphertext: true,
        apiUrl: true,
        model: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.mapMyConfigStatus(record);
  }

  async saveMyConfig(auth: JwtAuthPayload, payload: unknown) {
    ensureAppUser(auth);
    const input = parseOrThrow(saveMyAiConfigSchema, payload);

    const resolved = {
      provider: DEFAULT_AI_CONFIG.provider,
      apiKey: input.apiKey,
      apiUrl: input.apiUrl || DEFAULT_AI_CONFIG.apiUrl,
      model: input.model || DEFAULT_AI_CONFIG.model,
    };

    await this.verifyUserConfig(resolved);

    const now = new Date();
    const apiKeyCiphertext = encryptApiKey(resolved.apiKey);
    const saved = await this.prisma.userAiConfig.upsert({
      where: { userId: auth.userId },
      update: {
        provider: resolved.provider,
        apiKeyCiphertext,
        apiUrl: resolved.apiUrl,
        model: resolved.model,
        verifiedAt: now,
      },
      create: {
        userId: auth.userId,
        provider: resolved.provider,
        apiKeyCiphertext,
        apiUrl: resolved.apiUrl,
        model: resolved.model,
        verifiedAt: now,
      },
      select: {
        provider: true,
        apiKeyCiphertext: true,
        apiUrl: true,
        model: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.mapMyConfigStatus(saved);
  }

  async getResolvedConfigForChat(auth: JwtAuthPayload) {
    if (auth.role === 'user') {
      const record = await this.prisma.userAiConfig.findUnique({
        where: { userId: auth.userId },
        select: {
          provider: true,
          apiKeyCiphertext: true,
          apiUrl: true,
          model: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!record || !record.verifiedAt || !record.apiKeyCiphertext) {
        throw createServiceError(
          428,
          '当前用户尚未完成个人模型配置验证，请先前往模型配置页保存并验证。',
          AI_CONFIG_REQUIRED_CODE,
        );
      }

      return {
        provider: record.provider || DEFAULT_AI_CONFIG.provider,
        apiKey: decryptApiKey(record.apiKeyCiphertext),
        apiUrl: record.apiUrl || DEFAULT_AI_CONFIG.apiUrl,
        model: record.model || DEFAULT_AI_CONFIG.model,
        source: 'user' as const,
      };
    }

    const settings = await this.getSettingMap();
    return {
      provider: DEFAULT_AI_CONFIG.provider,
      apiKey: settings.apiKey || '',
      apiUrl: settings.apiUrl || DEFAULT_AI_CONFIG.apiUrl,
      model: settings.model || DEFAULT_AI_CONFIG.model,
      source: 'system' as const,
    };
  }

  private mapMyConfigStatus(record: UserAiConfigSnapshot) {
    return {
      provider: record?.provider || DEFAULT_AI_CONFIG.provider,
      configured: Boolean(record?.apiKeyCiphertext),
      verified: Boolean(record?.verifiedAt),
      apiUrl: record?.apiUrl || DEFAULT_AI_CONFIG.apiUrl,
      model: record?.model || DEFAULT_AI_CONFIG.model,
      verifiedAt: toIsoStringOrNull(record?.verifiedAt),
      createdAt: toIsoStringOrNull(record?.createdAt),
      updatedAt: toIsoStringOrNull(record?.updatedAt),
    };
  }

  private async verifyUserConfig(config: { apiKey: string; apiUrl: string; model: string }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Reply with OK only.' }],
          temperature: 0,
          max_tokens: 1,
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      const err = error as {
        name?: string;
        message?: string;
        cause?: { code?: string; hostname?: string; message?: string };
      };
      if (err?.name === 'AbortError') {
        throw createServiceError(
          504,
          `DeepSeek 配置验证超时（超过 ${VERIFICATION_TIMEOUT_MS / 1000} 秒）`,
          AI_PROVIDER_TIMEOUT_CODE,
        );
      }

      const causeCode = err?.cause?.code;
      const causeHost = err?.cause?.hostname;
      const causeMsg = err?.cause?.message || err?.message || 'unknown';
      const suffix = causeCode
        ? `${causeCode}${causeHost ? ` ${causeHost}` : ''}: ${causeMsg}`
        : causeMsg;
      throw createServiceError(
        502,
        `DeepSeek 配置验证失败，无法连接上游：${suffix}`,
        AI_PROVIDER_UNREACHABLE_CODE,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const providerMessage =
        data?.error?.message ||
        data?.message ||
        `上游返回状态 ${response.status}`;
      throw createServiceError(
        400,
        `DeepSeek 配置验证失败：${providerMessage}`,
        AI_CONFIG_VERIFY_FAILED_CODE,
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw createServiceError(
        400,
        'DeepSeek 配置验证失败：上游响应不符合预期',
        AI_CONFIG_VERIFY_FAILED_CODE,
      );
    }
  }

  private async getSettingMap(): Promise<SettingMap> {
    const items = await this.prisma.appSetting.findMany({
      where: {
        key: {
          in: Object.values(AI_SETTING_KEYS),
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const map: SettingMap = {};
    for (const item of items) {
      if (!map.updatedAt) {
        map.updatedAt = item.updatedAt;
      }

      if (item.key === AI_SETTING_KEYS.apiKey) map.apiKey = item.value;
      if (item.key === AI_SETTING_KEYS.apiUrl) map.apiUrl = item.value;
      if (item.key === AI_SETTING_KEYS.model) map.model = item.value;
    }

    return map;
  }

  private upsertSetting(
    prisma: Pick<PrismaClient, 'appSetting'>,
    key: string,
    value: string,
    description: string,
  ) {
    return prisma.appSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });
  }
}

export {
  AI_CONFIG_REQUIRED_CODE,
  AI_CONFIG_VERIFY_FAILED_CODE,
  AI_PROVIDER_TIMEOUT_CODE,
  AI_PROVIDER_UNREACHABLE_CODE,
  FORBIDDEN_CODE,
  BAD_REQUEST_CODE,
};
