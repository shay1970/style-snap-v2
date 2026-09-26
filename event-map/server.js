// מפת אירועים — standalone server. No framework: node:http + static files.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { SOURCES, getNews, fetchArticle } from './lib/news.js';
import { getManyStats } from './lib/prices.js';
import { analyzeEvent, AnalysisError } from './lib/claude.js';
import * as store from './lib/store.js';

const PORT = +process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const PASSWORD = process.env.APP_PASSWORD || '';
const PUBLIC = path.join(path.dirname(new URL(import.meta.url).pathname), 'public');
const MAX_BODY = 10 * 1024 * 1024;
const IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MODES = new Set(['real', 'pre', 'imaginary']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const ERR_HE = {
  rate_limited: 'יותר מדי בקשות ל-Claude — נסה שוב בעוד כמה דקות.',
  refused: 'Claude סירב לבקשה — נסח את האירוע אחרת.',
  invalid_json: 'התשובה לא הגיעה בפורמט תקין — נסה שוב.',
  auth: 'מפתח ה-API של Anthropic לא תקין או חסר (ANTHROPIC_API_KEY).',
  bad_request: 'הבקשה נדחתה (ייתכן שהתמונה או הטקסט גדולים מדי).',
  upstream_error: 'תקלה זמנית — נסה שוב.',
};

function send(res, status, body, headers = {}) {
  const isStr = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, { 'content-type': isStr ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(isStr ? body : JSON.stringify(body));
}

function authorized(req) {
  if (!PASSWORD) return true;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const pass = Buffer.from(m[1], 'base64').toString().split(':').slice(1).join(':');
  const a = Buffer.from(pass), b = Buffer.from(PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Reject cross-site writes: a page on another origin must not be able to
// spend the API key by POSTing here.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error('גוף הבקשה גדול מדי'), { status: 413 });
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('JSON לא תקין'), { status: 400 }); }
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, 'Not found');
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch { send(res, 404, 'Not found'); }
}

const strip = c => ({
  ticker: String(c.ticker || '').toUpperCase(), name: c.name || '', dir: c.dir === 'down' ? 'down' : 'up',
  order: c.order || null, exposure: c.exposure ?? null, exposure_basis: c.exposure_basis || '',
  mechanism: c.mechanism || c.why || '', px: c.px || null, err: c.err || null,
});

