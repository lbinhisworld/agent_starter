/**
 * 一次性运行时复验：PATCH 与 PUT 占位保护（在 backend 目录执行，读取 .env 中 JWT_SECRET）
 * 用法：node scripts/_runtime-verify-messages.cjs [baseUrl]
 */
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const base = process.argv[2] || 'http://127.0.0.1:3002';
const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
const token = jwt.sign(
  { userId: 'rt_verify', username: 'rt_verify', role: 'admin' },
  secret,
  { expiresIn: '2h' },
);

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
  const create = await authFetch('/api/problem-cases', {
    method: 'POST',
    body: JSON.stringify({
      customerName: 'RTVerify messages',
      customerNeedsOrChallenges: '',
      customerItStatus: '',
      projectTimeRequirement: '',
    }),
  });
  if (create.status !== 201) {
    console.error('FAIL create', create.status, create.body);
    process.exit(1);
  }
  const caseId = create.body.id;

  const put1 = await authFetch(`/api/problem-cases/${caseId}/messages`, {
    method: 'PUT',
    body: JSON.stringify({
      items: [
        {
          id: 'rt_hist_1',
          role: 'user',
          content: '真实历史A',
          timestamp: '2026-03-15T10:00:00.000Z',
        },
        {
          id: 'rt_hist_2',
          role: 'assistant',
          content: '真实历史B',
          timestamp: '2026-03-15T10:01:00.000Z',
        },
      ],
    }),
  });
  if (put1.status !== 200 || put1.body.items?.length !== 2) {
    console.error('FAIL put1', put1.status, put1.body);
    process.exit(1);
  }

  const danger = await authFetch(`/api/problem-cases/${caseId}/messages`, {
    method: 'PUT',
    body: JSON.stringify({
      items: [
        {
          id: 'rt_ph',
          role: 'system',
          content: '请输入客户基本信息',
          timestamp: '2026-03-15T10:02:00.000Z',
        },
      ],
    }),
  });
  if (danger.status !== 200 || danger.body.items?.length !== 2) {
    console.error('FAIL placeholder put', danger.status, danger.body);
    process.exit(1);
  }
  const contents = danger.body.items.map((m) => m.content).sort();
  if (contents[0] !== '真实历史A' || contents[1] !== '真实历史B') {
    console.error('FAIL placeholder put preserved content', contents);
    process.exit(1);
  }

  const patch = await authFetch(`/api/problem-cases/${caseId}/messages/rt_hist_1`, {
    method: 'PATCH',
    body: JSON.stringify({ content: 'PATCH运行时', confirmed: true }),
  });
  if (patch.status !== 200 || patch.body.content !== 'PATCH运行时' || patch.body.confirmed !== true) {
    console.error('FAIL patch', patch.status, patch.body);
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      ok: true,
      base,
      caseId,
      placeholderPutItemCount: danger.body.items.length,
      patchContent: patch.body.content,
      patchConfirmed: patch.body.confirmed,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
