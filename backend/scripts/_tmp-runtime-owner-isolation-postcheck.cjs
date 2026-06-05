/**
 * [INPUT]: 复验刚才创建的 userA/userB 是否在 3003 上可见新 case
 * [OUTPUT]: 只输出 owner 过滤是否生效（不输出任何密码）
 */
/* eslint-disable no-console */
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
const ports = { admin: 3003, readA: 3003, readB: 3002 };

const usernameA = 'rt_userA_1774429734408_9b78';
const usernameB = 'rt_userB_1774429734408_9c2c';
const caseId = 'problem_337d1094';

const adminToken = jwt.sign(
  { userId: 'adm_runtime', username: 'admin_runtime', role: 'admin' },
  secret,
  { expiresIn: '8h' },
);

async function http(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function signUserToken({ userId, username }) {
  return jwt.sign({ userId, username, role: 'user' }, secret, { expiresIn: '8h' });
}

async function main() {
  const baseAdmin = `http://127.0.0.1:${ports.admin}`;
  const list = await http('GET', `${baseAdmin}/api/admin/users`, adminToken);
  if (list.status !== 200 || !list.json || !Array.isArray(list.json.items)) {
    throw new Error(`admin list users failed: ${list.status} ${list.text}`);
  }

  const uA = list.json.items.find((u) => u && u.username === usernameA);
  const uB = list.json.items.find((u) => u && u.username === usernameB);
  if (!uA || !uA.id) throw new Error(`cannot find userA: ${usernameA}`);
  if (!uB || !uB.id) throw new Error(`cannot find userB: ${usernameB}`);

  const tokenA = signUserToken({ userId: String(uA.id), username: uA.username });
  const tokenB = signUserToken({ userId: String(uB.id), username: uB.username });

  // userA 在 3003 是否能看到刚创建的 case（验证 create+owner 写入是否正常）
  for (const [label, port, token] of [
    ['userA->3003', 3003, tokenA],
    ['userB->3002', 3002, tokenB],
  ]) {
    const base = `http://127.0.0.1:${port}`;
    const r = await http('GET', `${base}/api/problem-cases`, token);
    if (r.status !== 200) {
      console.log(`[postcheck] ${label} list failed: ${r.status} ${r.text}`);
      continue;
    }
    const items = Array.isArray(r.json && r.json.items) ? r.json.items : [];
    const includes = items.some((x) => x && String(x.id) === String(caseId));
    console.log(`[postcheck] ${label} items=${items.length} includesCaseId=${includes ? 'Y' : 'N'}`);
    const created = items.find((x) => x && String(x.id) === String(caseId));
    if (created) {
      const has = {
        idOk: typeof created.ownerSubjectId === 'string' && created.ownerSubjectId.length > 0,
        typeOk: created.ownerSubjectType === 'user' || created.ownerSubjectType === 'admin',
        snapOk: typeof created.ownerUsernameSnapshot === 'string' && created.ownerUsernameSnapshot.length > 0,
      };
      console.log(
        `[postcheck] ${label} created-case owner presence: ownerSubjectId=${has.idOk ? 'Y' : 'N'} ownerSubjectType=${
          has.typeOk ? 'Y' : 'N'
        } ownerUsernameSnapshot=${has.snapOk ? 'Y' : 'N'}`,
      );
    }
  }
}

main().catch((e) => {
  console.error('[postcheck] FAILED:', e && e.message ? e.message : e);
  process.exit(1);
});