async function analyze(req, res) {
  const body = await readJson(req);
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 20000) : '';
  const mode = MODES.has(body.mode) ? body.mode : 'real';
  let image = null;
  if (body.image?.data) {
    if (!IMG_TYPES.has(body.image.mediaType)) return send(res, 400, { error: 'סוג תמונה לא נתמך' });
    image = { data: String(body.image.data), mediaType: body.image.mediaType };
  }
  if (!text && !image) return send(res, 400, { error: 'כתוב אירוע או צרף צילום מסך.' });
  const verify = body.verify !== false && mode === 'real';
  const sourceUrl = typeof body.sourceUrl === 'string' && /^https?:\/\//.test(body.sourceUrl) ? body.sourceUrl.slice(0, 500) : null;

  // Progress is streamed as NDJSON so the page can show a live log.
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
  const emit = o => { if (!res.writableEnded) res.write(JSON.stringify(o) + '\n'); };

  try {
    emit({ type: 'log', msg: verify ? '① Claude: אימות מול אתרי חדשות, תיוג ובחירת מועמדים…' : '① Claude: תיוג ובחירת מועמדים…' });
    const s1 = await analyzeEvent({ text: text || '(ראה תמונה)', mode, image, verify, sourceUrl, signal: ctl.signal });
    emit({ type: 'log', msg: `   תיוג: ${s1.label} · אימות: ${s1.verification?.status} · ${s1.candidates.length} מועמדים · ${s1.indices?.length || 0} מדדים` });

    const cands = s1.candidates.slice(0, 15).map(strip).filter(c => c.ticker);
    const idx = (s1.indices || []).slice(0, 7).map(strip).filter(c => c.ticker);
    emit({ type: 'log', msg: '② מחירים: שנה של נרות יומיים לכל טיקר…' });
    const stats = await getManyStats([...cands, ...idx].map(c => c.ticker));
    let priced = 0;
    [...cands, ...idx].forEach((c, i) => { c.px = stats[i].px; if (c.px) priced++; else c.err = stats[i].error; if (!c.name && stats[i].name) c.name = stats[i].name; });
    emit({ type: 'log', msg: `   נמצאו מחירים ל-${priced}/${cands.length + idx.length}` });
    if (ctl.signal.aborted) return;

    const ranked = cands.map(c => ({ ...c, _s: Number(c.exposure) || 1 }))
      .sort((a, b) => b._s - a._s || (a.order || 9) - (b.order || 9)).map(({ _s, ...c }) => c);
    const { candidates, indices, ...meta } = s1;
    const doc = {
      createdAt: new Date().toISOString(), mode, event: text.slice(0, 4000), sourceUrl, hadImage: !!image,
      s1: meta, stocks: ranked.slice(0, 10), dropped: ranked.slice(10), indices: idx,
      priceNote: priced ? null : 'לא התקבלו נתוני מחיר (Yahoo/Stooq לא זמינים מהשרת).', outcome: '',
    };
    if (mode !== 'imaginary') {
      const row = await store.add(doc);
      doc.id = row.id;
      emit({ type: 'log', msg: '③ נשמר ביומן.' });
    } else emit({ type: 'log', msg: '③ דמיוני — לא נשמר ביומן.' });
    emit({ type: 'result', doc });
  } catch (e) {
    if (e?.code === 'cancelled' || ctl.signal.aborted) return;
    console.error('[analyze]', e);
    emit({ type: 'error', code: e?.code || 'upstream_error', error: (e instanceof AnalysisError && ERR_HE[e.code]) || ERR_HE.upstream_error, detail: e?.message });
  } finally {
    if (!res.writableEnded) res.end();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  if (!authorized(req)) return send(res, 401, 'Authentication required', { 'www-authenticate': 'Basic realm="event-map"' });
  try {
    if (!p.startsWith('/api/')) return req.method === 'GET' ? serveStatic(req, res, p) : send(res, 405, 'Method not allowed');
    if (req.method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'Forbidden' });

    if (p === '/api/sources' && req.method === 'GET') return send(res, 200, SOURCES.map(({ id, name, lang }) => ({ id, name, lang })));
    if (p === '/api/news' && req.method === 'GET') {
      const sources = (url.searchParams.get('sources') || '').split(',').filter(Boolean);
      return send(res, 200, await getNews({ sources, q: url.searchParams.get('q') || '' }));
    }
    if (p === '/api/article' && req.method === 'POST') {
      const { url: target } = await readJson(req);
      if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) return send(res, 400, { error: 'כתובת לא תקינה' });
      try { return send(res, 200, await fetchArticle(target)); }
      catch (e) { return send(res, 502, { error: 'לא הצלחתי לקרוא את הכתבה: ' + (e.message || e) }); }
    }
    if (p === '/api/prices' && req.method === 'GET') {
      const t = (url.searchParams.get('tickers') || '').split(',').filter(Boolean).slice(0, 25);
      return send(res, 200, await getManyStats(t));
    }
    if (p === '/api/analyze' && req.method === 'POST') return await analyze(req, res);
    if (p === '/api/analyses' && req.method === 'GET') return send(res, 200, await store.list());
    const m = /^\/api\/analyses\/([\w-]+)$/.exec(p);
    if (m && req.method === 'PATCH') {
      const { outcome } = await readJson(req);
      const row = await store.setOutcome(m[1], outcome);
      return row ? send(res, 200, row) : send(res, 404, { error: 'לא נמצא' });
    }
    if (m && req.method === 'DELETE') return (await store.remove(m[1])) ? send(res, 204, '') : send(res, 404, { error: 'לא נמצא' });
    if (p === '/api/health') return send(res, 200, { ok: true, claude: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) });
    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'שגיאת שרת' });
    if (!e.status) console.error(e);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`מפת אירועים: http://${HOST}:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) console.warn('⚠ ANTHROPIC_API_KEY לא מוגדר — הניתוח לא יעבוד.');
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !PASSWORD) console.warn('⚠ השרת חשוף לרשת בלי APP_PASSWORD — כל מי שמגיע אליו יכול להוציא את קרדיט ה-API שלך.');
});
