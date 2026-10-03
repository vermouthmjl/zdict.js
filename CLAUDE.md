# zdict.js

Chinese character data scraped from 汉典 (zdic.net), plus two small browser apps built on it. The main one is a character-learning game for young children: `js/learn-chars.js`, served by `index.html`. Upstream is yihui/zdict.js, published to npm as `@xiee/zdict`. Our work happens on a fork. See the deployment memory for remotes and Pages.

## Layout
- `js/zdict.js` exports `{ chars, freqs }`.
  - `js/data-chars.js` (~50k lines, never read it whole): `{ 字: { pinyin: [meaning, …] } }`. The meanings are adult dictionary text in which `～` stands for the character.
  - `js/data-freqs.js`: one string of ~7000 characters, ordered by frequency.
- `js/data-pinyin.js`: `{ 字: [pinyin, …] }`, used by `js/pinyin-finals.js` (a separate pinyin-finals app).
- `js/learn-chars.js`: the whole game in a single plain-JS module with no framework. Comments are in Chinese.
- `js/data-pictures.js`: character → emoji. It merges `js/data-svgs.js` (character → inline SVG, with small `svg/dot/rect/poly` helpers).
- `css/learn-chars.css`: game styles.
- `R/`, `data/`: the R scripts that scraped the data. Rarely touched.
- `build.sh`: CI-only. It rolls the modules up into `js/` and **deletes the source dirs**, so never run it locally.

## How learn-chars.js works
- Modes, chosen with radio buttons: 学习 (go through characters in order; seen characters are saved to localStorage `learned-chars`), 复习 (review learned characters as a grid), 测验 (go through the range in order), 挑战 (random draws plus a 95% CI estimate of how many characters the child knows).
- Answer types for 测验 and 挑战: 打字 (type pinyin into a contenteditable), 选拼音 (pick from 4 pinyin options) or 看图选 (pick from 4 pictures; only characters that have a picture are asked).
- Settings panel (the "密封线" box): a custom character list (localStorage `candidate-chars`), a start index and count within the frequency order, and an optional 韵母 filter.
- State lives in module variables: `mode`, `answer`, the position array `p`, and the challenge counters `nc`/`nw`. `speak()` uses browser speechSynthesis with zh-CN.
- Pictures show in 学习 and 复习 only, never in a quiz, because they would give away the answer.

## Commands
- `npm run dev`: serves the repo root at http://localhost:8000/.
- `npm test`: node:test with puppeteer driving `index.html` in headless Chrome (`test/game.test.mjs`) plus data checks (`test/data.test.mjs`). Local Node is 18, so puppeteer stays pinned at v23.

## Conventions
- Match the existing style: `var`, function declarations, short variable names, brief Chinese comments.
- Pictures: use emoji when a good one exists and SVG only for characters emoji can't show. See the picture-style memory for the SVG color rules.
- Check UI changes with headless-Chrome screenshots, including phone width (~400px), before reporting them as done.
- Commit and push only when the user asks.
