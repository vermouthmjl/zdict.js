import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

// 启动静态服务器和无头浏览器，测试页面为根目录下的 index.html
export async function setup() {
  const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (file.endsWith(path.sep)) file += 'index.html';
    if (!file.startsWith(root)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await puppeteer.launch();
  return {
    browser,
    url: `http://127.0.0.1:${server.address().port}/`,
    async close() { await browser.close(); server.close(); }
  };
}

// 每个测试用全新的浏览器上下文，免得 localStorage 里存的字库互相影响
export async function openPage(env) {
  const ctx = await env.browser.createBrowserContext();
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.goto(env.url, { waitUntil: 'networkidle0' });
  return page;
}

export const MODE = { learn: 0, review: 1, quiz: 2, challenge: 3 };
export const ANSWER = { type: 0, pinyin: 1, picture: 2 };

export async function choose(page, mode, answer) {
  await page.click(`label[for=mode-${mode}]`);
  if (answer !== undefined) await page.click(`label[for=answer-${answer}]`);
}

// 在设置区填入字库和选取字数，然后点“确定”
export function setRange(page, text, count = 20) {
  return page.evaluate((text, count) => {
    document.querySelector('#learn-candidates').value = text;
    document.querySelectorAll('#learn-settings input[type=number]')[1].value = count;
    document.querySelector('#learn-set').click();
  }, text, count);
}

export function state(page) {
  return page.evaluate(() => {
    const cb = document.querySelector('.char-block:not(.review)');
    return {
      char: cb.querySelector('.char').innerText,
      pinyin: cb.querySelector('.pinyin').innerText,
      block: cb.className,
      choices: [...document.querySelectorAll('.choice')].map(e => e.className),
      source: document.querySelector('.source').innerText,
      answerShown: getComputedStyle(document.querySelector('#learn-answer')).display !== 'none'
    };
  });
}

// 当前选择题的信息：每个选项对应的标签，以及正确答案；SVG 经浏览器序列化后再比较
export function question(page) {
  return page.evaluate(async () => {
    const pics = (await import('/js/data-pictures.js')).default;
    const t = document.createElement('div'), norm = h => (t.innerHTML = h, t.innerHTML);
    const cards = [...document.querySelectorAll('.choice')], pic = cards.some(e => e.classList.contains('pic'));
    const char = document.querySelector('.char-block:not(.review) .char').innerText;
    const label = e => pic ? e.innerHTML : e.innerText;
    const right = pic ? norm(pics[char]) : document.querySelector('.char-block:not(.review) .pinyin').dataset.pinyin;
    return { char, pic, options: cards.map(label), right };
  });
}

export async function pick(page, correct) {
  const q = await question(page);
  const i = q.options.findIndex(o => (o === q.right) === correct);
  await page.evaluate(i => document.querySelectorAll('.choice')[i].click(), i);
  return q;
}

export function next(page) {
  return page.$eval('.next', e => e.click());
}

// 一组字对应的选项标签（拼音或图）；看图选时只算有图的字
export function labelsOf(page, chars, pic) {
  return page.evaluate(async (chars, pic) => {
    const pics = (await import('/js/data-pictures.js')).default, zd = (await import('/js/zdict.js')).default;
    const t = document.createElement('div');
    return [...chars].filter(c => !pic || pics[c])
      .map(c => pic ? (t.innerHTML = pics[c], t.innerHTML) : Object.keys(zd.chars[c]).join(' - '));
  }, chars, pic);
}

export function topChars(page, n) {
  return page.evaluate(async n => (await import('/js/data-freqs.js')).default.slice(0, n), n);
}

// 填空卡里空格（及填进去的字）和旁边那个字的对齐情况：字的上下边、空框中线各差多少像素
export function blankOffsets(page, sel) {
  return page.evaluate(sel => {
    const b = document.querySelector(sel + ' .blank'), t = b.previousSibling || b.nextSibling;
    const g = document.createRange(), i = t === b.previousSibling ? t.length - 1 : 0;
    g.setStart(t, i); g.setEnd(t, i + 1);
    const n = g.getBoundingClientRect(), box = b.getBoundingClientRect(), mid = r => (r.top + r.bottom) / 2;
    let a = null;
    if (b.firstChild) { const h = document.createRange(); h.selectNodeContents(b); a = h.getBoundingClientRect(); }
    return { top: a && a.top - n.top, bottom: a && a.bottom - n.bottom, box: mid(box) - mid(n) };
  }, sel);
}
