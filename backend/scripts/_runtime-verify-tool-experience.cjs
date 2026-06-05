/**
 * 运行时复验：工具经验 GET/PUT /api/me/tool-experience/knowledge-tree 与 chat-state
 *
 * 用法：
 *   node scripts/_runtime-verify-tool-experience.cjs [baseUrl]
 *
 * 真实库（非 vitest stub）下 JWT 须对应 DB 里存在的 AuthSession，请传入浏览器登录后的 token：
 *   TOOL_EXP_VERIFY_BEARER='eyJ...' node scripts/_runtime-verify-tool-experience.cjs http://127.0.0.1:3002
 *
 * 未设置 TOOL_EXP_VERIFY_BEARER 时，使用与单测 stub 一致的 sess_stub 签名（仅无库 / 测试桩场景可用）。
 */
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const base = (process.argv[2] || 'http://127.0.0.1:3002').replace(/\/$/, '');
const secret = process.env.JWT_SECRET || 'dev_jwt_secret';

let token = (process.env.TOOL_EXP_VERIFY_BEARER || '').trim();
if (token.toLowerCase().startsWith('bearer ')) token = token.slice(7).trim();
if (!token) {
  token = jwt.sign(
    { userId: 'adm_test', username: 'admin_test', role: 'admin', sid: 'sess_stub' },
    secret,
    { expiresIn: '2h' },
  );
}

async function authFetch(path, opts = {}) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...opts.headers,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  const ktGet = await authFetch('/api/me/tool-experience/knowledge-tree', { method: 'GET' });
  if (ktGet.status !== 200 || !ktGet.body || !ktGet.body.payload) {
    console.error('FAIL GET knowledge-tree', ktGet.status, ktGet.body);
    if (ktGet.status === 401) {
      console.error('若 401：请用浏览器登录后复制 access token，设置 TOOL_EXP_VERIFY_BEARER 再运行本脚本。');
    }
    if (ktGet.status === 404) {
      console.error('若 404：监听进程多半不是本仓库最新 dist，请在 backend 执行 npm run build 后重启。');
    }
    process.exit(1);
  }

  const ktPut = await authFetch('/api/me/tool-experience/knowledge-tree', {
    method: 'PUT',
    body: JSON.stringify({
      payload: {
        version: 1,
        productEntries: [],
        comparisonEntries: [],
        scenarioEntries: [],
      },
    }),
  });
  if (ktPut.status !== 200 || !ktPut.body || ktPut.body.ok !== true) {
    console.error('FAIL PUT knowledge-tree', ktPut.status, ktPut.body);
    process.exit(1);
  }

  const csGet = await authFetch('/api/me/tool-experience/chat-state', { method: 'GET' });
  if (csGet.status !== 200 || !csGet.body || !csGet.body.payload) {
    console.error('FAIL GET chat-state', csGet.status, csGet.body);
    process.exit(1);
  }

  const csPut = await authFetch('/api/me/tool-experience/chat-state', {
    method: 'PUT',
    body: JSON.stringify({
      payload: { version: 1, messages: [], inputDraft: '' },
    }),
  });
  if (csPut.status !== 200 || !csPut.body || csPut.body.ok !== true) {
    console.error('FAIL PUT chat-state', csPut.status, csPut.body);
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, base }, null, 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
