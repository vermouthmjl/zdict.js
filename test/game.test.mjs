import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, openPage, choose, setRange, state, question, pick, next, labelsOf, topChars, MODE, ANSWER } from './helpers.mjs';

describe('learn-chars game', () => {
  let env;
  before(async () => { env = await setup(); });
  after(() => env.close());

  it('loads without errors and shows the answer toggle only in quiz modes', async () => {
    const page = await openPage(env);
    assert.equal((await state(page)).answerShown, false);
    for (const m of [MODE.quiz, MODE.challenge]) {
      await choose(page, m);
      assert.equal((await state(page)).answerShown, true);
    }
    await choose(page, MODE.review);
    assert.equal((await state(page)).answerShown, false);
    assert.deepEqual(page.errors, []);
  });

  it('marks a right picture answer green', async () => {
    const page = await openPage(env);
    await choose(page, MODE.quiz, ANSWER.picture);
    const q = await pick(page, true);
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok(q.options.includes(q.right));
    const s = await state(page);
    assert.match(s.block, /correct/);
    assert.equal(s.choices.filter(c => /correct/.test(c)).length, 1);
    assert.ok(await page.$('.next'));
    assert.deepEqual(page.errors, []);
  });

  it('marks a wrong pinyin answer red and shows what was picked', async () => {
    const page = await openPage(env);
    await choose(page, MODE.quiz, ANSWER.pinyin);
    const q = await pick(page, false);
    const s = await state(page);
    assert.match(s.block, /wrong/);
    assert.equal(s.choices.filter(c => /wrong/.test(c)).length, 1);
    assert.equal(s.choices.filter(c => /correct/.test(c)).length, 1);
    assert.match(s.pinyin, new RegExp(`-> ${q.right}$`));
  });

  it('grades typed pinyin, even after pressing the 打字 toggle', async () => {
    const page = await openPage(env);
    await choose(page, MODE.quiz, ANSWER.type);
    const ans = await page.$eval('.char-block:not(.review) .pinyin', e => e.dataset.pinyin);
    await page.click('.char-block:not(.review) .pinyin');
    await page.keyboard.type(ans.split(' - ')[0]);
    await page.keyboard.press('Enter');
    const s = await state(page);
    assert.match(s.block, /correct/);
    assert.equal(s.choices.length, 0);
  });

  for (const [name, mode, answer] of [
    ['quiz / pinyin', MODE.quiz, ANSWER.pinyin], ['quiz / picture', MODE.quiz, ANSWER.picture],
    ['challenge / pinyin', MODE.challenge, ANSWER.pinyin], ['challenge / picture', MODE.challenge, ANSWER.picture]
  ]) {
    it(`draws wrong answers from the selected range (${name})`, async () => {
      const page = await openPage(env);
      await setRange(page, '', 500);
      await choose(page, mode, answer);
      const allowed = new Set(await labelsOf(page, await topChars(page, 500), answer === ANSWER.picture));
      for (let i = 0; i < 15; i++) {
        const q = await pick(page, false);
        const outside = q.options.filter(o => o !== q.right && !allowed.has(o));
        assert.deepEqual(outside, [], `question ${q.char}`);
        await next(page);
      }
    });
  }

  it('tops up the choices when the range is too small', async () => {
    const page = await openPage(env);
    await setRange(page, '一二三');
    await choose(page, MODE.quiz, ANSWER.pinyin);
    const allowed = await labelsOf(page, '一二三', false);
    const q = await question(page);
    assert.equal(q.options.length, 4);
    assert.equal(q.options.filter(o => allowed.includes(o)).length, 3);
  });

  it('asks challenge questions only from the range, then says it is done', async () => {
    const page = await openPage(env);
    await choose(page, MODE.challenge, ANSWER.pinyin);
    await setRange(page, '火水木山');
    const asked = [];
    for (let i = 0; i < 4; i++) {
      asked.push((await pick(page, true)).char);
      await next(page);
    }
    assert.deepEqual(asked.sort(), [...'山木水火'].sort());
    const s = await state(page);
    assert.match(s.pinyin, /挑战完了/);
    assert.match(s.source, /已挑战 4 字（错 0 字）/);
    assert.match(s.source, /所选 4 字中，您认识的字估计为 4/);
  });

  it('shows a question from the new range right after confirming it', async () => {
    const page = await openPage(env);
    await choose(page, MODE.quiz, ANSWER.picture);
    await setRange(page, '火水木山');
    assert.equal((await state(page)).char, '水');
  });

  it('shows the picture in learn and review modes but not in quizzes', async () => {
    const page = await openPage(env);
    const pic = () => page.$eval('.char-block:not(.review) > .char-pic', e => ({ html: e.innerHTML, text: e.innerText, shown: getComputedStyle(e).display !== 'none' }));
    await setRange(page, '雨人也');
    // 按字频排序后依次为 人、也、雨；“也”没有图
    assert.equal((await state(page)).char, '人');
    assert.ok((await pic()).shown);
    await page.click('.char-block:not(.review) .char-box');
    assert.equal((await state(page)).char, '也');
    assert.equal((await pic()).shown, false);
    await page.click('.char-block:not(.review) .char-box');
    assert.equal((await pic()).html, '🌧️');
    await choose(page, MODE.review);
    const seen = {};
    for (let i = 0; i < 3; i++) {
      seen[(await state(page)).char] = (await pic()).shown;
      await page.click('.char-block:not(.review) .char-box');
    }
    assert.deepEqual(seen, { '人': true, '也': false, '雨': true });
    assert.equal(await page.$$eval('.review .char-pic', es => es.filter(e => getComputedStyle(e).display !== 'none').length), 0);
    for (const answer of [ANSWER.type, ANSWER.pinyin, ANSWER.picture]) {
      await choose(page, MODE.quiz, answer);
      assert.equal((await pic()).shown, false);
    }
    assert.deepEqual(page.errors, []);
  });

  it('shows fill-in-the-blank cards filled in when learning', async () => {
    const page = await openPage(env);
    await setRange(page, '的');
    const p = await page.$eval('.char-block:not(.review) > .char-pic', e => ({
      text: e.innerText, blank: e.querySelector('.cloze .blank').innerText
    }));
    assert.equal(p.text, '红红的苹果');
    assert.equal(p.blank, '的');
  });

  it('asks fill-in-the-blank cards in 看图选, with only other cards as wrong answers', async () => {
    const page = await openPage(env);
    await setRange(page, '', 20);
    await choose(page, MODE.quiz, ANSWER.picture);
    const asked = [];
    for (let i = 0; i < 25; i++) {
      const q = await page.evaluate(async () => {
        const cl = (await import('/js/data-cloze.js')).default;
        const char = document.querySelector('.char-block:not(.review) .char').innerText;
        return { char, cloze: !!cl[char], cards: [...document.querySelectorAll('.choice')].map(e => !!e.querySelector('.cloze')) };
      });
      if (!q.char || asked.includes(q.char)) break;
      asked.push(q.char);
      assert.equal(q.cards.length, 4);
      assert.deepEqual(q.cards, [q.cloze, q.cloze, q.cloze, q.cloze], `question ${q.char}`);
      await pick(page, true);
      // 答对后正确的卡片填上了字
      if (q.cloze) assert.equal(await page.$eval('.choice.correct .blank', e => e.innerText), q.char);
      await next(page);
    }
    const top = await topChars(page, 20), cl = await page.evaluate(async () => Object.keys((await import('/js/data-cloze.js')).default));
    assert.ok(asked.filter(c => cl.includes(c)).length >= 8, asked.join(''));
    assert.deepEqual(asked.filter(c => !top.includes(c)), []);
    assert.deepEqual(page.errors, []);
  });

  it('keeps the character in place when the pinyin appears', async () => {
    const page = await openPage(env);
    await choose(page, MODE.quiz, ANSWER.pinyin);
    const top = () => page.$eval('.char-box', e => e.getBoundingClientRect().top + scrollY);
    const before = await top();
    await pick(page, true);
    assert.ok(Math.abs(await top() - before) < 1);
  });
});
