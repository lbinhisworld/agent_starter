/**
 * [INPUT]: backend/.local/run/state.json（端口）、JWT_SECRET（可选）、本地后端运行实例
 * [OUTPUT]: owner 隔离运行时最小复验结果（stdout）
 * [POS]: local-only 运行时验证脚本；不进入正式服务 runtime
 *
 * [PROTOCOL]: 仅用于本地开发/验收；失败时必须返回非 0 退出码。
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

function readState() {
  const stateFile = path.resolve(__dirname, '..', '.local', 'run', 'state.json');
  if (!fs.existsSync(stateFile)) {
    throw new Error(`missing state file: ${stateFile}. Run .\\scripts\\start-local-backend.ps1 first.`);
  }
  // PowerShell 写文件可能带 BOM；这里做一次兼容剥离
  const raw = fs.readFileSync(stateFile, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
  return jwt.sign(payload, secret, { expiresIn: '2h' });
}

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
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const state = readState();
  const port = Number(state.port);
  const base = `http://127.0.0.1:${port}`;

  const tokenAdmin = signToken({ userId: 'adm_runtime', username: 'admin_runtime', role: 'admin' });

  console.log(`[rt-owner] base: ${base}`);

  async function ensureAppUser(username) {
    const created = await http('POST', `${base}/api/admin/users`, tokenAdmin, { username });
    if (created.status === 201 && created.json && created.json.user && created.json.user.id) {
      return { id: String(created.json.user.id), username: String(created.json.user.username || username) };
    }
    // 已存在时：409，转为 list 查 id
    if (created.status === 409) {
      const list = await http('GET', `${base}/api/admin/users`, tokenAdmin);
      assert(list.status === 200 && Array.isArray(list.json.items), 'admin list users expected 200 with items[]');
      const found = list.json.items.find((u) => u && u.username === username);
      assert(found && found.id, `cannot find existing user in admin list: ${username}`);
      return { id: String(found.id), username };
    }
    throw new Error(`ensure user failed (${username}): ${created.status} ${created.text}`);
  }

  const userA = await ensureAppUser('userA_runtime');
  const userB = await ensureAppUser('userB_runtime');
  const tokenUserA = signToken({ userId: userA.id, username: userA.username, role: 'user' });
  const tokenUserB = signToken({ userId: userB.id, username: userB.username, role: 'user' });

  // userA create
  const created = await http('POST', `${base}/api/problem-cases`, tokenUserA, {
    customerName: `rt_case_${Date.now()}`,
    customerNeedsOrChallenges: 'needs',
    customerItStatus: 'status',
    projectTimeRequirement: 'time',
  });
  assert(created.status === 201, `userA create expected 201, got ${created.status}: ${created.text}`);
  const caseId = created.json && created.json.id;
  assert(typeof caseId === 'string' && caseId.length > 0, 'create response missing id');
  console.log(`[rt-owner] created caseId: ${caseId}`);

  // userB cannot see in list
  const listB = await http('GET', `${base}/api/problem-cases`, tokenUserB);
  assert(listB.status === 200, `userB list expected 200, got ${listB.status}`);
  assert(Array.isArray(listB.json.items), 'userB list missing items[]');
  assert(!listB.json.items.some((x) => x && x.id === caseId), 'userB list should not include userA case');

  // userB endpoints -> 404
  const endpoints = [
    ['GET', `/api/problem-cases/${caseId}`],
    ['GET', `/api/problem-cases/${caseId}/messages`],
    ['GET', `/api/problem-cases/${caseId}/tasks`],
    ['GET', `/api/problem-cases/${caseId}/report`],
    ['GET', `/api/problem-cases/${caseId}/export`],
    ['PUT', `/api/problem-cases/${caseId}`, { customerName: 'hijack' }],
  ];

  for (const entry of endpoints) {
    const method = entry[0];
    const p = entry[1];
    const body = entry.length >= 3 ? entry[2] : undefined;
    const r = await http(method, `${base}${p}`, tokenUserB, body);
    assert(r.status === 404, `userB ${method} ${p} expected 404, got ${r.status}`);
  }

  // admin can access
  const adminDetail = await http('GET', `${base}/api/problem-cases/${caseId}`, tokenAdmin);
  assert(adminDetail.status === 200, `admin detail expected 200, got ${adminDetail.status}`);

  // verify root backfill works: find one root-owned case from admin list, ensure userA cannot access it
  const adminList = await http('GET', `${base}/api/problem-cases`, tokenAdmin);
  assert(adminList.status === 200 && Array.isArray(adminList.json.items), 'admin list expected 200 with items[]');
  const rootOwned = adminList.json.items.find(
    (x) => x && x.ownerSubjectType === 'admin' && x.ownerUsernameSnapshot === 'root',
  );
  assert(rootOwned && rootOwned.id, 'expected at least one root-owned case (backfilled)');
  const rootCaseId = rootOwned.id;

  const userASeeRoot = await http('GET', `${base}/api/problem-cases/${rootCaseId}`, tokenUserA);
  assert(userASeeRoot.status === 404, `user should not access root-owned legacy case: got ${userASeeRoot.status}`);

  const adminSeeRoot = await http('GET', `${base}/api/problem-cases/${rootCaseId}`, tokenAdmin);
  assert(adminSeeRoot.status === 200, `admin should access root-owned legacy case: got ${adminSeeRoot.status}`);

  console.log('[rt-owner] OK: owner isolation verified (user 404, admin full access, root backfill hidden from user).');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[rt-owner] FAILED:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

