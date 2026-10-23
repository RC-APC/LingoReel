// 回归测试：sendToBackground 对 MV3「服务工作者唤醒竞态 / 上下文失效」的健壮性
// 场景 1：首次 sendMessage 报 "Receiving end does not exist"，重试后成功 → 拿到成功载荷
// 场景 2：连续 N 次都报该错 → 耗尽重试后返回 {ok:false,error}
// 场景 3：其它错误（如 401）不应重试，直接透出
// 场景 4：端口已就绪时走 port.postMessage，后台回包后正常 resolve
// 真实抽取 content.js 里的实现源码来跑（与实现不漂移）
const fs = require('fs');
const path = require('path');

const contentJs = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

// —— 抽取「端口层 + sendToBackground + sendToBackgroundCb」整段源码（括号/花括号匹配）——
const segStart = contentJs.indexOf('let lrPort = null;');
const segEndMarker = contentJs.indexOf('async function startTranslation');
if (segStart < 0 || segEndMarker < 0) { console.error('✗ 找不到端口层代码段'); process.exit(1); }
const segSrc = contentJs.slice(segStart, segEndMarker);

// 自由变量：chrome.runtime.*（由形参提供）；showToast 在 connect 异常分支才用到，给个空实现
const makeCtx = (chromeObj) => new Function('chrome', 'var showToast=function(){}; ' + segSrc +
  '\nreturn { sendToBackground: sendToBackground, lrConnect: lrConnect, getPort: function(){return lrPort;}, getReady: function(){return lrPortReady;} };')(chromeObj);

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
  console.log('— 场景1：首次 Receiving end，第二次成功（降级到 sendMessage 重试）—');
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

  console.log('— 场景4：端口就绪时走 port.postMessage，后台回包 resolve —');
  {
    const port = {
      _h: [],
      onMessage: { addListener: (fn) => port._h.push(fn) },
      onDisconnect: { addListener: () => {} },
      postMessage: (data) => {
        // 模拟后台处理：把 msg 透传成响应
        port._h.forEach((fn) => fn({ reqId: data.reqId, response: { ok: true, via: 'port', echo: data.msg.type } }));
      }
    };
    const connect = () => port;
    const ctx = makeCtx({ runtime: { connect } });
    // 触发端口建立（lrConnect 内部调用 chrome.runtime.connect）
    ctx.lrConnect();
    ok('端口建立后 lrPortReady=true', ctx.getReady() === true);
    const r = await ctx.sendToBackground({ type: 'translateBatch', texts: ['x'] });
    ok('端口路径正常 resolve', r && r.ok === true && r.via === 'port' && r.echo === 'translateBatch');
  }

  console.log('\n通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
  process.exit(fail ? 1 : 0);
})();
