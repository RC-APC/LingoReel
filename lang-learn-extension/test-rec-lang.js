// 回归测试：跟读录音的「语音识别语言标签规范化」+「错误不再吞掉」
//
// 背景（真机 bug）：B站 录音不成功，YouTube 正常。
// 根因：B站 字幕轨道的 lan 是 zh-Hans / zh-Hant / ase / iw 这类值（已用 wbi/view 实测确认），
// 而 Chrome/Edge 的 SpeechRecognition 只认 zh-CN / zh-TW 等标准标签，
// 收到 zh-Hans 直接报 language-not-supported；再叠加原实现 sr.onerror = () => {} 把错误吞掉，
// 表现为"录音没反应 / 未识别到语音"。YouTube 上多为 en → en-US 命中映射，所以正常。
//
// 做法：抽取 content.js 里真实的 normalizeRecLang() / srErrHint() / micErrHint() 源码来跑
// （不是复制算法），改坏实现会立刻让这个测试变红。
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const contentJs = fs.readFileSync(path.join(DIR, 'content.js'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('没找到函数 ' + name);
  const brace = src.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('函数 ' + name + ' 花括号不配平');
}

const mSupported = contentJs.match(/const SR_SUPPORTED = [\s\S]*?\.split\(' '\);/);
const mAlias = contentJs.match(/const SR_ALIAS = \{[\s\S]*?\};/);
const mPreferred = contentJs.match(/const SR_PREFERRED = \{[\s\S]*?\};/);
if (!mSupported) throw new Error('没抽到 SR_SUPPORTED 常量');
if (!mAlias) throw new Error('没抽到 SR_ALIAS 常量');
if (!mPreferred) throw new Error('没抽到 SR_PREFERRED 常量');

const code = [
  mSupported[0], mAlias[0], mPreferred[0],
  extractFn(contentJs, 'srPick'),
  extractFn(contentJs, 'fallbackRecLang'),
  extractFn(contentJs, 'normalizeRecLang'),
  extractFn(contentJs, 'srErrHint'),
  extractFn(contentJs, 'micErrHint')
].join('\n');

// fallbackRecLang 会读 navigator.language，这里注入一个常见的中文浏览器语言
const factory = new Function('navigator', code +
  '\nreturn { SR_SUPPORTED, SR_ALIAS, SR_PREFERRED, srPick, fallbackRecLang, normalizeRecLang, srErrHint, micErrHint };');
const api = factory({ language: 'zh-CN' });

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log('  ✓ ' + label + ' → ' + JSON.stringify(got)); }
  else { fail++; console.log('  ✗ ' + label + '：期望 ' + JSON.stringify(want) + '，实得 ' + JSON.stringify(got)); }
}
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '：' + detail : '')); }
}
function has(label, src, needle) {
  ok(label, src.indexOf(needle) >= 0, '源码里找不到「' + needle + '」');
}

// ---------- 核心回归：B站 实测 lan 全部要能被规范化 ----------
console.log('— B站 wbi/view 实测到的 12 个字幕 lan，全部必须落在 Chrome 支持列表内 —');
// 这 12 个值取自真实接口响应 subtitle.list[].lan（含 zh-Hans / zh-Hant / ase / iw 等非标准标签）
const BILI_REAL_LANS = ['zh-CN', 'zh-Hans', 'zh-Hant', 'zh-HK', 'en-US', 'ja', 'ko',
  'de-DE', 'ru', 'iw', 'ca', 'ase'];
for (const lan of BILI_REAL_LANS) {
  const got = api.normalizeRecLang(lan);
  ok('lan "' + lan + '" → "' + got + '" 在支持列表内',
    api.SR_SUPPORTED.indexOf(got) >= 0, '得到了浏览器不认的标签');
}

