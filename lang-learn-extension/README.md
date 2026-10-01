# LingoReel · Language Learning Video Assistant (Browser Extension)

> Turn **Bilibili / YouTube** videos into study material: a clickable subtitle list, shadowing with scoring, word lookup, vocabulary notebook, spaced-repetition review, and AI subtitle translation.
> 把 **B 站 / YouTube** 视频变成学习材料：逐句字幕列表、跟读录音评分、点词查词、生词本、间隔重复复习、AI 字幕翻译。
> All data stays in your browser (`chrome.storage.local`) — **no login, no account, nothing uploaded**. 数据全在本地，**无需登录、无账号、不上传**。

**Version v1.0.8** · MV3 · Chrome / Edge / Quark / Kiwi · MIT License

[![Get LingoReel for Chrome](https://img.shields.io/badge/Chrome_Web_Store-Download-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/lingoreel/jghdcidakakmfacgnpmiepeplfgljbmc)
[![Get LingoReel for Edge](https://img.shields.io/badge/Microsoft_Edge-Download-0078D4?logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/lingoreel/jfdkckgipihhiebhcgembhpmdoeediio)

[**English**](#english) · [**中文**](#中文)

---

# 🇬🇧 English

## What it does

The hard part of learning from foreign-language videos isn't *seeing* subtitles — it's turning them into studyable material. **LingoReel** splits the CC track into a per-sentence list and wires up a full loop: **shadow → look up → save → review**.

### Subtitles
- **Sentence-by-sentence subtitle list** on the right, with the current line auto-highlighted and auto-scrolled.
- **Multi-track selection** — lists all CC tracks (English / 中文 / 日本語 …) and auto-selects a **non-Chinese track** by default (learn from the original).
- **Dual subtitles** — show a primary track plus a secondary track simultaneously (e.g. English original + Chinese translation).
- **Click a line to shadow (▶)** — jumps to that line and plays it. Whether it **auto-pauses at the end of the line follows the "Pause" toggle**: off = keep playing continuously, on = stop after that one line. ASR caption segmentation often disagrees with what your ear calls "one sentence", so the stop point is **clamped to where the next line actually starts** — one click plays one line, not two.
- **AI translation track** — when a video has only an original-language CC track and no track in your **native language**, the whole track is translated into your native language and added as a new **"（AI 翻译）" track**. It shows up in the dropdown like a native track: selectable as the primary track, and auto-assigned as the secondary (dual-subtitle) track. The **"译 [native]"** button (label follows your native language) triggers it manually and stops a run in progress.
- **Three interchangeable translation engines** — **LLM API** (DeepSeek / SiliconFlow / Zhipu GLM / Moonshot / Qwen / OpenAI…, best quality, bring your own key) → **free Google endpoint** → **MyMemory** (usually reachable from mainland China). Default "auto" relays through them in order: if the LLM gets rate-limited halfway, the free engines fill the remaining lines so the track never has gaps.
- **Progressive translation** — a 200+ line video no longer sits blank for a minute. Lines are translated in **batches (the first batch is only 8 lines, so results show up almost immediately; 20 lines after that)**, and **after every batch the partial result is written into the translation track and re-rendered**, so translated lines keep flowing into the floating window. The status bar shows "N/M lines · K on screen", and hitting **Stop** keeps whatever has already been translated. Results are only **cached when essentially complete**.
- **Live subtitle row** — shows the current line, and every word in it is **clickable**.
- **Shadowing score (🎤)** — click 🎤 to record your read-aloud of that line through the **microphone** (mic audio only, not the tab), click ■ to stop. The browser's **speech recognition** transcribes what you said and we score **word-level similarity** against the original line (green ≥80 / amber ≥60 / red <60), with **replay your take / the original** and re-record. Available both on list rows and on the floating window's live row.

### Bilibili CC scan (new in 1.0.2+)
- On Bilibili **search / category (`/c/`) / homepage (`?spm`) / user-space** pages, LingoReel auto-detects which videos have an official **CC subtitle** track.
- A **side panel** lists those videos with the available subtitle languages and marks each card with a `CC` badge; **click any entry to jump straight to the video**.
- The scan calls Bilibili's signed `x/web-interface/wbi/view` endpoint (wbi-signed, throttled, concurrency-limited) and shows a live **"checked M/T · failed K"** progress plus a **Retry** button. (v1.0.6 fixed two fatal scan bugs — see Version highlights.)

### Lookup & dictionaries
- **Click a word to look it up, double-click to save it** — works on both the subtitle list and the floating window's live row, sharing one code path.
- Dictionary source is configurable:
  - **Local dictionary (highest priority by default)** — returns instantly and **fully offline** when the word is in an imported dictionary;
  - **Online** — `dictionaryapi.dev`, falling back to Wiktionary;
  - **Eudic (local app)** — opens the native Eudic app via the `eudic://` URL scheme (supports Japanese and many other languages);
  - **LLM (best)** — asks your configured LLM (with the sentence as context) for part-of-speech / meaning / usage / example, and **auto-fills the translation into the saved-word note on double-click**.
- **Import dictionary files directly** — plain-text dictionaries (one word per line, followed by `n./v./a./ad./abbr.`-prefixed definitions), plus `word<TAB|space|colon>definition` and JSON. **GBK / UTF-8 auto-detection**, "clear before import" to replace the whole book, and one-click clear.

### Vocabulary notebook & review
- Entries carry a **note**, a `box` (1–5) and a `due` timestamp.
- **Definitions are shown right in the list** (read from the local dictionary, offline) — no need to enter review mode just to see them.
- **Lemmatization** — saved words are often inflected (`created` / `written` / `studies` / `biggest`); lookup restores the base form (irregular table + suffix rules + consonant doubling) and labels the source when it hits.
- If a word isn't found: `🔍 Look up online` or `✎ Edit word` (turn an inflection into its base form).
- **Spaced repetition (Leitner)** — after "Remember / Forgot", the definition **and your note** are revealed, and the next interval is adjusted (10 min / 1 h / 1 d / 3 d / 7 d).
- **Standalone notebook page** (`vocab.html`) — usable without opening a video; bookmarkable. Supports **export / import JSON backup**.

### Interface
- **Floating window (▢)** — collapses the panel to a small window showing only the current subtitle line (or two, for dual subtitles). It's **draggable (mouse + touch)** and **word-clickable** — great for minimal shadowing in the corner.
- **Works in real fullscreen** — entering fullscreen temporarily re-parents the panel into the fullscreen element (otherwise the browser paints nothing outside it), auto-switches it to floating mode, and puts it back where it was when you exit.
- **Two independent opacity sliders** — *background* opacity and *text* opacity are separate, so dimming the background no longer washes out the subtitle text.
- **Native-language aware** — the "native language / translation target" dropdown decides what subtitles are translated into, and the **panel UI language follows that choice** (built-in 中文 / English / 日本語 / 한국어; other native languages keep the Chinese UI, but translation itself is unrestricted).
- **Pause toggle = per-page override (1.0.7)** — the panel's "Pause" button and the popup's "Auto-pause" checkbox used to write the *same* stored flag, so a checked global default kept overriding the panel. They're separate now: the popup stays the **starting state for new pages**, while the panel button is a **temporary override for the current page** that never writes back. Turn it off mid-video and it stays off.
- **Diagnostics** — dumps page structure / subtitle source / fetch details; hit **"Copy report"** to paste into a bug report.

## Supported sites

| Site | Status | Notes |
|---|---|---|
| **Bilibili** | ✅ Full support | Uses the Bilibili subtitle API (`x/player/wbi/v2`, requires login). Works for regular videos and bangumi/drama. **CC scan** also covers `search.bilibili.com`, `space.bilibili.com`, `/c/` category, homepage `?spm`, `/fav`, `/medialist`, `/watchlater`. |
| **YouTube** | ✅ Full support | A MAIN-world script extracts `captionTracks`; body parsing supports **JSON3 / WebVTT / XML**; SPA video switches are re-parsed automatically. |

> Requirement: the video must have a **selectable CC track**. Hard-burned subtitles and browser-built-in **AI live captions** (rendered in the kernel's private layer, outside the page DOM) cannot be read.

## Install (load unpacked, no build step)

1. Open the extensions page:
   - Chrome / Edge / Quark: type `chrome://extensions` (`edge://extensions` for Edge)
   - Kiwi Browser (Android): menu → Extensions
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this directory (the folder containing `manifest.json`).
4. Open a video **with CC subtitles**:
   - Bilibili: `/video/` or `/bangumi/play/` — **sign in to Bilibili** (the subtitle API needs login)
   - YouTube: any video with CC
5. The panel appears on the right, lists tracks and loads the original text; play to shadow / look up / save / review.
6. **After editing code**: click the extension's **Refresh** icon, then reload the video page (otherwise the page still runs the old script).

> ⚠️ After changing the **MAIN-world script registration** in `manifest.json`, you **must refresh the extension** — MAIN-world scripts are not hot-reloaded.

## Tips

- **Learn from the original**: the panel auto-selects a non-Chinese track. For "original + native", pick the native track in the "Compare" dropdown, then switch to the floating window — it stacks two lines.
- **Continuous listening**: turn the "Pause" toggle **off** — clicking a line plays continuously from there. Turn it on to stop after one line.
- **A word won't resolve**: it's probably an inflection (`written` / `studies`). Use `✎ Edit word`, or rely on automatic lemmatization. If *nothing* resolves, check whether the dictionary imported successfully (notebook page → 📖 Local dictionary).
- **Bilibili CC scan not finding videos?** Open the extension popup and make sure **"Mark videos with CC subtitles"** is on; on a list page the side panel shows live progress ("checked M/T · failed K"). If failures pile up, the panel reports the HTTP/business code (e.g. `code -352` = rate-limited) — see Console `checkCc` logs.
- **Standalone notebook**: bookmark `chrome-extension://<extension-id>/vocab.html` to review anytime without a video.

## Known limitations

- **Hard-burned subtitles**: if the video only has burned-in subtitles and no selectable CC track, the original text is unreachable (diagnostics will show "CC tracks: 0").
- **Browser AI live captions** (e.g. Quark) render in a private UI layer, not in the page DOM, so they can't be read.
- **Bilibili subtitles require login**; without it the API may return empty.
- **Binary dictionaries** (Eudic MDX / StarDict) can't be parsed inside the extension — convert to plain text first.
- **Space-less languages like Japanese**: a whole sentence becomes one clickable unit (and online dictionaries are weak for Japanese — use a local Eudic dictionary).
- **Free translation endpoints have quotas**: Google may rate-limit (429) and MyMemory's anonymous quota is a few thousand chars/day; very long videos may translate only part — click "译 [native]" again later to continue. Translations are machine output; don't treat them as ground truth.
- **Over-long videos translate the first 1500 lines only**: beyond that the free endpoints hard-fail; better to get the first half done.
- **Custom LLM domains need one authorization**: DeepSeek / SiliconFlow / Zhipu / Kimi / Qwen / Volc / OpenAI / Groq are built into `host_permissions` (no auth needed); a relay/proxy outside that list will prompt once for authorization when you click "Test connection".
- **Shadowing score relies on the browser's online speech recognition**: Chrome/Edge send the recording to Google's speech service, so it must be reachable. On Bilibili over a direct mainland-China connection it usually isn't — the panel now says so explicitly (`识别失败：语音识别服务连不上`) instead of silently scoring 0. **Recording itself still works**: use **🔁 我的录音** to replay your take and self-assess. (Subtitle `lan` tags are normalized to standard BCP-47 first — Chrome rejects `zh-Hans` outright; see v1.0.8.)

## Project layout

```
lang-learn-extension/
├── manifest.json          # MV3 manifest (incl. YouTube MAIN-world script, i18n _locales)
├── content.js             # Core: subtitle fetch/parse, list, shadowing, lookup, vocab, review, CC scan, floating window, diagnostics
├── content.css            # Panel / floating window / popup / CC-panel styles
├── yt-main.js             # YouTube MAIN-world script: read player response, intercept subtitle requests, postMessage to the extension
├── background.js          # Service worker: lookup proxy, lemmatization, batch local-dictionary queries, translation engine chain, LLM
├── popup.html / js / css  # Toolbar popup: toggles, dictionary source, translate target, LLM settings, quick vocab view
├── vocab.html / vocab.js  # Standalone notebook: review, import/export, local dictionary management
├── _locales/en_US, zh_CN  # i18n name / description / title
├── icons/                 # 16 / 48 / 128 px (blue-purple gradient)
├── test-*.js              # Node tests (see below)
├── LICENSE                # MIT License
└── README.md
```

## Tests

**20** self-contained Node tests (no dependencies for most; **4** end-to-end need `jsdom`):

| Test | Covers |
|---|---|
| `test-parse.js` | Dictionary parsing (GBK decoding, POS segmentation, misalignment, `<br>` cleanup) |
| `test-lemma.js` | Lemmatization (irregular table, suffix rules, consonant doubling, irregular plurals) |
| `test-live-words.js` | Floating-window live row word-clickability + no per-frame DOM rebuild |
| `test-vocab-smoke.js` | Standalone notebook init & render |
| `test-yt.js` | YouTube response brace-matching extraction, track parsing |
| `test-yt-fmt.js` | YouTube subtitle body parsing for JSON3 / VTT / XML |
| `test-yt-bridge.js` | MAIN-world bridge: track forwarding, videoId validation, handshake resend, request interception |
| `test-css-structure.js` | CSS structural audit (brace balance, dangling commas, empty rules) |
| `test-sticky-cue.js` | Cue boundary: while paused on `prev.to == next.from` the just-heard line stays locked (▶ and 🎤 must target the same line) |
| `test-autopause.js` | Auto-pause state machine: arms once, pauses at line end, survives "rolling" ASR captions, refuses expired targets, seek guard, clamps stop to next line's start; panel toggle stays a per-page override and never writes back the global default (42 assertions) |
| `test-progressive-tr.js` | Progressive translation: batch schedule (small first batch, gapless coverage), partial-text → partial track, per-batch screen update, no caching of half-done results |
| `test-pron-score.js` | Shadowing score: word-level F1 similarity, edit-distance ≤1 tolerance, colour thresholds |
| `test-translate.js` | AI track: batch chunking, gtx parsing, fallback to per-line when counts mismatch, MyMemory fallback, virtual-track selection & body retrieval, LLM endpoint normalization |
| `test-translate-target.js` | Native-language follow: `trackInTargetLang` logic, button/label dynamic, no hardcoded Chinese (21 assertions) |
| `test-translate-flow.js` | (needs `npm i jsdom`) end-to-end run of `content.js`: auto-translate → build translated track → assign as secondary → switch primary track |
| `test-llm-dict.js` | (needs `npm i jsdom`) LLM dictionary card (POS / meaning / example) end-to-end |
| `test-fullscreen.js` | (needs `npm i jsdom`) fullscreen floating window: re-parent into fullscreen, auto-switch, restore on exit; `<video>` fullscreen container fallback |
| `test-search-cc.js` | Bilibili CC scan: `wbi/view` endpoint, BV-case sensitivity, list-page detection, no old `view` endpoint (43 assertions) |
| `test-popup-llm.js` | Popup LLM preset switching: Base URL **and** model update together and are persisted atomically — regression lock for the "model changed but URL stayed DeepSeek" bug (needs `jsdom`, 9 assertions) |
| `test-rec-lang.js` | Shadowing recording: subtitle `lan` normalized to BCP-47 labels Chrome accepts (`zh-Hans`→`zh-CN`), all 12 real Bilibili `lan` values land in the supported list, speech/mic errors surfaced instead of swallowed (45 assertions) |

```bash
# syntax check
for f in content.js background.js popup.js vocab.js yt-main.js; do node --check "$f"; done

# most tests are zero-dependency
node test-parse.js
node test-lemma.js
node test-translate.js
node test-autopause.js
node test-progressive-tr.js
node test-sticky-cue.js
node test-live-words.js
node test-search-cc.js
node test-translate-target.js
node test-pron-score.js
node test-rec-lang.js
# end-to-end (optional dependency)
npm i jsdom && node test-translate-flow.js && node test-llm-dict.js && node test-fullscreen.js && node test-popup-llm.js
```

## Version highlights (selected)

- **v1.0.8** **Shadowing recording failed on Bilibili (worked on YouTube).** Two causes, both fixed. ① **Subtitle `lan` was passed to `SpeechRecognition.lang` raw.** Bilibili's real `lan` values are `zh-Hans` / `zh-Hant` / `ase` / `iw` (confirmed against the live `wbi/view` response), but Chrome only accepts standard labels like `zh-CN` / `zh-TW` — handing it `zh-Hans` raises `language-not-supported` immediately. YouTube tracks are usually `en` → `en-US`, which the old map happened to cover, hence "works there". Language tags are now normalized (alias → exact → preferred region → fallback), and `language-not-supported` now retries once with `en-US` instead of giving up. ② **`sr.onerror = () => {}` swallowed every error**, so a failure looked like "recording did nothing". Errors are now surfaced with actionable hints (`network` = speech service unreachable, `not-allowed` = grant permission, `audio-capture` = no mic input…), and `getUserMedia` failures are differentiated too (permission denied vs. no device vs. device busy).
- **v1.0.7** **Two popup/panel control bugs fixed.** ① **Auto-pause couldn't be turned off.** The popup's "Auto-pause" checkbox and the panel's "Pause" button were writing the *same* persisted key, so once you enabled it globally in the popup, "on" kept beating the panel's attempts to switch it off. They're now separate: the popup sets the **starting state for new pages**, and the panel button is a **per-page temporary override** that never writes back — you can always stop auto-pause for the current tab. Diagnostics label the state `(panel override)` so you can tell which one is active. ② **Choosing an LLM preset didn't update the Base URL** — you'd pick another provider yet the URL stayed on DeepSeek. The preset's `change` handler had two listeners: a generic auto-save ran *first* (persisting the **old** values) while `applyPreset` ran later (filling the new ones but never saving). Preset switching is now one atomic step: fill Base URL + model, **then** persist both together.
- **v1.0.6** **CC scan fully fixed (two fatal bugs).** ① The old `x/web-interface/view` endpoint is now hard rate-limited (412) and returns an HTML challenge page instead of JSON — every `checkCc` parse failed. Switched to the live **`x/web-interface/wbi/view`** endpoint (wbi-signed). ② `extractBvid` wrongly called `.toUpperCase()` on the BV id — but **BV ids are case-sensitive**, so `BV1ujaZ68Ea5` became `BV1UJAZ68EA5` and Bilibili returned `-404` for 105/108 videos. Removed the casing rewrite; the panel now surfaces the failure reason (e.g. `failed K (HTTP 412)` / `code -352`).
- **v1.0.5** **CC scan was effectively dead.** Added wbi signing + 140 ms throttle + concurrency drop to 3, AI-subtitle-track compatibility, and a live progress + **Retry** button in the CC panel.
- **v1.0.4** **Native-language translation target.** The skip-translation check no longer hardcodes Chinese — it skips only when the source is already the chosen target language; button/label text is now dynamic (no more mixed Chinese/English). Also added Bilibili homepage `?spm` recommendation feed to the CC scan.
- **v1.0.2 – v1.0.3** **Bilibili list-page CC scan (new feature).** Detects videos with official CC subtitles on search / category / space pages, lists them in a side panel with badges, click-to-open. Manifest now injects `search.bilibili.com/*` and `space.bilibili.com/*`.
- **v1.0.1** **First public release (Chrome Web Store / Edge Add-ons).** Branded **LingoReel**; ships store-listing assets — 1280×800 screenshots plus 440×280 / 920×680 promo tiles.
- **Earlier 0.7.x history** — branding for store release; "one line plays two sentences" auto-pause clamp + progressive translation; auto-pause actually pausing (self-healing re-attach + independent timer); inline 🎤 shadowing score; fullscreen floating window; LLM translation engine with relay fallback; AI native-language track; multi-source lookup; site-dispatch + YouTube MAIN-world bridge; floating-window / minimize modes; local-dictionary import (GBK); CORS fix.

## Privacy

- All settings, vocabulary and local dictionaries live in your browser — **nothing is uploaded**.
- Network requests happen only for: word lookup (dictionaryapi.dev / Wiktionary), subtitle fetching (Bilibili / YouTube), and **translation when you turn on the AI track** (Google / MyMemory, or the LLM endpoint you configured yourself).
- The LLM API key is stored locally and never synced to your browser account.
- No analytics, no tracking, no accounts.

## License

Released under the [MIT License](LICENSE).

---

# 🇨🇳 中文

## 它能做什么

看外语视频最难的不是"看不到字幕"，而是**把字幕变成能学的材料**。**LingoReel（视频外语跟读助手）**把视频里的 CC 字幕拆成逐句列表，接上「跟读 → 查词 → 存生词 → 复习」一条完整的学习闭环。

### 字幕层
- 右侧**逐句字幕列表**，播放时当前行自动高亮、自动滚动定位。
- **多轨道选择**：列出视频所有 CC 轨道（如 English / 中文 / 日本語），自动优先选**非中文原文轨道**（学外语就该看原文）。
- **双语叠显**：主轨道 + 对照轨道同时显示，可单独指定第二条轨道（如"英文原文 + 中文对照"）。
- **点击跟读（▶）**：跳转到该句开头播放；**点句是否自动暂停，跟随「暂停」开关**——开关关着就连续播放、开着就放完这一句停下。ASR 字幕的分段常与"人耳听到的句子"不一致，插件会把停止点**收紧到下一句真正开始的地方**，所以是"点一句、停一句"，不会读两句才停。
- **AI 译文轨道**：CC 只有原文、没有「母语」轨道时，自动把整条字幕翻译成**你的母语**，生成一条新的「（AI 翻译）」轨道——它跟原生轨道一样出现在下拉里，可选为主轨道（列表全母语），默认自动挂到「对照」位。按钮文案「译 [母语]」也会跟随母语变化。也可点面板上的按钮手动触发 / 中途停止。
- **翻译引擎三选一**：**大模型 API**（DeepSeek / 硅基流动 / 智谱 / Kimi / 通义 / OpenAI…，质量最好）→ **Google 免费端点** → **MyMemory**（国内通常可达）。默认「自动」按这个顺序接力：大模型限流只译出一半时，剩下的自动由免费接口补上，轨道不会缺行。
- **译文边翻边上屏（渐进式）**：200 多行的长视频不再"点完等一分多钟什么都看不到"——插件按块翻译（首块只有 8 行，几乎立刻出结果；之后每块 20 行），每译完一块就把已有译文写进译文轨道并刷新，译文一行行往外冒。状态栏实时显示「已翻 N/M 行 · 已上屏 K 行」，中途点「停止」会保留已经翻好的部分，且只在基本翻全时才写缓存。
- **实时字幕行**：显示当前时间点对应的字幕，**逐词可点**。
- **跟读录音打分（🎤）**：点 🎤 用麦克风录下你跟读这一句（**只录人声，不录视频声**），点 ■ 停止；浏览器语音识别把你的话转成文字，给**逐词相似度**基础分（绿≥80 / 橙≥60 / 红<60），可回放「我的录音 / 原句」再读一遍。列表行和窗口化小窗的实时行都能用。

### B 站 CC 字幕扫描（1.0.2+ 新增）
- 在 B 站**搜索页 / 分类页（`/c/`）/ 首页推荐流（`?spm`）/ 个人空间页**，自动识别哪些视频带官方 **CC 字幕**轨道。
- 左侧**浮层列表**把这些视频列出来并标注可用字幕语言，每张卡片加 `CC` 角标；**点任意一项直达对应视频**。
- 扫描调用 B 站签名接口 `x/web-interface/wbi/view`（带 wbi 签名、节流、限并发），面板实时显示「已查 M/T · 失败 K」进度与「重测」按钮。（v1.0.6 修好了两处致命扫描 bug——见版本历程。）

### 查词与词典
- **点单词查释义，双击存生词**——字幕列表和浮窗那行字都能点，共用同一套逻辑。
- 查词来源可在设置里切换：
  - **本地词库（默认最高优先级）**：导入的整本词典命中即返回，**离线、零延迟**；
  - **在线词典**：`dictionaryapi.dev` → Wiktionary 兜底；
  - **本地欧路词典**：通过 `eudic://` 官方 URL Scheme 唤起本机欧路查词（支持日语等任意语种）；
  - **大模型 AI 翻译（质量最好）**：把单词连同**所在句子语境**一起问你配置的大模型，返回「词性 / 释义 / 说明 / 例句」结构化卡片；**双击存生词时自动把译文写进注释**。
- **本地词库可直接导入词典文件**：支持牛津 / CSDN 等下载的纯文本 TXT 词典（每行一个单词、下接 `n./v./a./ad./abbr.` 等词性释义行），也支持 `单词<TAB或空格或冒号>释义` 及 JSON；**自动识别 GBK / UTF-8 编码**，支持「导入前清空」整本替换与一键清空。

### 生词本与复习
- 生词条目带**注释**、`box(1–5)` 与 `due` 时间戳。
- **列表里直接显示释义**（来自本地词库，纯本地读取），不必进复习才看得到。
- **词形还原**：存进去的往往是 `created` / `written` / `studies` / `biggest` 这类变形，查库时自动还原到原形再匹配（不规则表 + 规则词缀 + 辅音双写），命中会标注来源。
- 未收录时可一键 `🔍 联网查` 或 `✎ 改词`（把变形改成词典原形）。
- **记忆曲线复习（Leitner 间隔重复）**：点「记得 / 不记得」后揭晓释义 + 当时填的注释，并调整下次复习间隔（10 分钟 / 1 小时 / 1 天 / 3 天 / 7 天）。
- **独立生词本页面**（`vocab.html`）：不打开视频也能用，可作为书签直接访问。支持**导出 / 导入 JSON 备份**。

### 界面
- **窗口化浮窗（▢）**：面板收成一个小窗，只显示当前字幕一行（可双语两行），**可拖动（鼠标 + 触屏）**、**可逐词点查**——适合放视频角落里极简跟读。
- **全屏也能浮窗**：进真正全屏时，面板会被临时挂载到全屏元素里（全屏下浏览器只绘制全屏元素及其后代，挂在 body 上的会被整棵裁掉），并自动切成浮窗模式；退出全屏再搬回原处、还原原来的窗口化状态。
- **两个独立透明度滑块**：「背景透明度」与「文字透明度」分开调，调暗背景不会再把字幕文字一起调糊，二者互不影响；侧边固定面板始终不透明。
- **母语 / 界面语言**：设置里的「母语 / 译文语言」下拉决定字幕翻译成什么语言，**面板界面文字也跟随母语**（内置中文 / English / 日本語 / 한국어 四套；其它母语界面仍显示中文，译文语言本身不受限）。
- **「暂停」开关 = 本页临时覆盖（1.0.7）**：面板上的「暂停」按钮和弹窗里的「自动暂停」复选框，此前写的是**同一个存储键**——只要在弹窗里勾了全局默认，「开」就会反复压过面板的关闭操作，感觉像面板失控。现在两者分离：弹窗里的仍是**新页面的起始状态**，面板按钮则是**只影响当前页的临时覆盖**、不会写回全局。视频中途关掉就一直关着。
- **诊断面板**：一键导出页面结构 / 字幕来源 / 抓取详情，出问题时点一下「复制报告」即可反馈定位。

## 支持的网站

| 网站 | 状态 | 说明 |
|---|---|---|
| **Bilibili** | ✅ 完整支持 | 走 B 站字幕 API（`x/player/wbi/v2`，需登录态），普通视频 / 影视番剧均可。**CC 扫描**另覆盖 `search.bilibili.com`、`space.bilibili.com`、`/c/` 分类、首页 `?spm`、`/fav`、`/medialist`、`/watchlater`。 |
| **YouTube** | ✅ 完整支持 | 主世界脚本提取 `captionTracks`；正文兼容 **JSON3 / WebVTT / XML** 三种格式；SPA 切视频自动重解析 |

> 前提：视频**必须有可选的 CC 字幕轨道**。UP 主/作者烧进画面的**硬字幕**、以及浏览器自带的 **AI 实时听译字幕**（渲染在内核私有层，不在网页 DOM 内）都无法读取。

### 大模型翻译接口怎么填（可选）

默认那套免费方案能跑，但**机翻质量一般**；想让译文像人翻的，就在插件设置里勾上**用大模型 API 翻译**，填三样东西：

| 字段 | 填什么 | 举例 |
|---|---|---|
| **Base URL** | 厂商给的 OpenAI 兼容地址 | `https://api.deepseek.com` |
| **模型名** | 控制台里的模型 ID，**照抄** | `deepseek-flash` |
| **API Key** | 平台创建的密钥（`sk-` 开头那串） | `sk-xxxxxxxx` |

填完一定点一下 **「测试连接」**——它会真翻一句 `Good morning, everyone.` 并把结果显示出来。常见报错对照：**401/403 = Key 错**，**404 = 地址或模型名错**，**429 = 限流/额度用尽**。

各家的推荐值（**模型名随时会变，以各家控制台为准**）：

| 平台 | Base URL | 模型 | 费用 |
|---|---|---|---|
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-flash` | 不免费但极便宜：输入约 $0.15 / 百万 tokens，输出约 $0.6。充 10 元能用很久 |
| **硅基流动** | `https://api.siliconflow.cn/v1` | **免费填** `tencent/Hunyuan-MT-7B` | 腾讯的**翻译专用模型**，当前输入输出免费（需实名；免费名单会调整，看 siliconflow.cn/pricing） |
| **智谱 GLM** | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` | Flash 系列长期免费，新用户另有免费 tokens |
| Moonshot / Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` | 付费，有赠送额度 |
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | 新人有免费额度 |
| 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | 填**接入点 ID**（`ep-xxx`） | 部分模型有免费额度 |
| OpenAI / Groq | `https://api.openai.com/v1` · `https://api.groq.com/openai/v1` | `gpt-4o-mini` · `llama-3.3-70b-versatile` | 国内通常需代理 |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:7b` | 完全离线免费，速度看本机 |

> ⚠️ **DeepSeek 特别注意**：老教程里的 `deepseek-chat` / `deepseek-reasoner` **已于 2026-07-24 停用**，现在官方模型名是 **`deepseek-flash`**（V4.1 Flash）。照着旧教程填会直接报错。
>
> API Key 只存在本机（`chrome.storage.local`），**不会**同步到浏览器账号，也不参与任何上传。

## 安装（本地加载，无需打包发布）

1. 打开扩展管理页：
   - Chrome / Edge / 夸克：地址栏输入 `chrome://extensions`（Edge 用 `edge://extensions`）
   - Kiwi Browser（安卓）：菜单 → 扩展
2. 右上角打开 **「开发者模式」**。
3. 点 **「加载已解压的扩展程序」**，选择本目录（含 `manifest.json` 的那一层）。
4. 打开一个**带 CC 字幕**的视频：
   - Bilibili：`/video/` 或 `/bangumi/play/`，**需登录 B 站账号**（字幕 API 依赖登录态）
   - YouTube：任意带 CC 的视频
5. 右侧出现面板，顶部自动列出字幕轨道并加载原文；播放后可跟读 / 查词 / 存词 / 复习。
6. **改完代码后**：回扩展管理页点插件的 **「刷新」** 图标，再重载视频页（否则页面里跑的还是旧脚本）。

> ⚠️ 更新过 `manifest.json` 里的 **MAIN world 脚本注册**后，**必须刷新扩展**才会生效——主世界脚本不是热加载的。

## 使用 tips

- **学外语先看原文**：面板会自动选非中文轨道；想要"原文 + 母语对照"，在「对照」下拉里选母语轨，然后窗口化，浮窗里就会叠两行。
- **想连续听**：把「暂停」开关关掉，点某句就是从该句起连续播放；打开开关才是"放完一句停"。
- **词典导入后查不到词**：多半是生词存的是变形（`written`/`studies`），点 `✎ 改词` 改成原形，或依赖自动词形还原；若整本词典都没释义，检查是否导入成功（生词本页 → 📖 本地词库）。
- **B 站 CC 扫描没识别出来？** 打开插件弹窗确认**「标出有 CC 字幕的视频」**已勾选；在列表页左侧浮层会显示实时进度（「已查 M/T · 失败 K」）。若失败堆积，面板会直接标出原因（如 `code -352` = 限流），也可看 Console 里 `checkCc` 的日志。
- **独立生词本**：把 `chrome-extension://<扩展ID>/vocab.html` 存成书签，随时复习，不用开视频。

## 已知限制

- **硬字幕抓不到**：视频只有烧进画面的字幕、没有可选 CC 轨道时，任何方式都拿不到原文（诊断会显示「CC 轨道数: 0」）。
- **浏览器 AI 实时字幕抓不到**：夸克等浏览器的 AI 听译渲染在私有 UI 层、不在网页 DOM 内，扩展无从读取。
- **B 站字幕依赖登录态**：未登录可能返回空或报错。
- **二进制词典不支持**：欧路 MDX / StarDict 等二进制格式无法在扩展内解析，需先转成纯文本。
- **日语等无空格语言**：整句会是一个可点单元（在线词典的日语支持也较弱，可走欧路本地词库）。
- **免费翻译接口有额度**：Google 端点随时可能限流（429），MyMemory 匿名额度约每日数千字符；长视频可能只翻译出一部分，隔一会再点「译 [母语]」可继续。译文是机器翻译，别当标准答案。
- **超长视频只译前 1500 行**：再长会让免费接口直接限流到全线失败，宁可先给前半段。
- **自定义大模型域名要授权一次**：DeepSeek / 硅基流动 / 智谱 / Kimi / 通义 / 火山 / OpenAI / Groq 已内置在 `host_permissions` 里，**直接用不用授权**；填了列表外的中转站域名时，点「测试连接」会弹一次授权请求，允许后后台才能发出去。
- **跟读打分依赖浏览器的在线语音识别**：Chrome/Edge 会把录音送到 Google 的识别服务，必须能连通才行。在 B站 直连国内网络时通常连不通——面板现在会明确提示「识别失败：语音识别服务连不上」，而不是默默打 0 分。**录音本身是成功的**，可点 **🔁 我的录音** 回放自评。（字幕 `lan` 会先规范化成标准 BCP-47，因为 Chrome 完全不接受 `zh-Hans`；见 v1.0.8。）

## 目录结构

```
lang-learn-extension/
├── manifest.json          # MV3 清单（含 YouTube MAIN world 脚本注册、i18n _locales）
├── content.js             # 页面主逻辑：字幕拉取/解析、列表、跟读、查词、生词、复习、CC 扫描、浮窗、诊断
├── content.css            # 面板 / 浮窗 / 弹层 / CC 浮层样式
├── yt-main.js             # YouTube 主世界脚本：读播放器响应、截获字幕请求，postMessage 转发
├── background.js          # Service Worker：查词转发、词形还原、批量本地词库查询、翻译引擎链、LLM
├── popup.html / js / css  # 工具栏弹窗：开关、查词来源、译文语言、大模型设置、生词快速查看
├── vocab.html / vocab.js  # 独立生词本页：复习、导出导入、本地词库管理
├── _locales/en_US, zh_CN  # i18n 名称 / 描述 / 标题
├── icons/                 # 16 / 48 / 128 px（蓝紫渐变）
├── test-*.js              # Node 测试（见下）
├── LICENSE                # MIT 许可证
└── README.md
```

## 测试

仓库自带 **20** 个 Node 测试（多数零依赖，**4** 个端到端需 `jsdom`），覆盖最容易出错的几处逻辑：

| 测试 | 覆盖内容 |
|---|---|
| `test-parse.js` | 词典文件解析（GBK 解码、词性分段、错位、`<br>` 清洗） |
| `test-lemma.js` | 词形还原（不规则表、规则词缀、辅音双写、不规则复数） |
| `test-live-words.js` | 浮窗实时字幕逐词可点 + 防每帧重建 DOM |
| `test-vocab-smoke.js` | 独立生词本页初始化与渲染 |
| `test-yt.js` | YouTube 响应括号配对提取、轨道解析 |
| `test-yt-fmt.js` | YouTube 字幕正文三格式（JSON3 / VTT / XML）解析 |
| `test-yt-bridge.js` | 主世界桥接：轨道转发、videoId 校验、握手重发、请求截获 |
| `test-css-structure.js` | CSS 结构体检（括号配平、悬挂逗号、空规则） |
| `test-sticky-cue.js` | 句边界锁行：暂停在「上一句 to == 下一句 from」上时，刚听完的那句保持锁定（▶ 与 🎤 必须指向同一句） |
| `test-autopause.js` | 自动暂停状态机：目标只武装一次、播到句尾停住、能扛住"滚动式 ASR 字幕"、拒绝过期目标、seek 保护期、停止点收紧到下一句起点；面板开关为本页临时覆盖、不回写全局默认（42 断言） |
| `test-progressive-tr.js` | 渐进式翻译：分块调度（首块小、不重不漏）、半截译文只上屏已译行、逐块上屏的流式契约、半截结果不写缓存 |
| `test-pron-score.js` | 跟读打分：逐词 F1 相似度、编辑距离 ≤1 容错、颜色分级阈值 |
| `test-translate.js` | AI 译文轨道：批量分组、gtx 解析、条数不符降级逐条、MyMemory 回退、虚拟轨道挑选与取正文 |
| `test-translate-target.js` | 母语跟随：跳过判定 `trackInTargetLang`、按钮/标签动态、不再写死中文（21 断言） |
| `test-translate-flow.js` | （需 `npm i jsdom`）端到端跑 `content.js`：自动翻译 → 生成译文轨道 → 挂对照位 → 切主轨道 |
| `test-llm-dict.js` | （需 `npm i jsdom`）大模型词典卡片（词性/释义/例句）端到端 |
| `test-fullscreen.js` | （需 `npm i jsdom`）全屏浮窗：进全屏改挂到全屏容器、自动切浮窗、退出还原；`<video>` 全屏的换容器补救 |
| `test-search-cc.js` | B 站 CC 扫描：走 `wbi/view` 端点、BV 大小写敏感、列表页判定、不再调老 `view` 端点（43 断言） |
| `test-popup-llm.js` | 弹窗大模型预设切换：切预设时 Base URL 与模型名一起更新并一起存盘——锁死"模型改了但网址还是 DeepSeek"的回归（需 `jsdom`，9 断言） |
| `test-rec-lang.js` | 跟读录音：字幕 `lan` 规范化为 Chrome 认得的 BCP-47（`zh-Hans`→`zh-CN`）、B站 实测 12 个 `lan` 全部落在支持列表内、识别/麦克风错误不再被吞（45 断言） |

```bash
# 语法检查
for f in content.js background.js popup.js vocab.js yt-main.js; do node --check "$f"; done

# 多数测试零依赖
node test-parse.js
node test-lemma.js
node test-translate.js
node test-autopause.js
node test-progressive-tr.js
node test-sticky-cue.js
node test-live-words.js
node test-search-cc.js
node test-translate-target.js
node test-pron-score.js
node test-rec-lang.js
# 端到端（可选依赖）
npm i jsdom && node test-translate-flow.js && node test-llm-dict.js && node test-fullscreen.js && node test-popup-llm.js
```

## 主要版本历程（节选）

- **v1.0.8** **修好「B站 录音不成功、YouTube 正常」。** 两个原因：① **字幕 `lan` 被原样塞给了 `SpeechRecognition.lang`**：B站 字幕 lan 的真实取值是 `zh-Hans` / `zh-Hant` / `ase` / `iw`（已用 `wbi/view` 真实响应确认），而 Chrome 只认 `zh-CN` / `zh-TW` 这类标准标签，收到 `zh-Hans` 会直接报 `language-not-supported`；YouTube 的轨道多为 `en` → `en-US`，恰好被旧的映射表覆盖，所以"那边正常"。现在会把语言标签规范化（别名 → 精确 → 首选地区 → 兜底），且遇到"语言不支持"会自动降级 `en-US` 重试一次。② **`sr.onerror = () => {}` 把所有错误都吞了**，失败时看起来就是"录音没反应"。现在错误会明确提示（`network` = 识别服务连不上、`not-allowed` = 未授权、`audio-capture` = 没抓到声音…），`getUserMedia` 失败也细分了（权限被拒 / 无设备 / 设备被占用）。
- **v1.0.7** **修好两处「设置 / 面板互相打架」的控制问题。** ① **自动暂停关不掉**：弹窗里的「自动暂停」复选框与面板上的「暂停」按钮此前写的是**同一个持久化键**，一旦在弹窗勾了全局默认，「开」就会持续压过面板的关闭动作，体感就是"面板不受控"。现改为分离：弹窗负责**新页面的起始状态**，面板按钮是**只影响当前页的临时覆盖**、不再回写全局——视频中途关掉就一直关着；诊断里会标注「（面板覆盖）」便于分辨当前是哪个在生效。② **选大模型预设时网址不跟着变**：模型选了别家、Base URL 还停在 DeepSeek。根因是预设下拉的 `change` 上挂了两个监听器——通用自动保存**先跑**（把**旧**的 base/model 存盘），`applyPreset` **后跑**（填入新值却不再保存），导致预设填好的网址从未持久化、重开弹窗又被旧值覆盖。现在改成一步原子操作：先填 Base URL 与模型名，**再**一起存盘。
- **v1.0.6** **CC 扫描彻底修好（两处致命 bug）。** ① 老 `x/web-interface/view` 端点现已被 B 站整体 412 风控、返回 HTML 挑战页而非 JSON，导致每条 `checkCc` 解析全挂；改用活端点 **`x/web-interface/wbi/view`**（带 wbi 签名）。② `extractBvid` 误把 BV 号 `.toUpperCase()`——但 **BV 号大小写敏感**，`BV1ujaZ68Ea5` 被改成 `BV1UJAZ68EA5` 后 B 站对 108 个里 105 个返回 `-404`。去掉大小写改写；面板现在会把失败原因透出（如 `失败 K（HTTP 412）` / `code -352`）。
- **v1.0.5** **CC 扫描此前基本失效**：给 view 加 wbi 签名 + 140ms 节流 + 并发降到 3，兼容 AI 字幕轨道结构，面板加实时进度与「重测」按钮。
- **v1.0.4** **翻译目标语言跟随母语**：跳过翻译的判定不再写死中文，只有"源已是所选目标语言"才跳过；按钮/标签改为动态拼接（不再中英文混杂）。另把 B 站首页 `?spm` 推荐流纳入 CC 扫描。
- **v1.0.2 – v1.0.3** **B 站列表页 CC 字幕扫描（新功能）**：在搜索 / 分类 / 空间页识别带官方 CC 字幕的视频，左侧浮层列出并标角标，点击直达。manifest 注入 `search.bilibili.com/*` 与 `space.bilibili.com/*`。
- **v1.0.1** **首个公开发布版（上架 Chrome Web Store / Edge Add-ons）。** 定名 LingoReel，配套商店素材（1280×800 截图 + 440×280 / 920×680 宣传图）。
- **更早 0.7.x 历程** —— 上架品牌化；「点一句读两句才停」自动暂停收紧 + 渐进式翻译；自动暂停真的会暂停（自愈重挂 + 独立时钟）；内联 🎤 跟读打分；全屏浮窗；大模型翻译引擎 + 接力兜底；AI 母语译文轨道；多源查词；站点分发 + YouTube 主世界桥接；窗口化/最小化浮窗；本地词典导入（GBK）；CORS 修复。

## 隐私

- 所有设置、生词、本地词典均存于浏览器本地，**不上传任何服务器**。
- 网络请求仅发生在：查词（dictionaryapi.dev / Wiktionary）、拉取视频字幕（B 站 / YouTube）、以及开启翻译时的整批字幕翻译（Google / MyMemory，或你自己在设置里填的大模型接口）。
- 大模型 API Key 只存在本机（`chrome.storage.local`），**不会**同步到浏览器账号，也不参与任何上传。
- 无统计、无追踪、无账号体系。

## 许可

本项目采用 [MIT 许可证](LICENSE) 开源。
