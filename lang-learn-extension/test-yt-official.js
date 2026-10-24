// 回归测试：YouTube 官方翻译（baseUrl + &tlang=）
// 真实抽取 content.js 里 yt-official-helpers 标记之间的纯函数来跑（与实现不漂移）
// 覆盖：目标语言映射 / translationLanguages 可用性判定 / tlang URL 拼接（保留 pot、去重 tlang）
const fs = require('fs');
const path = require('path');

const contentJs = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
const START = '// >>> yt-official-helpers';
const END = '// <<< yt-official-helpers';
const a = contentJs.indexOf(START);
const b = contentJs.indexOf(END);
if (a < 0 || b < 0 || b <= a) { console.error('✗ 找不到 yt-official-helpers 代码段'); process.exit(1); }
const segSrc = contentJs.slice(a, b);

const ctx = new Function(segSrc + '\nreturn { ytTlangForTarget: ytTlangForTarget, ytOfficialTlang: ytOfficialTlang, ytUrlWithTlang: ytUrlWithTlang };')();

// 双语第二行的取行逻辑（v1.0.15）：官方译文按「时间区间」取、AI 译文按「起点相同」取
const DSTART = '// >>> dual-line-helpers';
const DEND = '// <<< dual-line-helpers';
const da = contentJs.indexOf(DSTART);
const db = contentJs.indexOf(DEND);
if (da < 0 || db < 0 || db <= da) { console.error('✗ 找不到 dual-line-helpers 代码段'); process.exit(1); }
const dual = new Function(contentJs.slice(da, db) + '\nreturn { cueForSpan: cueForSpan, cueAtStart: cueAtStart };')();

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };

console.log('— A. ytTlangForTarget：插件目标语言 → YouTube tlang —');
ok('zh-CN → zh-Hans', ctx.ytTlangForTarget('zh-CN') === 'zh-Hans');
ok('zh-TW → zh-Hant', ctx.ytTlangForTarget('zh-TW') === 'zh-Hant');
ok('zh-HK → zh-Hant', ctx.ytTlangForTarget('zh-HK') === 'zh-Hant');
ok('en 原样', ctx.ytTlangForTarget('en') === 'en');
ok('ja 原样', ctx.ytTlangForTarget('ja') === 'ja');
ok('未知码原样透传', ctx.ytTlangForTarget('xx-YY') === 'xx-YY');

console.log('— B. ytOfficialTlang：可用性判定 —');
ok('列表含 zh-Hans，目标 zh-CN → zh-Hans', ctx.ytOfficialTlang({ _tlang: ['zh-Hans', 'en'] }, 'zh-CN') === 'zh-Hans');
ok('列表含 en，目标 en → en', ctx.ytOfficialTlang({ _tlang: ['zh-Hans', 'en'] }, 'en') === 'en');
ok('列表不含 ja → 空', ctx.ytOfficialTlang({ _tlang: ['zh-Hans', 'en'] }, 'ja') === '');
ok('前缀命中：列表只有 zh，目标 zh-CN → zh', ctx.ytOfficialTlang({ _tlang: ['zh'] }, 'zh-CN') === 'zh');
ok('列表为空（未知）→ 乐观返回目标 tlang', ctx.ytOfficialTlang({ _tlang: [] }, 'zh-CN') === 'zh-Hans');
ok('列表缺失字段 → 乐观返回', ctx.ytOfficialTlang({}, 'ja') === 'ja');
ok('虚拟轨道不参与官方翻译 → 空', ctx.ytOfficialTlang({ _virtual: true, _tlang: ['zh-Hans'] }, 'zh-CN') === '');
ok('null 轨道 → 空', ctx.ytOfficialTlang(null, 'zh-CN') === '');

console.log('— C. ytUrlWithTlang：URL 拼接 —');
{
  const u = ctx.ytUrlWithTlang('https://www.youtube.com/api/timedtext?v=abc&lang=en&pot=XYZ', 'zh-Hans');
  ok('保留 v', u.indexOf('v=abc') >= 0);
  ok('保留 lang=en', u.indexOf('lang=en') >= 0);
  ok('保留 pot 令牌', u.indexOf('pot=XYZ') >= 0);
  ok('追加 tlang=zh-Hans', /[?&]tlang=zh-Hans(&|$)/.test(u));
}
{
  const u = ctx.ytUrlWithTlang('https://www.youtube.com/api/timedtext?v=abc&tlang=ja', 'zh-Hans');
  ok('已有 tlang 被替换（不重复）', (u.match(/tlang=/g) || []).length === 1);
  ok('替换为目标 tlang', /[?&]tlang=zh-Hans(&|$)/.test(u));
}
{
  const u = ctx.ytUrlWithTlang('https://x/api/timedtext', 'en');
  ok('无查询参数时以 ? 起始', u.indexOf('?tlang=en') >= 0);
}

