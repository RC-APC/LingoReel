// 回归测试：popup 里切换「大模型预设」时，Base URL 要跟模型名一起加载并存盘。
//
// 背景（真实故障）：预设下拉的 change 事件挂了两个监听器——通用 saveSettings（先跑，把旧 base/model 存盘）
// 与 applyPreset（后跑，才把新 preset 的 base+model 填进输入框，但不存盘）。结果 preset 填好的网址
// 从没被持久化，重开弹窗又被旧值覆盖 → 表现就是"模型选了别的、网址还是 deepseek"。
//
// 做法：用 jsdom 真实加载 popup.js，构造最小 DOM + chrome 桩，派发 DOMContentLoaded 后再派发
// llmPreset 的 change，断言 chrome.storage.local 里落库的 llm.base / llm.model 都已是新 preset 的值。
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DIR = __dirname;
const popupJs = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');

// ---- 最小 DOM：popup.js 在 loadSettings / 各 handler 里用到的全部 id ----
const PRESET_OPTIONS = [
  'deepseek', 'siliconflow', 'siliconflow2', 'zhipu', 'moonshot', 'qwen',
  'volc', 'openai', 'groq', 'ollama', 'custom'
];
const html = `<!doctype html><html><body>
  <input type="checkbox" id="enabled">
  <input type="checkbox" id="autoPause">
  <input type="checkbox" id="searchCc">
  <select id="dictSource"><option value="api">api</option><option value="eudic">eudic</option><option value="llm">llm</option></select>
  <select id="eudicAction"><option value="lp-dict">lp</option></select>
  <input type="checkbox" id="autoTranslate">
  <select id="trEngine"><option value="auto">auto</option><option value="llm">llm</option><option value="google">google</option><option value="mymemory">mymemory</option></select>
  <select id="translateTarget"><option value="zh-CN">zh-CN</option></select>
  <input type="range" id="panelOpacity" value="85">
  <span id="opVal"></span>
  <input type="range" id="textOpacity" value="100">
  <span id="txVal"></span>
  <div id="eudicBox" class="show"></div>
  <input type="checkbox" id="llmOn">
  <select id="llmPreset">${PRESET_OPTIONS.map((v) => '<option value="' + v + '">' + v + '</option>').join('')}</select>
  <input id="llmBase" type="text">
  <input id="llmModel" type="text">
  <input id="llmKey" type="password">
  <button id="llmTest"></button>
  <div id="llmBox" class="show"></div>
  <div id="llmResult"></div>
  <div id="llmHint" class="show"></div>
  <div id="vocab"></div>
  <button id="clearVocab"></button>
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'outside-only' });
const { window } = dom;

// ---- chrome 桩 ----
let localStore = { llm: { on: false, baseUrl: '', model: '', apiKey: '', preset: '' } };
let lastLocalSet = null;
const chrome = {
  storage: {
    sync: { get: (keys, cb) => cb({}), set: () => {} },
    local: {
      get: (keys, cb) => cb(localStore),
      set: (obj) => { localStore = Object.assign({}, localStore, obj); lastLocalSet = obj; }
    }
  },
  permissions: { contains: (o, cb) => cb(true), request: (o, cb) => cb(true) },
  runtime: { sendMessage: (m, cb) => cb && cb({ ok: true, text: 'ok' }) }
};
window.chrome = chrome;

let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '：' + detail : '')); }
}

// 在 window 作用域里执行 popup.js（document / chrome 都指向 window 的）
window.eval(popupJs);
// 触发初始化
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

console.log('— 切换预设：Base URL 必须跟模型一起更新并存盘 —');
{
  // 先模拟"用户之前配过 deepseek"
  localStore = { llm: { on: true, baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: 'sk-x', preset: 'deepseek' } };
  // 重新触发 loadSettings 让弹窗显示当前值
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const baseBefore = window.document.getElementById('llmBase').value;
  const modelBefore = window.document.getElementById('llmModel').value;
  ok('初始显示的是 deepseek', baseBefore === 'https://api.deepseek.com' && modelBefore === 'deepseek-flash',
    'base=' + baseBefore + ' model=' + modelBefore);

  // 用户把预设切到 智谱 GLM
  const sel = window.document.getElementById('llmPreset');
  sel.value = 'zhipu';
  sel.dispatchEvent(new window.Event('change'));

  const baseAfter = window.document.getElementById('llmBase').value;
  const modelAfter = window.document.getElementById('llmModel').value;
  ok('切到 zhipu 后 Base URL 跟着变成智谱地址', baseAfter === 'https://open.bigmodel.cn/api/paas/v4', 'base=' + baseAfter);
  ok('切到 zhipu 后 Model 跟着变成 glm-4-flash', modelAfter === 'glm-4-flash', 'model=' + modelAfter);
  ok('切换后 Base URL 不再是 deepseek（即"网址跟着模型走"）', baseAfter !== 'https://api.deepseek.com');
  // 关键回归点：存盘里 llm.base / llm.model 都应是新值（旧 bug 只会存旧 base）
  ok('存盘 llm.base 已是新预设地址', lastLocalSet && lastLocalSet.llm && lastLocalSet.llm.baseUrl === 'https://open.bigmodel.cn/api/paas/v4',
    JSON.stringify(lastLocalSet && lastLocalSet.llm));
  ok('存盘 llm.model 已是新预设模型', lastLocalSet && lastLocalSet.llm && lastLocalSet.llm.model === 'glm-4-flash');
  ok('存盘 llm.preset 已更新为 zhipu', lastLocalSet && lastLocalSet.llm && lastLocalSet.llm.preset === 'zhipu');
}

// ---- 源码级断言：从根上锁死这个 bug（监听器顺序） ----
console.log('— 源码级断言 —');
ok('预设 change 处理器会先 applyPreset 再 saveSettings（原子化）',
  /addEventListener\('change', \(\) => \{\s*applyPreset\(\$\('llmPreset'\)\.value, true\);\s*saveSettings\(\);/.test(popupJs),
  '未找到「applyPreset 后紧跟 saveSettings」的处理器');
ok('通用循环里已移除 llmPreset（避免抢先存旧值）',
  popupJs.indexOf("'llmOn', 'llmPreset', 'llmBase'") < 0 && /'llmOn', 'llmBase', 'llmModel', 'llmKey'/.test(popupJs),
  'llmPreset 仍在通用循环里');

console.log('\n通过 ' + pass + ' / ' + (pass + fail));
process.exit(fail ? 1 : 0);