// ---------- 具体映射 ----------
console.log('— 具体标签映射 —');
eq('zh-Hans → zh-CN（B站中文简体，原 bug 直接透传）', api.normalizeRecLang('zh-Hans'), 'zh-CN');
eq('zh-Hant → zh-TW（B站中文繁体）', api.normalizeRecLang('zh-Hant'), 'zh-TW');
eq('zh-HK 保持', api.normalizeRecLang('zh-HK'), 'zh-HK');
eq('ai-zh → zh-CN（B站 AI 字幕前缀要剥掉）', api.normalizeRecLang('ai-zh'), 'zh-CN');
eq('en → en-US（短码补全）', api.normalizeRecLang('en'), 'en-US');
eq('ja → ja-JP', api.normalizeRecLang('ja'), 'ja-JP');
eq('ko → ko-KR', api.normalizeRecLang('ko'), 'ko-KR');
eq('zh → zh-CN', api.normalizeRecLang('zh'), 'zh-CN');
eq('de-DE 保持', api.normalizeRecLang('de-DE'), 'de-DE');
eq('ru → ru-RU', api.normalizeRecLang('ru'), 'ru-RU');
eq('iw → he-IL（希伯来语旧码）', api.normalizeRecLang('iw'), 'he-IL');

// ---------- 旧 bug 的负断言：绝不能再把 zh-Hans 原样透传 ----------
console.log('— 负断言：不得再透传浏览器不认的标签 —');
ok('zh-Hans 不再原样返回（旧实现会返回 zh-Hans）', api.normalizeRecLang('zh-Hans') !== 'zh-Hans');
ok('zh-Hant 不再原样返回', api.normalizeRecLang('zh-Hant') !== 'zh-Hant');
ok('ase（美国手语）不再原样返回', api.normalizeRecLang('ase') !== 'ase');

// ---------- 边界 ----------
console.log('— 边界输入不崩、且都返回合法标签 —');
for (const bad of ['', null, undefined, '   ', 'xx-YY-ZZ', 123]) {
  const got = api.normalizeRecLang(bad);
  ok('输入 ' + JSON.stringify(bad) + ' → "' + got + '" 合法',
    typeof got === 'string' && api.SR_SUPPORTED.indexOf(got) >= 0);
}

// ---------- 错误提示 ----------
console.log('— 错误码 → 人话提示 —');
const netHint = api.srErrHint('network');
ok('network 提示指向"连不上识别服务"', netHint.indexOf('连不上') >= 0, netHint);
ok('language-not-supported 提示会改用 en-US', api.srErrHint('language-not-supported').indexOf('en-US') >= 0);
ok('not-allowed 提示要用户放行', api.srErrHint('not-allowed').indexOf('允许') >= 0);
ok('未知错误码也不崩且带上码', api.srErrHint('weird-code').indexOf('weird-code') >= 0);
ok('麦克风权限被拒 → 提示去地址栏放行', api.micErrHint({ name: 'NotAllowedError' }).indexOf('权限') >= 0);
ok('无麦克风设备 → 提示没检测到', api.micErrHint({ name: 'NotFoundError' }).indexOf('没检测到') >= 0);
ok('设备被占用 → 提示被占用', api.micErrHint({ name: 'NotReadableError' }).indexOf('占用') >= 0);

// ---------- 源码级断言（防止改回老样子） ----------
console.log('— 源码级防回退 —');
ok('sr.onerror 不再是吞掉错误的空函数', contentJs.indexOf('sr.onerror = () => {};') < 0,
  '发现 sr.onerror = () => {}; —— 错误又被吞了');
has('识别语言走规范化后的 recLang()', contentJs, 'sr.lang = useLang');
has('遇到 language-not-supported 会降级成 en-US 重试', contentJs, "code === 'language-not-supported'");
has('错误码会记到 activeRecErr', contentJs, 'activeRecErr = code');
has('打分结果区会显示真实错误提示', contentJs, 'srErrHint(activeRecErr)');
has('麦克风失败用 micErrHint 细分原因', contentJs, 'micErrHint(e)');

console.log('\n' + (fail ? '❌' : '✅') + ' 通过 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
