// External news: RSS/Atom feeds from sources.json, plus full-article extraction
// from a news URL the user pastes or picks from a feed.
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { getText } from './http.js';

export const SOURCES = JSON.parse(readFileSync(process.env.SOURCES_FILE || new URL('../sources.json', import.meta.url), 'utf8'));

const FEED_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // id -> {at, items, error}

const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text',
  processEntities: true, htmlEntities: true, trimValues: true,
});

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
export function stripHtml(s) {
  return decodeEntities(String(s ?? '')
    .replace(/<(script|style|noscript|svg|figure|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

const txt = v => v == null ? '' : typeof v === 'object' ? (v['#text'] ?? '') : String(v);
const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];

export function parseFeed(xml, source) {
  const doc = parser.parse(xml);
  const out = [];
  if (doc.rss?.channel) {
    for (const it of arr(doc.rss.channel.item)) {
      let title = stripHtml(txt(it.title));
      const publisher = txt(it.source) || '';
      // Google News appends " - Publisher" to every title
      if (publisher && title.endsWith(' - ' + publisher)) title = title.slice(0, -(publisher.length + 3));
      out.push({
        title, link: txt(it.link) || txt(it.guid),
        date: toIso(txt(it.pubDate) || txt(it['dc:date'])),
        summary: stripHtml(txt(it.description)).slice(0, 400),
        publisher: publisher || source.name,
      });
    }
  } else if (doc.feed) {
    for (const it of arr(doc.feed.entry)) {
      const links = arr(it.link);
      const link = (links.find(l => l['@rel'] === 'alternate') || links[0])?.['@href'] || txt(it.id);
      out.push({
        title: stripHtml(txt(it.title)), link,
        date: toIso(txt(it.updated) || txt(it.published)),
        summary: stripHtml(txt(it.summary) || txt(it.content)).slice(0, 400),
        publisher: source.name,
      });
    }
  } else {
    throw new Error('פורמט פיד לא מוכר');
  }
  return out.filter(i => i.title && /^https?:/i.test(i.link))
    .map(i => ({ ...i, sourceId: source.id, source: source.name, lang: source.lang }));
}

function toIso(s) {
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString();
}

async function loadSource(src) {
  const hit = cache.get(src.id);
  if (hit && Date.now() - hit.at < FEED_TTL_MS) return hit;
  try {
    const { text } = await getText(src.url, { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' });
    const entry = { at: Date.now(), items: parseFeed(text, src), error: null };
    cache.set(src.id, entry);
    return entry;
  } catch (e) {
    // keep serving stale items if we have them
    const entry = { at: Date.now() - FEED_TTL_MS + 60_000, items: hit?.items || [], error: e.message || String(e) };
    cache.set(src.id, entry);
    return entry;
  }
}

export async function getNews({ sources, q, limit = 80 } = {}) {
  const wanted = sources?.length ? SOURCES.filter(s => sources.includes(s.id)) : SOURCES;
  const results = await Promise.all(wanted.map(async s => [s, await loadSource(s)]));
  const errors = results.filter(([, r]) => r.error).map(([s, r]) => ({ source: s.name, error: r.error }));
  let items = results.flatMap(([, r]) => r.items);
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    items = items.filter(i => { const h = (i.title + ' ' + i.summary).toLowerCase(); return terms.every(t => h.includes(t)); });
  }
  const seen = new Set();
  items = items.filter(i => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { items: items.slice(0, limit), errors };
}

// ---------- article extraction ----------
function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  return tag ? decodeEntities(/content=["']([^"']*)["']/i.exec(tag)?.[1] || '') : '';
}

function jsonLdBody(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const stack = [JSON.parse(m[1])];
      while (stack.length) {
        const n = stack.pop();
        if (Array.isArray(n)) { stack.push(...n); continue; }
        if (n && typeof n === 'object') {
          if (typeof n.articleBody === 'string' && n.articleBody.length > 200) return n.articleBody;
          if (n['@graph']) stack.push(n['@graph']);
        }
      }
    } catch { /* malformed JSON-LD is common */ }
  }
  return '';
}

export function extractArticle(html) {
  const title = meta(html, 'og:title') || stripHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '');
  const published = meta(html, 'article:published_time') || meta(html, 'pubdate') || null;
  const siteName = meta(html, 'og:site_name');
  let body = stripHtml(jsonLdBody(html));
  if (body.length < 200) {
    const scope = /<article[\s\S]*?<\/article>/i.exec(html)?.[0] || html;
    body = [...scope.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)]
      .map(m => stripHtml(m[0])).filter(p => p.length > 40).join('\n\n');
  }
  if (body.length < 200) body = meta(html, 'og:description') || meta(html, 'description') || body;
  return { title, siteName, published, text: body.slice(0, 20000) };
}

export async function fetchArticle(url) {
  const { text, finalUrl } = await getText(url, { untrusted: true, accept: 'text/html,application/xhtml+xml' });
  return { url: finalUrl, ...extractArticle(text) };
}
