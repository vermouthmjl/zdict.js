import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, openPage, choose, setRange, state, question, pick, next, labelsOf, topChars, blankOffsets, practice, practiceStep, storage, MODE, ANSWER } from './helpers.mjs';

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

  it('keeps the blank and its character on the line of the other characters', async () => {
    const page = await openPage(env);
    await page.setViewport({ width: 400, height: 900 });
    const near = (o, msg) => {
      for (const k of ['top', 'bottom', 'box']) if (o[k] !== null) assert.ok(Math.abs(o[k]) <= .6, `${msg} ${k} ${o[k]}`);
    };
    await setRange(page, '的');
    near(await blankOffsets(page, '.char-pic .cloze'), 'learn');
    await choose(page, MODE.quiz, ANSWER.picture);
    near(await blankOffsets(page, '.choice .cloze'), 'empty');
    await pick(page, true);
    near(await blankOffsets(page, '.choice.correct .cloze'), 'answered');
  });

  it('keeps the character in place when the pinyin appears', async () => {
    const page = await openPage(env);
    await choose(page, MODE.quiz, ANSWER.pinyin);
    const top = () => page.$eval('.char-box', e => e.getBoundingClientRect().top + scrollY);
    const before = await top();
    await pick(page, true);
    assert.ok(Math.abs(await top() - before) < 1);
  });

  describe('practice mode', () => {
    // 一直答到一轮结束，返回依次答过的字
    async function finish(page, wrong = () => false) {
      const asked = [];
      for (let i = 0; i < 300; i++) {
        const s = await practice(page);
        if (s.stage === 'end') return asked;
        const r = await practiceStep(page, !(s.stage === 'ask' && wrong(s.char, asked)));
        if (r.picked) asked.push(r.picked);
      }
      throw new Error('session did not end');
    }
    async function start(page, answer) {
      await choose(page, MODE.practice, answer);
      await setRange(page, '', 20);
    }

    it('asks 5 chars from the range straight away, without showing the picture first', async () => {
      const page = await openPage(env);
      await start(page);
      const top = await topChars(page, 5), s = await practice(page);
      assert.deepEqual(Object.keys(s.progress), [...top]);
      assert.deepEqual(Object.values(s.progress), [0, 0, 0, 0, 0]);
      assert.equal(s.stage, 'ask');
      assert.ok(top.includes(s.char));
      const st = await state(page);
      assert.equal(st.pinyin, '');
      assert.equal(st.choices.length, 4);
      assert.equal(await page.$eval('.char-block:not(.review) > .char-pic', e => e.innerHTML), '');
      assert.deepEqual(page.errors, []);
    });

    it('asks in random order', async () => {
      // 6 轮的第一题都相同的概率只有 (1/5)^5
      const firsts = new Set();
      for (let i = 0; i < 6; i++) {
        const page = await openPage(env);
        await start(page);
        firsts.add((await practice(page)).char);
      }
      assert.ok(firsts.size > 1, 'first question was always ' + [...firsts]);
    });

    it('passes a char only after 3 right answers, interleaved, then lists them at the end', async () => {
      const page = await openPage(env);
      await start(page);
      const top = [...await topChars(page, 5)], n = {};
      let prev = '';
      for (let i = 0; i < 100; i++) {
        const s = await practice(page);
        if (s.stage === 'end') break;
        if (s.stage === 'ask') {
          assert.equal(s.progress[s.char], n[s.char] || 0);
          const left = Object.entries(s.progress).filter(([c, k]) => k < 3).length;
          if (left > 1) assert.notEqual(s.char, prev, 'same char twice in a row');
          prev = s.char;
          n[s.char] = (n[s.char] || 0) + 1;
          assert.ok(n[s.char] <= 3, `${s.char} asked after it passed`);
          if (n[s.char] < 3) assert.ok(!(await storage(page, 'mastered-chars')).includes(s.char));
        }
        await practiceStep(page, true);
      }
      assert.deepEqual(Object.values(n), [3, 3, 3, 3, 3]);
      const s = await practice(page);
      assert.equal(s.stage, 'end');
      assert.deepEqual(s.ended, top);
      assert.match(await page.$eval('.practice-end', e => e.innerText), /今天学会了/);
      // 按学会的先后保存，顺序随机，所以只比较集合
      const sorted = async k => [...await storage(page, k)].sort();
      assert.deepEqual(await sorted('mastered-chars'), [...top].sort());
      assert.deepEqual(await sorted('learned-chars'), [...top].sort());
      // 结束页不自动开始下一轮，点字也不会换页
      await page.click('.char-block:not(.review) .char-box').catch(() => {});
      await page.$eval('.end-chars button', e => e.click());
      assert.equal((await practice(page)).stage, 'end');
      assert.deepEqual(page.errors, []);
    });

    it('keeps the count after a wrong answer', async () => {
      const page = await openPage(env);
      await start(page);
      const [x] = await topChars(page, 1);
      // 先把 x 答对一次，等它再出现时答错
      for (let i = 0; i < 60; i++) {
        const s = await practice(page);
        if (s.stage === 'ask' && s.char === x && s.progress[x] === 1) break;
        await practiceStep(page, true);
      }
      assert.equal((await practice(page)).char, x);
      await practiceStep(page, false);
      const s = await practice(page);
      assert.equal(s.stage, 'answered');
      assert.equal(s.progress[x], 1);
      const st = await state(page);
      assert.match(st.block, /wrong/);
      assert.equal(st.choices.filter(c => /correct/.test(c)).length, 1);
    });

    it('skips mastered chars in the next session', async () => {
      const page = await openPage(env);
      await start(page);
      await finish(page);
      await page.click('.practice-end .again');
      const top = await topChars(page, 10), s = await practice(page);
      assert.deepEqual(Object.keys(s.progress), [...top.slice(5)]);
      assert.equal(s.stage, 'ask');
    });

    it('uses the session size and pass count from the settings', async () => {
      const page = await openPage(env);
      await choose(page, MODE.practice);
      await page.evaluate(() => {
        const ns = document.querySelectorAll('#learn-settings input[type=number]');
        ns[2].value = 2; ns[3].value = 1;
      });
      await setRange(page, '', 20);
      assert.equal(Object.keys((await practice(page)).progress).length, 2);
      assert.equal((await finish(page)).length, 2);
    });

    it('offers no typing, and gives 打字 back when leaving', async () => {
      const page = await openPage(env);
      await choose(page, MODE.practice);
      const ans = () => page.evaluate(() => ({
        typeShown: getComputedStyle(document.querySelector('label[for=answer-0]')).display !== 'none',
        typeDisabled: document.querySelector('#answer-0').disabled,
        checked: document.querySelector('input[name=answer]:checked').id
      }));
      assert.deepEqual(await ans(), { typeShown: false, typeDisabled: true, checked: 'answer-1' });
      assert.equal((await state(page)).choices.length, 4);
      await choose(page, MODE.quiz);
      assert.deepEqual(await ans(), { typeShown: true, typeDisabled: false, checked: 'answer-0' });
      assert.deepEqual(page.errors, []);
    });

    it('practises only pictured chars with 看图选, never showing the picture beside the char', async () => {
      const page = await openPage(env);
      await choose(page, MODE.practice, ANSWER.picture);
      await setRange(page, '水人也');
      const s = await practice(page);
      assert.deepEqual(Object.keys(s.progress), ['人', '水']);
      assert.equal(await page.$eval('.char-block:not(.review) > .char-pic', e => e.innerHTML), '');
      await finish(page);
      // 复习里只显示学会的字，“也”没有图，不算
      await choose(page, MODE.review);
      const shown = await page.$$eval('.review', es => es.filter(e => getComputedStyle(e).display !== 'none').map(e => e.querySelector('.char').innerText));
      assert.deepEqual(shown, ['人', '水']);
      assert.deepEqual(page.errors, []);
    });
  });
});
