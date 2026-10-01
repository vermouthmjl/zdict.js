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
