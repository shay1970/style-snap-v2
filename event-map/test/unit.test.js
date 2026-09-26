import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, extractArticle } from '../lib/news.js';
import { priceStats } from '../lib/prices.js';
import { extractJson } from '../lib/claude.js';
import { getText } from '../lib/http.js';

const src = { id: 'x', name: 'Test', lang: 'en' };

test('parses RSS 2.0 and strips the Google News publisher suffix', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
    <item><title>China blockades Taiwan - Reuters</title><link>https://news.google.com/a</link>
      <pubDate>Fri, 25 Sep 2026 10:00:00 GMT</pubDate><description>&lt;a href="x"&gt;China&lt;/a&gt; &amp;amp; ships</description>
      <source url="https://reuters.com">Reuters</source></item>
    <item><title>Second</title><link>https://example.com/2</link></item>
    <item><title>No link</title></item>
  </channel></rss>`;
  const items = parseFeed(xml, src);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'China blockades Taiwan');
  assert.equal(items[0].publisher, 'Reuters');
  assert.equal(items[0].date, '2026-09-25T10:00:00.000Z');
  assert.match(items[0].summary, /China & ships/);
  assert.equal(items[1].publisher, 'Test');
});

test('parses Atom', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Oil jumps</title>
    <link rel="alternate" href="https://example.com/oil"/><updated>2026-09-25T08:00:00Z</updated>
    <summary>Brent up 5%</summary></entry></feed>`;
  const [it] = parseFeed(xml, src);
  assert.equal(it.link, 'https://example.com/oil');
  assert.equal(it.summary, 'Brent up 5%');
});

test('extracts article text from JSON-LD, falling back to <p> tags', () => {
  const body = 'A'.repeat(250);
  const ld = `<html><head><meta property="og:title" content="Headline &amp; more"><script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","articleBody":"${body}"}]}</script></head><body></body></html>`;
  const a = extractArticle(ld);
  assert.equal(a.title, 'Headline & more');
  assert.equal(a.text, body);
  const p = `<html><title>T</title><article><p>short</p><p>${'word '.repeat(30)}</p><p>${'more '.repeat(30)}</p><script>x()</script></article></html>`;
  const b = extractArticle(p);
  assert.equal(b.title, 'T');
  assert.ok(!b.text.includes('short') && b.text.includes('word') && b.text.includes('more'));
});

test('priceStats computes gap sigma, 1M change and last-gap z', () => {
  const bars = [];
  for (let i = 0; i < 60; i++) bars.push({ date: `d${i}`, open: 100 + (i % 2 ? 1 : -1), close: 100 });
  bars.push({ date: 'last', open: 110, close: 110 });
  const s = priceStats(bars);
  assert.equal(s.last, 110);
  assert.ok(Math.abs(s.sigma - 0.01) < 1e-4);
  assert.ok(Math.abs(s.z - 10) < 0.05);
  assert.ok(Math.abs(s.m1 - 0.1) < 1e-9);
  assert.equal(priceStats(bars.slice(0, 10)), null);
});

test('extractJson handles fences and surrounding prose', () => {
  assert.deepEqual(extractJson('Here:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('prefix {"b":{"c":2}} suffix'), { b: { c: 2 } });
  assert.equal(extractJson('nothing'), null);
});

test('untrusted fetch refuses internal addresses', async () => {
  for (const u of ['http://127.0.0.1:1/', 'http://localhost/', 'http://[::1]/', 'http://169.254.169.254/latest', 'file:///etc/passwd']) {
    await assert.rejects(getText(u, { untrusted: true }), undefined, u);
  }
});
