/**
 * [INPUT]: 进程环境变量、`../config` 的 `env`
 * [OUTPUT]: 生产环境启动前 secret 自检、共享错误文案
 * [POS]: 部署/运维辅助，不参与业务契约
 *
 * [PROTOCOL]: 自检规则或标准报错文案变更时，同步更新 `backend/docs/secrets-init.md` 与 `DEPLOYMENT.md`
 */
import { env } from '../config';

/** 生产环境 JWT 未显式配置时的标准说明（启动前自检） */
export function buildProductionJwtSecretInvalidMessage(): string {
  return [
    '[Smart CTO] 生产环境启动失败：JWT_SECRET 未配置或使用了不安全的默认值。',
    '',
    '原因：',
    '  - NODE_ENV=production 时必须显式设置 JWT_SECRET（不会使用开发默认 dev_jwt_secret）。',
    '',
    '请按以下步骤修复：',
    '  1) 在 backend 目录执行：node scripts/generate-deploy-secrets.cjs',
    '  2) 将输出的 JWT_SECRET（及建议的 AI_CONFIG_ENCRYPTION_SECRET）写入 backend/.env 或等价环境变量。',
    '  3) 重启后端进程。',
    '',
    '详细说明见 backend/docs/secrets-init.md。',
  ].join('\n');
}

/** 生产环境无法解析 AI 加密密钥时的标准说明（与 ai-config 抛错共用） */
export function buildProductionAiEncryptionMissingMessage(): string {
  return [
    '[Smart CTO] 生产环境无法加解密用户 AI Key：',
    '  AI_CONFIG_ENCRYPTION_SECRET 与 JWT_SECRET 均未配置为非空值。',
    '',
    '请按以下步骤修复：',
    '  1) 在 backend 目录执行：node scripts/generate-deploy-secrets.cjs',
    '  2) 将至少 JWT_SECRET、建议同时写入 AI_CONFIG_ENCRYPTION_SECRET。',
    '  3) 重启后端。',
    '',
    '若此前已落库用户 AI 配置，更换加密密钥会导致无法解密；需保持与当时一致的密钥或引导用户重新保存 AI Key。',
    '详见 backend/docs/secrets-init.md。',
  ].join('\n');
}

const WARN_MISSING_AI_CONFIG =
  '[Smart CTO] 生产环境提示：未设置 AI_CONFIG_ENCRYPTION_SECRET，用户 AI Key 将使用 JWT_SECRET 派生密钥加密。' +
  ' 建议首次部署执行 `node scripts/generate-deploy-secrets.cjs` 并写入独立 AI_CONFIG_ENCRYPTION_SECRET。详见 backend/docs/secrets-init.md。';

/**
 * production 下在监听端口前调用：显式要求 JWT_SECRET，不自动生成、不静默使用 dev 默认值。
 * 不改动 AI 加解密的业务分支，仅收紧「能启动的 production」前提。
 */
export function assertProductionSecretsOrExit(): void {
  if (env.NODE_ENV !== 'production') return;

  const jwt = process.env.JWT_SECRET?.trim();
  if (!jwt || jwt === 'dev_jwt_secret') {
    console.error(buildProductionJwtSecretInvalidMessage());
    process.exit(1);
  }

  const ai = process.env.AI_CONFIG_ENCRYPTION_SECRET?.trim();
  if (!ai) {
    console.warn(WARN_MISSING_AI_CONFIG);
  }
}