console.log('— D. cueForSpan：官方译文按时间区间取（修「第二行时有时无」）—');
{
  // 官方把多句 ASR 碎片合并成一句：起点 0s，原文第 5 行才播到 2.5s —— 旧逻辑（起点差>0.35s）会隐藏第二行
  const off = [{ index: 0, from: 0, to: 6, text: '合并后的整句译文' }];
  const hit = dual.cueForSpan(off, 2.5, 3.1, 1.2);
  ok('起点差 2.5s 的粗分段仍能取到（不再因对不齐而隐藏）', !!hit && hit.text === '合并后的整句译文');
  ok('区间外的远处不取（4s 之后 + 容差外）', dual.cueForSpan([{ index: 0, from: 0, to: 1, text: 'A' }], 5, 6, 1.2) === null);
  ok('区间末 + 容差内仍取（尾句）', !!dual.cueForSpan([{ index: 0, from: 0, to: 4.2, text: 'A' }], 4.5, 5, 1.2));
} 
{
  // 原轨道这一行跨越两条官方译文 → 合并显示，中文直接相接
  const arr = [
    { index: 0, from: 0, to: 3, text: '第一句。' },
    { index: 1, from: 3, to: 6, text: '第二句。' }
  ];
  const hit = dual.cueForSpan(arr, 1, 5, 1.2);
  ok('跨两条译文时合并成一句', !!hit && hit.text === '第一句。第二句。');
  ok('合并后 index 取首条', !!hit && hit.index === 0);
} 
{
  // 拉丁语言拼接要留空格
  const arr = [{ index: 0, from: 0, to: 3, text: 'Hello' }, { index: 1, from: 3, to: 6, text: 'world' }];
  const hit = dual.cueForSpan(arr, 0, 6, 0.2);
  ok('英文合并保留空格', !!hit && hit.text === 'Hello world');
}
{
  // 滚动式字幕同一句重复给几遍 → 去重，不能拼成 "A A A"
  const arr = [
    { index: 0, from: 0, to: 2, text: '同一句话' },
    { index: 1, from: 1, to: 3, text: '同一句话' },
    { index: 2, from: 2, to: 4, text: '同一句话' }
  ];
  const hit = dual.cueForSpan(arr, 0, 4, 0.2);
  ok('重复片段只出现一次', !!hit && hit.text === '同一句话');
}
{
  // 包含关系：后一条把前一条整个包住 → 用长的那条
  const arr = [
    { index: 0, from: 0, to: 2, text: '前半句' },
    { index: 1, from: 1, to: 4, text: '前半句加上后半句' }
  ];
  const hit = dual.cueForSpan(arr, 1, 1.5, 0.2);
  ok('包含关系取更完整的那条', !!hit && hit.text === '前半句加上后半句');
}
ok('空数组 → null', dual.cueForSpan([], 0, 1, 1) === null);
ok('null → null', dual.cueForSpan(null, 0, 1, 1) === null);

console.log('— E. cueAtStart：AI 译文按「起点相同」取（未翻的行不能挂旧译文）—');
{
  const arr = [
    { index: 0, from: 10, to: 12, text: '已翻译的第 47 行' },
    { index: 1, from: 14, to: 16, text: '已翻译的第 49 行' }
  ];
  ok('起点相同 → 命中', (dual.cueAtStart(arr, 14, 0.06) || {}).text === '已翻译的第 49 行');
  ok('未翻的行（12.5s，无 cue）→ null，不挂上一行旧译文', dual.cueAtStart(arr, 12.5, 0.06) === null);
  ok('浮点误差 0.02s 内仍命中', !!dual.cueAtStart(arr, 10.02, 0.06));
  ok('差 0.2s 不命中（严格）', dual.cueAtStart(arr, 10.2, 0.06) === null);
}
ok('cueAtStart 空数组 → null', dual.cueAtStart([], 0, 0.06) === null);

console.log('\n通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
process.exit(fail ? 1 : 0);
