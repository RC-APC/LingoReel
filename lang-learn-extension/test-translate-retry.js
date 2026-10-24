// 回归测试：sendToBackground 对 MV3「服务工作者唤醒竞态 / 上下文失效」的健壮性
// 场景 1：首次 sendMessage 报 "Receiving end does not exist"，重试后成功 → 拿到成功载荷
// 场景 2：连续 N 次都报该错 → 耗尽重试后返回 {ok:false,error}
// 场景 3：其它错误（如 401）不应重试，直接透出
// 场景 4：Extension context invalidated → 返回失效提示，不无限重试
// 场景 5：正常网络 → 直接成功，仅 1 次调用
// 真实抽取 content.js 里的实现源码来跑（与实现不漂移）
const fs = require('fs');
const path = require('path');

const contentJs = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

// —— 抽取「sendToBackground + sendToBackgroundCb + isTransientConnErr」整段源码（括号/花括号匹配）——
const segStart = contentJs.indexOf('function sendToBackground');
const segEndMarker = contentJs.indexOf('async function sendTranslateBatchWithRetry');
if (segStart < 0 || segEndMarker < 0) { console.error('✗ 找不到通信层代码段'); process.exit(1); }
const segSrc = contentJs.slice(segStart, segEndMarker);

// 自由变量：chrome.runtime.*（由形参提供）；showToast 在 invalidated 分支才用到，给个空实现
const makeCtx = (chromeObj) => new Function('chrome', 'var showToast=function(){}; ' + segSrc +
  '\nreturn { sendToBackground: sendToBackground, isTransientConnErr: isTransientConnErr };')(chromeObj);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };

// —— sendMessage 模拟：chrome.runtime.sendMessage 与 lastError 挂同一对象 ——
function makeRuntime(behave) {
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
  console.log('— 场景1：首次 Receiving end，第二次成功（重试后命中）—');
  {
    const rt = makeRuntime((k) => k === 0
      ? { error: 'Could not establish connection. Receiving end does not exist.' }
      : { response: { ok: true, result: 'hello' } });
    const ctx = makeCtx({ runtime: rt });
    const r = await ctx.sendToBackground({ type: 'translateBatch', texts: ['a'] });
    ok('首次失败后重试并成功', r && r.ok === true && r.result === 'hello');
  }

  console.log('— 场景2：每次都 Receiving end（3 次重试用尽）—');
  {
    const rt = makeRuntime(() => ({ error: 'Could not establish connection. Receiving end does not exist.' }));
    const ctx = makeCtx({ runtime: rt });
    const r = await ctx.sendToBackground({ type: 'translateBatch', texts: ['a'] });
    ok('耗尽重试后返回 ok:false', r && r.ok === false && /Receiving end/.test(r.error));
  }

  console.log('— 场景3：其它错误（如 401）不应重试，直接透出 —');
  {
    const rt = makeRuntime(() => ({ error: 'HTTP 401 (auth)' }));
    const ctx = makeCtx({ runtime: rt });
    const r = await ctx.sendToBackground({ type: 'translateBatch', texts: ['a'] });
    ok('非连接类错误不重试', r && r.ok === false && /401/.test(r.error));
  }

  console.log('— 场景4：Extension context invalidated → 返回失效提示，不无限重试 —');
  {
    const rt = makeRuntime(() => ({ error: 'Extension context invalidated. Please reload.' }));
    const ctx = makeCtx({ runtime: rt });
    const r = await ctx.sendToBackground({ type: 'translateBatch', texts: ['a'] });
    ok('返回失效提示', r && r.ok === false && /失效|invalidated/i.test(r.error));
  }

  console.log('— 场景5：正常网络 → 直接成功，仅 1 次调用 —');
  {
    let calls = 0;
    const rt = { lastError: null, sendMessage(_m, cb) { calls++; cb({ ok: true, result: 'ok' }); } };
    const ctx = makeCtx({ runtime: rt });
    const r = await ctx.sendToBackground({ type: 'translateBatch', texts: ['a'] });
    ok('成功返回', r && r.ok === true && r.result === 'ok');
    ok('仅调用 1 次', calls === 1);
  }

  console.log('— 场景6：isTransientConnErr 分类正确性 —');
  {
    const ctx = makeCtx({ runtime: {} });
    ok('「Receiving end」算瞬时', ctx.isTransientConnErr('Could not establish connection. Receiving end does not exist.') === true);
    ok('「后台响应超时」算瞬时', ctx.isTransientConnErr('后台响应超时（服务工作者可能已被系统中断）') === true);
    ok('「Extension context invalidated」不算瞬时', ctx.isTransientConnErr('Extension context invalidated') === false);
    ok('401 不算瞬时', ctx.isTransientConnErr('HTTP 401 (auth)') === false);
    ok('429 不算瞬时', ctx.isTransientConnErr('HTTP 429 限流') === false);
  }

  console.log('\n通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
  process.exit(fail ? 1 : 0);
})();
