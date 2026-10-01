// 回归测试：B 站搜索 / 列表页 CC 字幕识别
//
// 背景（新功能）：在 search.bilibili.com / space.bilibili.com 列表页，逐个查视频卡片的 CC 情况，
// 给有 CC 字幕的卡片打角标，并浮出可点击列表。依赖 B 站 x/web-interface/view 返回 data.subtitle.list。
//
// 做法：抽取 content.js 里真实的 parseViewSubtitles() / extractBvid() / isListPage() 源码来跑
// （不是复制算法），改坏实现会立刻让这个测试变红。
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const contentJs = fs.readFileSync(path.join(DIR, 'content.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));

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

// 这三个都是纯函数（不引用闭包变量），直接 eval 即可
const srcParse = extractFn(contentJs, 'parseViewSubtitles');
const srcBvid = extractFn(contentJs, 'extractBvid');
const srcList = extractFn(contentJs, 'isListPage');
const factory = new Function(srcParse + '\n' + srcBvid + '\n' + srcList +
  '\nreturn { parseViewSubtitles, extractBvid, isListPage };');
const api = factory();

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log('  ✓ ' + label + ' → ' + JSON.stringify(got)); }
  else { fail++; console.log('  ✗ ' + label + '：期望 ' + JSON.stringify(want) + '，实得 ' + JSON.stringify(got)); }
}
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '：' + detail : '')); }
}

// ---------- parseViewSubtitles ----------
console.log('— parseViewSubtitles：解析 x/web-interface/view 响应 —');
eq('有 CC（自带语言说明）', api.parseViewSubtitles({ data: { subtitle: { list: [{ lan: 'ai-zh', lan_doc: '中文（自动生成）' }] } } }),
  { hasCc: true, langs: ['中文（自动生成）'] });
eq('多个轨道都列出', api.parseViewSubtitles({ data: { subtitle: { list: [{ lan_doc: '中文（原生）' }, { lan_doc: 'English' }] } } }),
  { hasCc: true, langs: ['中文（原生）', 'English'] });
eq('空列表 = 无 CC', api.parseViewSubtitles({ data: { subtitle: { list: [] } } }), { hasCc: false, langs: [] });
eq('没有 subtitle 字段 = 无 CC', api.parseViewSubtitles({ data: {} }), { hasCc: false, langs: [] });
eq('响应为 null 也不崩', api.parseViewSubtitles(null), { hasCc: false, langs: [] });
eq('data 为 null 也不崩', api.parseViewSubtitles({ data: null }), { hasCc: false, langs: [] });
eq('兼容播放器接口的 subtitles 结构（AI 字幕）', api.parseViewSubtitles({ data: { subtitle: { subtitles: [{ lan: 'ai-zh', lan_doc: '中文（自动生成）' }] } } }),
  { hasCc: true, langs: ['中文（自动生成）'] });

// ---------- extractBvid ----------
console.log('— extractBvid：从各种链接抽出 BV 号（⚠️ BV 号大小写敏感，绝不能转大写） —');
eq('完整 bilibili 链接（保留大小写）', api.extractBvid('https://www.bilibili.com/video/BV1AbC2dEf3G'), 'BV1AbC2dEf3G');
eq('协议相对链接（保留大小写）', api.extractBvid('//www.bilibili.com/video/BV1xxYy9ZzWW'), 'BV1xxYy9ZzWW');
eq('带查询参数（保留大小写）', api.extractBvid('https://www.bilibili.com/video/BV1abcDEFghi?t=10'), 'BV1abcDEFghi');
eq('b23.tv 短链（保留大小写）', api.extractBvid('https://b23.tv/BV1xyzABCdef'), 'BV1xyzABCdef');
eq('全大写 BV 号保持原样（不再吞掉小写）', api.extractBvid('/video/BV1GJ411x7h7'), 'BV1GJ411x7h7');
eq('小写 bv 前缀的链接（兜底正则补成 BV）', api.extractBvid('https://www.bilibili.com/video/bv1AbCdEfGhI'), 'BV1AbCdEfGhI');
eq('不误匹配 bvid= 参数', api.extractBvid('https://www.bilibili.com/?bvid=123456'), null);
eq('非视频链接返回 null', api.extractBvid('https://www.bilibili.com/video/av123'), null);
eq('无链接返回 null', api.extractBvid(''), null);

