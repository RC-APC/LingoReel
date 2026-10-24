/**
 * 回归测试：切换「母语」后旧译文轨道要清掉（v1.0.16）
 * ------------------------------------------------------------
 * 背景：母语 = 译文目标语言（translateTarget）。用户把母语从简体中文改成日本語后，
 * 已生成的「中文（AI 翻译）」「中文（YouTube 翻译）」轨道是上一个语言的产物，
 * 留着就是「轨道名写新语言、正文还是旧语言」，而且对照位会一直挂着旧语言译文。
 * 期望：作废在飞翻译 → 删掉所有 _virtual 轨道与正文缓存 → 指针退回源轨道 →
 * 开着自动翻译就用新母语重译，否则提示手动生成。
 *
 * 做法（与 test-live-words.js 一致）：从 content.js 抽**真实函数源码**，配桩执行。
 * 用法：node test-target-switch.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

function sliceFn(source, name) {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.includes('function ' + name + '('));
  if (start < 0) throw new Error('未找到函数: ' + name);
  const indent = lines[start].match(/^\s*/)[0];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === indent + '}') return lines.slice(start, i + 1).join('\n');
  }
  throw new Error('未找到函数结尾: ' + name);
}

const fn = sliceFn(src, 'onTranslateTargetChanged');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '   ' + extra : '')); }
};

