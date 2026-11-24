/* GitHub Contents API helpers for ticking writing-plan tasks.
   The token is passed in by the caller and is never logged here. */
(function (root) {
  const API = 'https://api.github.com/repos/Kangstantine/my-daily-tracker/contents/data/writing-plan.json';

  function encodeGithubContent(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function decodeGithubContent(content) {
    const bin = atob(String(content || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function githubErrorMessage(status) {
    if (status === 401) return '令牌无效或已过期。请点「令牌设置」换一个。';
    if (status === 403) return '没有写入权限。请确认 token 只授权给 Kangstantine/my-daily-tracker，并且 Contents 是 Read and write。';
    if (status === 404) return '找不到 data/writing-plan.json。请确认 token 勾选了这个仓库。';
    if (status === 409) return '文件刚被更新，请再试一次。';
    if (!status) return '网络错误，没有保存。';
    return '保存失败（HTTP ' + status + '）。';
  }

  function applyWritingPlanDone(plan, target, done) {
    const next = JSON.parse(JSON.stringify(plan));
    let task = null;
    if (target && target.type === 'daily') {
      const tasks = next.daily && next.daily.tasks;
      task = Array.isArray(tasks) ? tasks.find(t => t && t.date === target.date) : null;
      if (task && target.text && task.text !== target.text) task = null;
    } else if (target && target.type === 'phase') {
      const phase = next.phases && next.phases[target.phaseIndex];
      const item = phase && phase.items && phase.items[target.itemIndex];
      task = item && (!target.text || item.text === target.text) ? item : null;
    }
    if (!task) return { ok: false, message: '找不到这项任务，请刷新后再试。' };
    task.done = !!done;
    return { ok: true, plan: next, title: typeof task.text === 'string' ? task.text : 'task' };
  }

  function commitMessage(done, title) {
    const clean = String(title || 'task').replace(/\s+/g, ' ').trim().slice(0, 72);
    return (done ? 'tick: ' : 'untick: ') + clean;
  }

  function ghHeaders(token) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function fail(status) {
    const err = new Error(githubErrorMessage(status));
    err.status = status || 0;
    return err;
  }

  async function saveWritingPlanDone(opts) {
    const token = opts && opts.token;
    const target = opts && opts.target;
    const done = !!(opts && opts.done);
    const doFetch = (opts && opts.fetchImpl) || fetch;
    if (!token) throw fail(401);
    for (let attempt = 0; attempt < 2; attempt++) {
      let got;
      try {
        got = await doFetch(API + '?ref=main', { headers: ghHeaders(token) });
      } catch (e) {
        throw fail(0);
      }
      if (!got.ok) throw fail(got.status);
      const meta = await got.json();
      let plan;
      try {
        plan = JSON.parse(decodeGithubContent(meta.content));
      } catch (e) {
        throw fail(0);
      }
      const applied = applyWritingPlanDone(plan, target, done);
      if (!applied.ok) {
        const err = new Error(applied.message);
        err.status = 0;
        throw err;
      }
      const body = JSON.stringify(applied.plan, null, 2) + '\n';
      let put;
      try {
        put = await doFetch(API, {
          method: 'PUT',
          headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders(token)),
          body: JSON.stringify({
            message: commitMessage(done, applied.title),
            content: encodeGithubContent(body),
            sha: meta.sha,
            branch: 'main'
          })
        });
      } catch (e) {
        throw fail(0);
      }
      if (put.status === 409 && attempt === 0) continue;
      if (!put.ok) throw fail(put.status);
      return { plan: applied.plan };
    }
    throw fail(409);
  }

  root.WritingPlanGitHub = {
    encodeGithubContent,
    decodeGithubContent,
    githubErrorMessage,
    applyWritingPlanDone,
    commitMessage,
    saveWritingPlanDone
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
