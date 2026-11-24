import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const context = { console };
context.globalThis = context;
context.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
context.atob = (s) => Buffer.from(s, 'base64').toString('binary');
context.TextEncoder = TextEncoder;
context.TextDecoder = TextDecoder;
context.fetch = () => { throw new Error('unexpected network'); };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./writing-plan-github.js', import.meta.url), 'utf8'), context);
const api = context.WritingPlanGitHub;
const TOKEN = 'github_pat_SECRETVALUE';

function plan() {
  return {
    title: 'Photo Story 写作计划',
    phases: [{ name: '第一步', items: [{ text: '补写布达佩斯开篇', done: false }, { text: '补写雅典收尾', done: false }] }],
    daily: {
      tasks: [
        { date: '2026-11-19', text: '布达佩斯开篇：回忆出发，列要点', done: false },
        { date: '2026-11-20', text: '布达佩斯开篇：写初稿前半', done: false }
      ]
    }
  };
}

test('toggles one daily task and leaves the rest', () => {
  const applied = api.applyWritingPlanDone(plan(), { type: 'daily', date: '2026-11-19', text: '布达佩斯开篇：回忆出发，列要点' }, true);
  assert.equal(applied.ok, true);
  assert.equal(applied.plan.daily.tasks[0].done, true);
  assert.equal(applied.plan.daily.tasks[1].done, false);
  assert.equal(applied.plan.phases[0].items[0].done, false);
  assert.equal(api.commitMessage(true, applied.title), 'tick: 布达佩斯开篇：回忆出发，列要点');
  assert.equal(api.commitMessage(false, applied.title), 'untick: 布达佩斯开篇：回忆出发，列要点');
});

test('refuses a daily task when the text no longer matches', () => {
  const applied = api.applyWritingPlanDone(plan(), { type: 'daily', date: '2026-11-19', text: '别的任务' }, true);
  assert.equal(applied.ok, false);
});

test('toggles a phase item by index', () => {
  const applied = api.applyWritingPlanDone(plan(), { type: 'phase', phaseIndex: 0, itemIndex: 1, text: '补写雅典收尾' }, true);
  assert.equal(applied.ok, true);
  assert.equal(applied.plan.phases[0].items[1].done, true);
  assert.equal(applied.plan.phases[0].items[0].done, false);
});

test('round-trips unicode JSON through GitHub base64', () => {
  const text = JSON.stringify(plan(), null, 2) + '\n';
  const wrapped = api.encodeGithubContent(text).replace(/(.{60})/g, '$1\n');
  assert.equal(api.decodeGithubContent(wrapped), text);
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

test('PUT uses the GET sha and does not put the token in the commit', async () => {
  const calls = [];
  const file = JSON.stringify(plan(), null, 2) + '\n';
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', headers: opts.headers, body: opts.body });
    if (!opts.method || opts.method === 'GET') {
      return jsonResponse(200, { sha: 'sha-1', content: api.encodeGithubContent(file) });
    }
    return jsonResponse(200, { content: { sha: 'sha-2' } });
  };
  const result = await api.saveWritingPlanDone({
    token: TOKEN,
    target: { type: 'daily', date: '2026-11-20', text: '布达佩斯开篇：写初稿前半' },
    done: true,
    fetchImpl
  });
  assert.equal(result.plan.daily.tasks[1].done, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.Authorization, 'Bearer ' + TOKEN);
  const put = JSON.parse(calls[1].body);
  assert.equal(put.sha, 'sha-1');
  assert.equal(put.branch, 'main');
  assert.equal(put.message, 'tick: 布达佩斯开篇：写初稿前半');
  assert.equal(put.message.includes('SECRETVALUE'), false);
  const saved = JSON.parse(api.decodeGithubContent(put.content));
  assert.equal(saved.daily.tasks[1].done, true);
  assert.equal(saved.daily.tasks[0].done, false);
});

test('retries once after a 409 and uses the new sha', async () => {
  const calls = [];
  const file = JSON.stringify(plan(), null, 2) + '\n';
  const fetchImpl = async (url, opts = {}) => {
    const n = calls.length;
    calls.push(opts.method || 'GET');
    if (!opts.method || opts.method === 'GET') {
      return jsonResponse(200, { sha: n === 0 ? 'old' : 'new', content: api.encodeGithubContent(file) });
    }
    if (n === 1) return jsonResponse(409, {});
    const body = JSON.parse(opts.body);
    assert.equal(body.sha, 'new');
    return jsonResponse(200, {});
  };
  await api.saveWritingPlanDone({
    token: TOKEN,
    target: { type: 'daily', date: '2026-11-19', text: '布达佩斯开篇：回忆出发，列要点' },
    done: true,
    fetchImpl
  });
  assert.deepEqual(calls, ['GET', 'PUT', 'GET', 'PUT']);
});

test('a second 409 fails and does not loop', async () => {
  let puts = 0;
  const file = JSON.stringify(plan(), null, 2) + '\n';
  const fetchImpl = async (url, opts = {}) => {
    if (!opts.method || opts.method === 'GET') return jsonResponse(200, { sha: 's' + puts, content: api.encodeGithubContent(file) });
    puts++;
    return jsonResponse(409, {});
  };
  await assert.rejects(
    () => api.saveWritingPlanDone({
      token: TOKEN,
      target: { type: 'daily', date: '2026-11-19', text: '布达佩斯开篇：回忆出发，列要点' },
      done: true,
      fetchImpl
    }),
    (err) => err.status === 409 && !String(err.message).includes('SECRETVALUE')
  );
  assert.equal(puts, 2);
});

test('401 and 403 and 404 stop before a second request', async () => {
  for (const status of [401, 403, 404]) {
    let calls = 0;
    const fetchImpl = async () => { calls++; return jsonResponse(status, {}); };
    await assert.rejects(
      () => api.saveWritingPlanDone({
        token: TOKEN,
        target: { type: 'daily', date: '2026-11-19', text: '布达佩斯开篇：回忆出发，列要点' },
        done: true,
        fetchImpl
      }),
      (err) => err.status === status && !err.message.includes(TOKEN)
    );
    assert.equal(calls, 1);
  }
});
