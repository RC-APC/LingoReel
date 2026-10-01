// 回归测试：翻译目标语言（母语）必须真正生效，且 UI 不再写死「中文」
//
// 背景：用户反馈「母语选择其他语言之后，翻译还是中文」。根因不是译文本身
// （content.js 早就用 translateTarget 作为 tl 调后台），而是轨道标签 / 按钮 / 状态文案
// 全写死「中文（AI 翻译）」/「译中文」，导致切换母语后看起来仍然是中文。
// 本测试抽取真实的 langDocName() 与源码字面量断言，确保修复后：
//   1) 轨道标签跟随 translateTarget（译英文就显示 English（AI 翻译））
//   2) 源码里不再有写死的「中文（AI 翻译）」/「正在翻译成中文」字样
//   3) 确有动态拼接 langDocName(translateTarget) + '（AI 翻译）'
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const contentJs = fs.readFileSync(path.join(DIR, 'content.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label); }
}
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('没找到函数 ' + name);
  const brace = src.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('函数 ' + name + ' 花括号不配平');
}

// langDocName 是纯函数，直接 eval
const factory = new Function(extractFn(contentJs, 'langDocName') + '\nreturn { langDocName };');
const api = factory();

console.log('— langDocName：译文轨道展示名跟随 translateTarget —');
ok('zh-CN → 中文', api.langDocName('zh-CN') === '中文');
ok('en → English', api.langDocName('en') === 'English');
ok('fr → Français', api.langDocName('fr') === 'Français');
ok('ja → 日本語', api.langDocName('ja') === '日本語');
ok('未知码回退原值', api.langDocName('xx') === 'xx');

// trackInTargetLang 依赖 isChineseTrack，两个纯函数一起 eval
const factory2 = new Function(
  extractFn(contentJs, 'isChineseTrack') + '\n' +
  extractFn(contentJs, 'trackInTargetLang') + '\n' +
  'return { isChineseTrack, trackInTargetLang };'
);
const api2 = factory2();

console.log('— trackInTargetLang：翻译跳过判定应「目标语言感知」 —');
ok('中文源 + 中文母语 → 命中（跳过）', api2.trackInTargetLang({ lan: 'zh-CN' }, 'zh-CN') === true);
ok('英文源 + 中文母语 → 不命中（要翻英文→中文）', api2.trackInTargetLang({ lan: 'en' }, 'zh-CN') === false);
ok('中文源 + English 母语 → 不命中（要翻中文→English，不再被「已是中文」误拦）', api2.trackInTargetLang({ lan: 'zh-CN' }, 'en') === false);
ok('English 源 + English 母语 → 命中（跳过）', api2.trackInTargetLang({ lan: 'en' }, 'en') === true);
ok('法语源 + English 母语 → 不命中（要翻）', api2.trackInTargetLang({ lan: 'fr' }, 'en') === false);

console.log('— 源码级断言：不再写死中文，改为动态拼接 —');
ok('源码已移除写死的「中文（AI 翻译）」字面量', contentJs.indexOf('中文（AI 翻译）') < 0);
ok('源码已移除写死的「正在翻译成中文」字面量', contentJs.indexOf('正在翻译成中文') < 0);
ok('ensureVirtualTrack 用 translateTarget 作为 lan（不再是 zh-CN）',
  /subtitleTracks\.push\(\{\s*lan:\s*translateTarget/.test(contentJs));
ok('轨道标签动态拼接 langDocName(translateTarget) + \'（AI 翻译）\'',
  contentJs.indexOf("langDocName(translateTarget) + '（AI 翻译）'") >= 0);
ok('按钮文案改为干净的「翻译」（不再中英文混杂）',
  /b\.textContent\s*=\s*running\s*\?\s*'停止'\s*:\s*'翻译'/.test(contentJs));
ok('自动翻译跳过条件改为「已有目标语言轨道」而非写死中文',
  contentJs.indexOf('x.lan === translateTarget') >= 0 && contentJs.indexOf('const realZh') < 0);
ok('手动翻译跳过判定改为目标语言感知（trackInTargetLang），不再写死 isChineseTrack',
  /track && \(track\._virtual \|\| trackInTargetLang\(track, translateTarget\)\)/.test(contentJs));
ok('旧硬编码提示「当前轨道已经是中文」已移除', contentJs.indexOf('当前轨道已经是中文') < 0);
ok('新提示改为「当前字幕已是所选母语」', contentJs.indexOf('当前字幕已是所选母语') >= 0);
ok('进度文案不再拼接英文语言名（避免中英文混杂）', contentJs.indexOf("正在翻译成' + langDocName") < 0);

console.log('— manifest —');
ok('manifest 版本已升到 1.0.8', manifest.version === '1.0.8');

console.log('\n通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
process.exit(fail ? 1 : 0);
