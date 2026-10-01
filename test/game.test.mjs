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
    const ans = await page.$eval('.char-block .pinyin', e => e.dataset.pinyin);
    await page.click('.char-block .pinyin');
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

  it('keeps the character in place when the pinyin appears', async () => {
    const page = await openPage(env);
    await choose(page, MODE.quiz, ANSWER.pinyin);
    const top = () => page.$eval('.char-box', e => e.getBoundingClientRect().top + scrollY);
    const before = await top();
    await pick(page, true);
    assert.ok(Math.abs(await top() - before) < 1);
  });
});