// 每个用例重建一次 sandbox（函数会真的改写这些状态）
function makeCtx(state) {
  const calls = { toast: [], status: [], auto: 0, trBtn: [], populate: 0, live: 0 };
  const sandbox = {
    console,
    document: { getElementById: () => null },
    Math, JSON, Object, Array, String, Number, Promise,
    subtitleTracks: state.subtitleTracks || [],
    selectedTrack: state.selectedTrack == null ? -1 : state.selectedTrack,
    selectedTrack2: state.selectedTrack2 == null ? -1 : state.selectedTrack2,
    trStore: state.trStore || {},
    ytTrStore: state.ytTrStore || {},
    cues2: state.cues2 || [],
    cues: state.cues || [],
    liveKey: 'm1|s1',
    trGen: 3,
    trAbort: false,
    trRunning: !!state.trRunning,
    trProgress: { done: 1 },
    lastTrInfo: { ok: true },
    autoTranslate: state.autoTranslate !== false,
    translateTarget: state.translateTarget || 'ja',
    // 桩：只记录调用
    setTrButton: (v) => calls.trBtn.push(v),
    populateTrackSelect: () => { calls.populate++; },
    updateLive: () => { calls.live++; },
    showToast: (m) => calls.toast.push(m),
    setStatus: (m) => calls.status.push(m),
    maybeAutoTranslate: () => { calls.auto++; },
    langDocName: (code) => ({ 'zh-CN': '中文', 'ja': '日语', 'en': '英文' }[code] || code),
    log: () => {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fn, sandbox);
  return { sandbox, calls };
}

const SRC_EN = { lan: 'en', lan_doc: '英语' };
const SRC_AU = { lan: 'en-AU', lan_doc: '英语（澳大利亚）' };
const V_AI = { lan: 'zh-CN', lan_doc: '中文（AI 翻译）', _virtual: true, _src: 1 };
const V_YT = { lan: 'zh-CN', lan_doc: '中文（YouTube 翻译）', _virtual: true, _src: 1, _yt: true };

console.log('— A. 主轨道=源轨道、对照=官方译文轨道：删掉虚拟轨道、对照清空、按新母语重译 —');
{
  const { sandbox, calls } = makeCtx({
    subtitleTracks: [SRC_EN, SRC_AU, V_AI, V_YT],
    selectedTrack: 1, selectedTrack2: 3,
    trStore: { 1: { tl: 'zh-CN', cues: [] } },
    ytTrStore: { 1: { tl: 'zh-CN', tlang: 'zh-Hans', cues: [] } },
    cues: [{ index: 0, from: 0, to: 1, text: 'hello' }],
    cues2: [{ index: 0, from: 0, to: 1, text: '旧的中文' }]
  });
  vm.runInContext('onTranslateTargetChanged("zh-CN")', sandbox);
  ok('虚拟译文轨道全部删除', sandbox.subtitleTracks.length === 2, '剩 ' + sandbox.subtitleTracks.length + ' 条');
  ok('留下的都是真实轨道（没有 _virtual）', sandbox.subtitleTracks.every((t) => !t._virtual));
  ok('主轨道仍指向 en-AU', sandbox.subtitleTracks[sandbox.selectedTrack].lan === 'en-AU');
  ok('对照位清空（-1）', sandbox.selectedTrack2 === -1, '当前 ' + sandbox.selectedTrack2);
  ok('cues2 清空', sandbox.cues2.length === 0);
  ok('AI 译文正文缓存清空', Object.keys(sandbox.trStore).length === 0);
  ok('官方译文正文缓存清空', Object.keys(sandbox.ytTrStore).length === 0);
  ok('liveKey 复位（触发实时行重建）', sandbox.liveKey === '');
  ok('自动翻译开着 → 按新母语触发一次重译', calls.auto === 1);
  ok('提示文案提到母语已切换', /母语已切换/.test(calls.toast.join(' ')), JSON.stringify(calls.toast));
  ok('下拉框被重建一次', calls.populate === 1);
}

console.log('— B. 主轨道正停在译文轨道上：退回它的源轨道 —');
{
  const { sandbox } = makeCtx({
    subtitleTracks: [SRC_EN, SRC_AU, V_AI],
    selectedTrack: 2, selectedTrack2: -1,
    trStore: { 1: { tl: 'zh-CN', cues: [] } }
  });
  vm.runInContext('onTranslateTargetChanged("zh-CN")', sandbox);
  ok('主轨道从虚拟轨道退回源轨道 en-AU', sandbox.subtitleTracks[sandbox.selectedTrack].lan === 'en-AU',
    '当前 ' + (sandbox.subtitleTracks[sandbox.selectedTrack] || {}).lan);
  ok('删完只剩真实轨道', sandbox.subtitleTracks.length === 2);
}

console.log('— C. 对照是真实轨道：删虚拟轨道后索引前移，仍指向同一条真实轨道 —');
{
  const SRC_JA = { lan: 'ja', lan_doc: '日语' };
  const { sandbox } = makeCtx({
    subtitleTracks: [SRC_EN, SRC_AU, SRC_JA, V_AI],
    selectedTrack: 1, selectedTrack2: 2,      // 对照 = 日语真实轨道
    trStore: { 1: { tl: 'zh-CN', cues: [] } }
  });
  vm.runInContext('onTranslateTargetChanged("zh-CN")', sandbox);
  ok('对照仍是那条日语轨道', sandbox.subtitleTracks[sandbox.selectedTrack2].lan === 'ja',
    '当前 ' + (sandbox.subtitleTracks[sandbox.selectedTrack2] || {}).lan);
  ok('主轨道仍指向 en-AU', sandbox.subtitleTracks[sandbox.selectedTrack].lan === 'en-AU');
}

console.log('— D. 正在翻译旧语言：必须作废在飞任务 —');
{
  const { sandbox, calls } = makeCtx({
    subtitleTracks: [SRC_EN, SRC_AU, V_AI],
    selectedTrack: 1, selectedTrack2: 2,
    trRunning: true, trStore: { 1: { tl: 'zh-CN', cues: [] } }
  });
  const genBefore = sandbox.trGen;
  vm.runInContext('onTranslateTargetChanged("zh-CN")', sandbox);
  ok('trRunning 置 false', sandbox.trRunning === false);
  ok('trAbort 置 true', sandbox.trAbort === true);
  ok('trGen 自增（已返回的旧批次会被丢弃）', sandbox.trGen === genBefore + 1, genBefore + ' → ' + sandbox.trGen);
  ok('翻译按钮复原', calls.trBtn.indexOf(false) >= 0, JSON.stringify(calls.trBtn));
  ok('trProgress 清空', sandbox.trProgress === null);
}

console.log('— E. 还没有任何译文：什么都不做（不要误清空/误重译）—');
{
  const { sandbox, calls } = makeCtx({
    subtitleTracks: [SRC_EN, SRC_AU],
    selectedTrack: 1, selectedTrack2: -1,
    autoTranslate: true
  });
  vm.runInContext('onTranslateTargetChanged("zh-CN")', sandbox);
  ok('轨道列表不动', sandbox.subtitleTracks.length === 2);
  ok('不触发重译', calls.auto === 0);
  ok('不弹提示', calls.toast.length === 0);
  ok('不改状态栏', calls.status.length === 0);
}

console.log('— F. 自动翻译关着：清空旧轨道但只提示手动生成 —');
{
  const { sandbox, calls } = makeCtx({
    subtitleTracks: [SRC_EN, SRC_AU, V_AI],
    selectedTrack: 1, selectedTrack2: 2,
    trStore: { 1: { tl: 'zh-CN', cues: [] } },
    autoTranslate: false
  });
  vm.runInContext('onTranslateTargetChanged("zh-CN")', sandbox);
  ok('旧译文轨道仍被清掉', sandbox.subtitleTracks.length === 2 && sandbox.selectedTrack2 === -1);
  ok('不自动重译', calls.auto === 0);
  ok('状态栏提示点「翻译 / YT译」', /YT译/.test(calls.status.join(' ')), JSON.stringify(calls.status));
}

console.log('\n结果: ' + pass + '/' + (pass + fail) + ' PASS ' + (fail ? '❌' : '✅'));
process.exit(fail ? 1 : 0);
