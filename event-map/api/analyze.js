// Full pipeline for one event: Claude (verify + label + candidates) → prices.
// Progress is streamed as NDJSON lines so the page can show a live log.
import { send, guard, handle, readJson } from '../lib/api.js';
import { analyzeEvent, AnalysisError } from '../lib/claude.js';
import { getManyStats } from '../lib/prices.js';

const IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_B64 = 7 * 1024 * 1024; // ~5MB decoded
const MODES = new Set(['real', 'pre', 'imaginary']);
const LIMIT = parseInt(process.env.ANALYZE_LIMIT_PER_HOUR || '20', 10);

const ERR_HE = {
  rate_limited: 'יותר מדי בקשות ל-Claude — נסה שוב בעוד כמה דקות.',
  refused: 'Claude סירב לבקשה — נסח את האירוע אחרת.',
  invalid_json: 'התשובה לא הגיעה בפורמט תקין — נסה שוב.',
  auth: 'מפתח ה-API של Anthropic לא תקין או חסר (ANTHROPIC_API_KEY).',
  bad_request: 'הבקשה נדחתה (ייתכן שהתמונה או הטקסט גדולים מדי).',
  upstream_error: 'תקלה זמנית — נסה שוב.',
};

const strip = c => ({
  ticker: String(c.ticker || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 12),
  name: String(c.name || ''), dir: c.dir === 'down' ? 'down' : 'up',
  order: c.order || null, exposure: c.exposure ?? null, exposure_basis: c.exposure_basis || '',
  mechanism: c.mechanism || c.why || '', px: null, err: null,
});

export default handle(async (req, res) => {
  if (!guard(req, res, { methods: ['POST'], limit: { key: 'analyze', max: LIMIT, windowMs: 3600_000 } })) return;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return send(res, 503, { error: ERR_HE.auth });

  const body = await readJson(req);
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 20000) : '';
  const mode = MODES.has(body.mode) ? body.mode : 'real';
  let image = null;
  if (body.image?.data) {
    if (!IMG_TYPES.has(body.image.mediaType)) return send(res, 400, { error: 'סוג תמונה לא נתמך' });
    if (String(body.image.data).length > MAX_IMAGE_B64) return send(res, 413, { error: 'התמונה גדולה מדי' });
    image = { data: String(body.image.data), mediaType: body.image.mediaType };
  }
  if (!text && !image) return send(res, 400, { error: 'כתוב אירוע או צרף צילום מסך.' });
  const verify = body.verify !== false && mode === 'real';
  const sourceUrl = typeof body.sourceUrl === 'string' && /^https?:\/\/\S+$/.test(body.sourceUrl) ? body.sourceUrl.slice(0, 500) : null;

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
    const all = [...cands, ...idx];
    const stats = await getManyStats(all.map(c => c.ticker));
    let priced = 0;
    all.forEach((c, i) => { c.px = stats[i].px; if (c.px) priced++; else c.err = stats[i].error; if (!c.name && stats[i].name) c.name = stats[i].name; });
    emit({ type: 'log', msg: `   נמצאו מחירים ל-${priced}/${all.length}` });
    if (ctl.signal.aborted) return;

    const ranked = [...cands].sort((a, b) => (Number(b.exposure) || 1) - (Number(a.exposure) || 1) || (a.order || 9) - (b.order || 9));
    const { candidates, indices, ...meta } = s1;
    emit({ type: 'result', doc: {
      createdAt: new Date().toISOString(), mode, event: text.slice(0, 4000), sourceUrl, hadImage: !!image,
      s1: meta, stocks: ranked.slice(0, 10), dropped: ranked.slice(10), indices: idx,
      priceNote: priced ? null : 'לא התקבלו נתוני מחיר (Yahoo/Stooq לא זמינים מהשרת).', outcome: '',
    } });
  } catch (e) {
    if (e?.code === 'cancelled' || ctl.signal.aborted) return;
    console.error('[analyze]', e);
    emit({ type: 'error', code: e?.code || 'upstream_error', error: (e instanceof AnalysisError && ERR_HE[e.code]) || ERR_HE.upstream_error, detail: e?.message });
  } finally {
    if (!res.writableEnded) res.end();
  }
});
