// 回归测试：翻译「断线续译」—— MV3 后台 SW 被系统中断（端口断开）时，
// 不再把整批 356 行任务一断了之，而是重试当前批次、从断点续上。
// 真实抽取 content.js 里的 isTransientConnErr / sendTranslateBatchWithRetry 来跑（与实现不漂移）
const fs = require('fs');
const path = require('path');

const contentJs = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

// 抽取从 isTransientConnErr 到 sendTranslateBatchWithRetry（startTranslation 之前）整段
const segStart = contentJs.indexOf('function isTransientConnErr');
const segEndMarker = contentJs.indexOf('async function startTranslation');
if (segStart < 0 || segEndMarker < 0) { console.error('✗ 找不到断线续译代码段'); process.exit(1); }
const segSrc = contentJs.slice(segStart, segEndMarker);

// 自由变量：sendToBackground 仅作为 sendFn 兜底，测试里始终传 sendFn，给个空实现避免解析期引用报错
const makeCtx = new Function('var sendToBackground=function(){}; ' + segSrc +
  '\nreturn { isTransientConnErr: isTransientConnErr, sendTranslateBatchWithRetry: sendTranslateBatchWithRetry };')();

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };

// 受控 sendFn：按给定序列依次返回结果，并记录调用次数
function mockSend(seq) {
  let i = 0;
  const fn = () => { const r = seq[Math.min(i, seq.length - 1)]; i++; return Promise.resolve(r); };
  fn.calls = () => i;
  return fn;
}

const TRANSIENT = '后台连接断开，正在重连…';

(async () => {
  console.log('— A. isTransientConnErr 分类正确性 —');
  ok('「后台连接断开」算瞬时', makeCtx.isTransientConnErr(TRANSIENT) === true);
  ok('「Receiving end」算瞬时', makeCtx.isTransientConnErr('Could not establish connection. Receiving end does not exist.') === true);
  ok('「Could not establish connection」算瞬时', makeCtx.isTransientConnErr('Could not establish connection.') === true);
  ok('「后台响应超时」算瞬时', makeCtx.isTransientConnErr('后台响应超时（服务工作者可能已被系统中断）') === true);
  ok('「Extension context invalidated」不算瞬时（另行处理，不重试）', makeCtx.isTransientConnErr('Extension context invalidated') === false);
  ok('401 不算瞬时', makeCtx.isTransientConnErr('HTTP 401 (auth)') === false);
  ok('404 不算瞬时', makeCtx.isTransientConnErr('HTTP 404 Not Found') === false);
  ok('429 不算瞬时', makeCtx.isTransientConnErr('HTTP 429 限流') === false);
  ok('null 不算瞬时', makeCtx.isTransientConnErr(null) === false);

  console.log('— B. 断线续译：首批次遇瞬时错误，重试后成功 —');
  {
    const s = mockSend([{ ok: false, error: TRANSIENT }, { ok: true, result: '你好' }]);
    const r = await makeCtx.sendTranslateBatchWithRetry({ type: 'translateBatch', texts: ['hi'] }, { sendFn: s });
    ok('重试后返回成功', r && r.ok === true && r.result === '你好');
    ok('恰好重试 1 次（共 2 次调用）', s.calls() === 2);
  }

  console.log('— C. 上下文失效：不重试，直接终止并回调 onInvalidated —');
  {
    let invalidated = null;
    const s = mockSend([{ ok: false, error: 'Extension context invalidated. Please reload.' }]);
    const r = await makeCtx.sendTranslateBatchWithRetry(
      { type: 'translateBatch', texts: ['hi'] },
      { sendFn: s, onInvalidated: (e) => { invalidated = e; } }
    );
    ok('仅调用 1 次（不重试）', s.calls() === 1);
    ok('返回 fatal', r && r.ok === false && /invalidated/i.test(r.fatal || ''));
    ok('触发 onInvalidated 回调', !!invalidated);
  }

  console.log('— D. 真实业务错误（401）：不重试，直接上报 —');
  {
    const s = mockSend([{ ok: false, error: 'HTTP 401 (auth)' }]);
    const r = await makeCtx.sendTranslateBatchWithRetry({ type: 'translateBatch', texts: ['hi'] }, { sendFn: s });
    ok('仅调用 1 次（不重试）', s.calls() === 1);
    ok('返回 fatal 含 401', r && r.ok === false && /401/.test(r.fatal || ''));
  }

  console.log('— E. 持续瞬时错误：耗尽 maxAttempts 后返回 fatal —');
  {
    const s = mockSend([{ ok: false, error: TRANSIENT }]);
    const r = await makeCtx.sendTranslateBatchWithRetry(
      { type: 'translateBatch', texts: ['hi'] }, { sendFn: s, maxAttempts: 3 }
    );
    ok('调用次数 == maxAttempts(3)', s.calls() === 3);
    ok('返回 fatal（非 ok）', r && r.ok === false && !!r.fatal);
  }

  console.log('— F. 已中止：不再发请求 —');
  {
    const s = mockSend([{ ok: true, result: 'x' }]);
    const r = await makeCtx.sendTranslateBatchWithRetry(
      { type: 'translateBatch', texts: ['hi'] }, { sendFn: s, isAborted: () => true }
    );
    ok('返回 aborted', r && r.aborted === true);
    ok('未发送任何请求', s.calls() === 0);
  }

  console.log('\n通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
  process.exit(fail ? 1 : 0);
})();
