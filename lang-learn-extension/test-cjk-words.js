/**
 * 中/日/韩「逐词可点」测试（v1.0.17）
 * ------------------------------------------------------------
 * 报障：字幕取词时英文能按单词点，中文/日文只能整句取词（整句拿去查词典，>24 字甚至点不动）。
 * 根因：wrapWords 用 text.split(/(\s+)/) —— 无空格语言整句就是一个 token。
 * 修法：word-segmentation 段用 Intl.Segmenter(ICU 词典) 对含 CJK 的片段按词切，
 *       没该 API 的老内核降级为按字切；英文仍走空白切分，行为不变。
 *
 * 做法：从 content.js **抽出真实源码**（word-segmentation 标记段 + wrapWords）在 vm 里跑，
 *      测的是线上代码，不是复制品。用法：node test-cjk-words.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.join(__dirname, 'content.js');
const src = fs.readFileSync(FILE, 'utf8');

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
const fnWordSeg = (function () {
  const A = '// >>> word-segmentation', B = '// <<< word-segmentation';
  const a = src.indexOf(A), b = src.indexOf(B);
  if (a < 0 || b < 0 || b <= a) throw new Error('找不到 word-segmentation 代码段');
  return src.slice(src.indexOf('\n', a) + 1, b);
})();
const fnWrapWords = sliceFn(src, 'wrapWords');

// ---------- 记录型 DOM 桩 ----------
function makeNode(tag) {
  const n = {
    tagName: tag,
    className: '',
    dataset: {},
    children: [],
    _text: '',
    classList: {
      add(c) {
        const parts = n.className.split(/\s+/).filter(Boolean);
        if (parts.indexOf(c) < 0) { parts.push(c); n.className = parts.join(' '); }
      },
      contains(c) { return n.className.split(/\s+/).indexOf(c) >= 0; }
    },
    appendChild(c) { n.children.push(c); return c; },
    get textContent() { return n._text + n.children.map((c) => c.textContent || '').join(''); },
    set textContent(v) { n._text = String(v); n.children = []; }
  };
  return n;
}
function makeText(t) { return { nodeType: 3, textContent: String(t), children: [] }; }

const documentStub = {
  createElement: (t) => makeNode(t),
  createTextNode: (t) => makeText(t)
};
const sandbox = { console, document: documentStub, Promise, Math, Date, JSON, RegExp, Intl, Array, String, Set, Map };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fnWordSeg + '\n' + fnWrapWords, sandbox);
vm.runInContext('var __text = ""; var __box = null;', sandbox);

function render(text) {
  const box = makeNode('div');
  sandbox.__box = box;
  sandbox.__text = text;
  vm.runInContext('wrapWords(__box, __text);', sandbox);
  return box;
}
function tokenize(text) {
  sandbox.__text = text;
  return vm.runInContext('llTokenizeLine(__text)', sandbox);
}
function spansOf(box) {
  return box.children.filter((c) => (c.className || '').split(/\s+/).indexOf('ll-word') >= 0)
    .map((c) => ({ text: c.textContent, word: c.dataset.word || '', cls: c.className }));
}
function clickable(box) { return spansOf(box).map((s) => s.word).filter(Boolean); }

// ---------- 用例 ----------
const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra ? '   ' + extra : ''));
}

console.log('抽取到的源码行数: word-segmentation=' + fnWordSeg.split('\n').length +
  ', wrapWords=' + fnWrapWords.split('\n').length + '\n');

// 1) 英文行为完全不变（空白切分、撇号保留、标点随词剥掉）
const en = render("I'm excellent, thank you.");
const enWords = clickable(en);
check('英文仍切成 4 个可点词', enWords.length === 4, JSON.stringify(enWords));
check("英文撇号保留 I'm", enWords[0] === "I'm", JSON.stringify(enWords));
check("英文词尾标点剥掉 excellent / you", enWords[1] === 'excellent' && enWords[3] === 'you',
  JSON.stringify(enWords));
check('英文行渲染文本与原文一致', en.textContent === "I'm excellent, thank you.", en.textContent);
check('英文词不带 ll-cjk 类（保留英文的 1px 点击热区）', spansOf(en).every((s) => s.cls.indexOf('ll-cjk') < 0));

// 2) 中文：按词切，不再整句一个 span
const zh = render('我很好，谢谢。');
const zhWords = clickable(zh);
check('中文句切成多个可点词（不是整句）', zhWords.length >= 3, JSON.stringify(zhWords));
check('中文词按语义切出「很好」「谢谢」', zhWords.indexOf('很好') >= 0 && zhWords.indexOf('谢谢') >= 0,
  JSON.stringify(zhWords));
check('中文行不再出现整句 token', spansOf(zh).every((s) => s.text !== '我很好，谢谢。'),
  JSON.stringify(spansOf(zh).map((s) => s.text)));
check('中文标点不挂 dataset.word（不会拿标点查词）', spansOf(zh).some((s) => !s.word),
  JSON.stringify(spansOf(zh).map((s) => s.word)));
check('中文行渲染文本与原文一致（不丢字不添空格）', zh.textContent === '我很好，谢谢。', zh.textContent);
check('中文词都带 ll-cjk 类（去掉人为字距）', spansOf(zh).every((s) => s.cls.indexOf('ll-cjk') >= 0));

// 3) 旧逻辑的关键回归：>24 字纯 CJK 曾被整句屏蔽、完全点不动
const longZh = '尼尔，你做过糟糕的工作吗？我从来没有遇到过这么奇怪的面试问题。';
const longBox = render(longZh);
const longWords = clickable(longBox);
check('超长中文句现在能点词（旧版整句被 isSentence 屏蔽）', longWords.length >= 8,
  JSON.stringify(longWords.slice(0, 12)));
check('超长中文句里没有残留的整句 ll-punct', spansOf(longBox).every((s) => s.text !== longZh));
check('超长中文句渲染文本不变', longBox.textContent === longZh);

// 4) 日文（汉字 + 假名混合，无空格）
const ja = render('今日はいい天気ですね。');
const jaWords = clickable(ja);
check('日文句切成多个可点词', jaWords.length >= 4, JSON.stringify(jaWords));
check('日文切出「今日」「天気」等词', jaWords.indexOf('今日') >= 0 && jaWords.indexOf('天気') >= 0,
  JSON.stringify(jaWords));
check('日文假名片段也可点', jaWords.indexOf('は') >= 0 || jaWords.indexOf('です') >= 0,
  JSON.stringify(jaWords));
check('日文行渲染文本与原文一致', ja.textContent === '今日はいい天気ですね。', ja.textContent);

// 5) 韩文
const ko = render('한국어 공부를 합니다');
const koWords = clickable(ko);
check('韩文句切成多个可点词', koWords.length >= 3, JSON.stringify(koWords));
check('韩文切出「한국어」', koWords.indexOf('한국어') >= 0, JSON.stringify(koWords));
check('韩文行渲染文本与原文一致', ko.textContent === '한국어 공부를 합니다', ko.textContent);

// 6) 中英混排：CJK 与英文各自正确切分
const mix = render('我正在学习English单词');
const mixWords = clickable(mix);
check('中英混排切出中文词', mixWords.indexOf('学习') >= 0 || mixWords.indexOf('正在') >= 0,
  JSON.stringify(mixWords));
check('中英混排仍切出独立英文词 English', mixWords.indexOf('English') >= 0, JSON.stringify(mixWords));
check('中英混排渲染文本与原文一致', mix.textContent === '我正在学习English单词', mix.textContent);

// 7) 标点 / 空白 / 空值等边界
const punct = render('，。！？');
check('纯标点行不产生可点词', clickable(punct).length === 0);
check('纯标点行文本原样保留', punct.textContent === '，。！？', punct.textContent);
const spaced = render('你好 世界');
check('含空格的中文行保留空白文本节点', spaced.children.some((c) => c.nodeType === 3 && /\s/.test(c.textContent)));
check('含空格的中文行渲染文本一致', spaced.textContent === '你好 世界', spaced.textContent);
const empty = render('');
check('空字符串不产生任何 span', spansOf(empty).length === 0);
const nil = render(undefined);
check('undefined 不抛错、不产生 span', spansOf(nil).length === 0);
check('llTokenizeLine 对纯英文仍按空白切', tokenize('a b').length === 3,
  JSON.stringify(tokenize('a b')));
check('llHasCjk 对纯英文为 false', vm.runInContext('llHasCjk("hello")', sandbox) === false);
check('llHasCjk 对汉字/假名/韩文为 true',
  vm.runInContext('llHasCjk("中")', sandbox) === true &&
  vm.runInContext('llHasCjk("あ")', sandbox) === true &&
  vm.runInContext('llHasCjk("한")', sandbox) === true);

// 8) 降级路径：老内核没有 Intl.Segmenter → 按字切，仍可点，且不会整句查词
sandbox.Intl = {};   // 遮蔽宿主的 Segmenter
const fb = render('我很好，谢谢。');
const fbWords = clickable(fb);
check('无 Intl.Segmenter 时降级为按字切', fbWords.length >= 5, JSON.stringify(fbWords));
check('降级后每个汉字单独可点', fbWords.indexOf('我') >= 0 && fbWords.indexOf('好') >= 0,
  JSON.stringify(fbWords));
check('降级后仍不是整句一个词', spansOf(fb).every((s) => s.text !== '我很好，谢谢。'));
check('降级后渲染文本与原文一致', fb.textContent === '我很好，谢谢。', fb.textContent);
sandbox.Intl = Intl;  // 恢复
const back = render('我很好，谢谢。');
check('恢复 Intl.Segmenter 后重新走词典分词', clickable(back).indexOf('很好') >= 0,
  JSON.stringify(clickable(back)));

// 9) 分词器实例被复用（每行都 new 一个 Segmenter 会拖慢 500 行字幕列表）
check('Segmenter 实例有缓存', vm.runInContext('llWordSegmenter() === llWordSegmenter()', sandbox) === true);

const failed = results.filter((r) => !r.ok);
console.log('\n结果: ' + (results.length - failed.length) + '/' + results.length +
  ' PASS ' + (failed.length ? '❌' : '✅'));
if (failed.length) console.log('失败用例: ' + failed.map((f) => f.name).join(' | '));
process.exit(failed.length ? 1 : 0);
