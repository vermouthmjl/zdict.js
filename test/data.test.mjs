import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, openPage } from './helpers.mjs';

describe('picture data', () => {
  let env, page;
  before(async () => { env = await setup(); page = await openPage(env); });
  after(() => env.close());

  const load = () => page.evaluate(async () => ({
    pics: (await import('/js/data-pictures.js')).default,
    chars: Object.keys((await import('/js/zdict.js')).default.chars)
  }));

  it('only uses characters from the dictionary', async () => {
    const { pics, chars } = await load();
    assert.deepEqual(Object.keys(pics).filter(c => chars.indexOf(c) < 0), []);
  });

  it('gives every character a different picture', async () => {
    const { pics } = await load();
    const seen = {};
    for (const c in pics) (seen[pics[c]] ||= []).push(c);
    assert.deepEqual(Object.values(seen).filter(v => v.length > 1), []);
  });

  it('has fill-in-the-blank cards with one blank, dictionary characters and no other picture', async () => {
    const { clozes, emoji, chars } = await page.evaluate(async () => {
      const svgs = (await import('/js/data-svgs.js')).default, pics = (await import('/js/data-pictures.js')).default;
      const clozes = (await import('/js/data-cloze.js')).default;
      // 去掉填空卡后剩下的就是 emoji 和 SVG
      return { clozes, emoji: Object.keys(pics).filter(c => !clozes[c]).concat(Object.keys(svgs)),
        chars: Object.keys((await import('/js/zdict.js')).default.chars) };
    });
    assert.ok(Object.keys(clozes).length > 100);
    for (const c in clozes) {
      const s = clozes[c], words = s.replace(/[_？！，]/g, '');
      assert.equal(s.split('_').length, 2, `${c}: ${s}`);
      assert.ok(words.length >= 2 && words.length <= 5, `${c}: ${s}`);
      assert.deepEqual([...words].filter(x => !chars.includes(x)), [], `${c}: ${s}`);
    }
    assert.deepEqual(Object.keys(clozes).filter(c => emoji.includes(c)), []);
  });

  it('has well-formed SVG drawings', async () => {
    const bad = await page.evaluate(async () => {
      const pics = (await import('/js/data-pictures.js')).default;
      return Object.keys(pics).filter(c => pics[c].startsWith('<svg')).filter(c => {
        const doc = new DOMParser().parseFromString(pics[c], 'image/svg+xml');
        return doc.querySelector('parsererror') || doc.documentElement.getAttribute('viewBox') !== '0 0 100 100';
      });
    });
    assert.deepEqual(bad, []);
  });
});
