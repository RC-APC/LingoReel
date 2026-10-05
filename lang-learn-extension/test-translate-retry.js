// 回归测试：sendToBackground 对 MV3「服务工作者唤醒竞态」的重试
// 场景 1：第一条 sendMessage 报 "Receiving end does not exist"，重试后成功 → 应拿到成功载荷
// 场景 2：连续 N 次都报该错 → 应在耗尽重试后返回 {ok:false,error}
// 场景 3：其它错误（如 401）不应重试，直接透出
// 真实抽取 content.js 里的 sendToBackground 源码来跑（与实现不漂移）
const fs = require('fs');
const path = require('path');

const contentJs = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

// —— 抽取真实函数源码（括号匹配），避免手抄副本与实现脱节 ——
const start = contentJs.indexOf('function sendToBackground(msg, retries, timeoutMs)');
if (start < 0) { console.error('✗ 找不到 sendToBackground 定义'); process.exit(1); }
const braceStart = contentJs.indexOf('{', start);
let depth = 0, end = -1;
for (let i = braceStart; i < contentJs.length; i++) {
  const c = contentJs[i];
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const src = contentJs.slice(start, end);
// 函数体内引用自由变量 chrome.runtime.*，由外层 new Function 的形参 chrome 提供
const makeSend = (rt) => new Function('chrome', src + '\nreturn sendToBackground;')({ runtime: rt });

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };

function makeRuntime(behave) {
  // behave: (callIndex) => { error: string|null, response: any }
  // chrome.runtime.sendMessage 与 chrome.runtime.lastError 必须挂在同一对象上
  let n = 0;
  const rt = {
    lastError: null,
    sendMessage(_msg, cb) {
      const r = behave(n++);
      if (r.error) { rt.lastError = { message: r.error }; cb(null); }
      else { rt.lastError = null; cb(r.response); }
    }
  };
  return rt;
}

(async () => {
  console.log('— 场景1：首次 Receiving end，第二次成功 —');
  {
    const rt = makeRuntime((k) => k === 0
      ? { error: 'Could not establish connection. Receiving end does not exist.' }
      : { response: { ok: true, result: 'hello' } });
    const r = await makeSend(rt)({ type: 'translateBatch', texts: ['a'] });
    ok('首次失败后重试并成功', r && r.ok === true && r.result === 'hello');
  }

  console.log('— 场景2：每次都 Receiving end（3 次重试用尽） —');
  {
    const rt = makeRuntime(() => ({ error: 'Could not establish connection. Receiving end does not exist.' }));
    const r = await makeSend(rt)({ type: 'translateBatch', texts: ['a'] });
    ok('耗尽重试后返回 ok:false', r && r.ok === false && /Receiving end/.test(r.error));
  }

  console.log('— 场景3：其它错误（如 401）不应重试，直接透出 —');
  {
    const rt = makeRuntime(() => ({ error: 'HTTP 401 (auth)' }));
    const r = await makeSend(rt)({ type: 'translateBatch', texts: ['a'] });
    ok('非连接类错误不重试', r && r.ok === false && /401/.test(r.error));
  }

  console.log('\n通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
  process.exit(fail ? 1 : 0);
})();