// ---------- isListPage ----------
console.log('— isListPage：识别列表页（测试注入 loc，避免依赖浏览器全局） —');
ok('search.bilibili.com 是列表页', api.isListPage({ hostname: 'search.bilibili.com', pathname: '/all' }));
ok('space 的 video 页是列表页', api.isListPage({ hostname: 'space.bilibili.com', pathname: '/123/video' }));
ok('space 的 channel 页是列表页', api.isListPage({ hostname: 'space.bilibili.com', pathname: '/123/channel/collection' }));
ok('www 视频播放页不是列表页', !api.isListPage({ hostname: 'www.bilibili.com', pathname: '/video/BV1xx' }));
ok('www 番剧播放页不是列表页', !api.isListPage({ hostname: 'www.bilibili.com', pathname: '/bangumi/play/ss123' }));
ok('www 首页推荐流是列表页（带 ?spm 参数）', api.isListPage({ hostname: 'www.bilibili.com', pathname: '/', search: '?spm=abc' }));
ok('www 首页推荐流是列表页（无查询参数）', api.isListPage({ hostname: 'www.bilibili.com', pathname: '/' }));
ok('www 分类页 /c/ 是列表页', api.isListPage({ hostname: 'www.bilibili.com', pathname: '/c/animation' }));
ok('www 分区页 /v/ 是列表页', api.isListPage({ hostname: 'www.bilibili.com', pathname: '/v/douga' }));
ok('www 收藏夹 /fav/ 是列表页', api.isListPage({ hostname: 'www.bilibili.com', pathname: '/fav/123456' }));
ok('www 稍后再看 /watchlater 是列表页', api.isListPage({ hostname: 'www.bilibili.com', pathname: '/watchlater' }));
ok('youtube 不是列表页', !api.isListPage({ hostname: 'www.youtube.com', pathname: '/results' }));

// ---------- 源码级断言（防改坏 / 防漏配） ----------
console.log('— 源码级断言 —');
function has(label, hay, needle) {
  if (hay.indexOf(needle) >= 0) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + '：源码里找不到 ' + JSON.stringify(needle)); }
}
has('查 CC 的 view 请求已加 wbi 签名（用 fetchViewSigned 拼 w_rid）', contentJs, 'async function fetchViewSigned(bvid)');
has('fetchViewSigned 用 wbi 签名参数', contentJs, 'md5hex(query + getMixinKey(mixinKey))');
has('fetchViewSigned 走 wbi/view 端点（老 view 端点已被 B 站 412 风控）', contentJs, "'https://api.bilibili.com/x/web-interface/wbi/view?'");
ok('源码不再调用老 view 端点查 CC', contentJs.indexOf('x/web-interface/view?') < 0);
ok('extractBvid 不转大写（BV 号大小写敏感，转大写会被 B 站判 -404）', srcBvid.indexOf('toUpperCase') < 0);
has('失败原因会透出到面板进度条（ccLastErr）', contentJs, 'ccLastErr');
has('列表页分支在进入跟读面板前就分流', contentJs, "if (currentSite === 'bilibili' && isListPage())");
has('面板项点击会打开对应视频', contentJs, "window.open(card.href || ('https://www.bilibili.com/video/' + card.bvid)");
has('有并发上限防止被风控', contentJs, 'CC_MAX_CONCURRENCY = 3');
has('相邻请求做节流进一步降低风控', contentJs, 'CC_REQ_GAP');
has('设置项 searchCcEnabled 已接入 getSettings', contentJs, "'searchCcEnabled'");

const matches = manifest.content_scripts[0].matches;
ok('manifest 已覆盖 search.bilibili.com', matches.indexOf('https://search.bilibili.com/*') >= 0);
ok('manifest 已覆盖 space.bilibili.com', matches.indexOf('https://space.bilibili.com/*') >= 0);
ok('manifest 已用通配覆盖 www 站内列表页（含 /c/ 分类页）', matches.indexOf('https://www.bilibili.com/*') >= 0);
ok('manifest 版本已升到 1.0.8', manifest.version === '1.0.8', '当前 ' + manifest.version);

console.log('\n通过 ' + pass + ' / ' + (pass + fail));
process.exit(fail ? 1 : 0);
