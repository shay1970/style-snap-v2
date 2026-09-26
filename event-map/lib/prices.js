// One year of daily bars per ticker (Yahoo Finance chart API, Stooq CSV as a
// fallback), reduced to: last close, 1M change, σ of overnight gaps, 2σ, last gap z.
import { getJson, getText } from './http.js';

const TTL_MS = 10 * 60 * 1000;
const cache = new Map();

async function yahoo(t) {
  const j = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1y&interval=1d&includePrePost=false`);
  const r = j?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r || !q) throw new Error(j?.chart?.error?.description || 'אין נתונים');
  const bars = [];
  r.timestamp.forEach((ts, i) => {
    if (q.open[i] != null && q.close[i] != null) bars.push({ date: new Date(ts * 1000).toISOString().slice(0, 10), open: q.open[i], close: q.close[i] });
  });
  return { bars, name: r.meta?.longName || r.meta?.shortName || '', currency: r.meta?.currency };
}

async function stooq(t) {
  const { text } = await getText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(t.toLowerCase())}.us&i=d`);
  const lines = text.trim().split('\n').slice(1);
  if (!lines.length || !/^\d{4}-/.test(lines[0])) throw new Error('אין נתונים');
  const bars = lines.slice(-260).map(l => { const [date, open, , , close] = l.split(','); return { date, open: +open, close: +close }; })
    .filter(b => b.open > 0 && b.close > 0);
  return { bars, name: '' };
}

export function priceStats(bars) {
  if (!Array.isArray(bars) || bars.length < 30) return null;
  const n = bars.length, gaps = [];
  for (let i = Math.max(1, n - 250); i < n; i++) gaps.push(bars[i].open / bars[i - 1].close - 1);
  const prior = gaps.slice(0, -1);
  const m = prior.reduce((a, b) => a + b, 0) / prior.length;
  const sd = Math.sqrt(prior.reduce((a, b) => a + (b - m) ** 2, 0) / prior.length);
  const lastGap = gaps[gaps.length - 1];
  return {
    last: bars[n - 1].close, lastDate: bars[n - 1].date,
    m1: n > 21 ? bars[n - 1].close / bars[n - 22].close - 1 : null,
    sigma: sd, two: 2 * sd, lastGap, z: sd ? lastGap / sd : null,
  };
}

export async function getStats(ticker) {
  const t = String(ticker).toUpperCase().replace(/[^A-Z0-9.\-^=]/g, '').slice(0, 12);
  if (!t) return { ticker, error: 'טיקר לא תקין' };
  const hit = cache.get(t);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  let v;
  try {
    const d = await yahoo(t).catch(() => stooq(t));
    v = { ticker: t, name: d.name, px: priceStats(d.bars) };
    if (!v.px) v.error = 'היסטוריה קצרה מדי';
  } catch (e) {
    v = { ticker: t, px: null, error: 'אין נתוני מחיר' + (e?.message ? ` (${e.message})` : '') };
  }
  cache.set(t, { at: Date.now(), v });
  return v;
}

export async function getManyStats(tickers, concurrency = 4) {
  const out = new Array(tickers.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, tickers.length) }, async () => {
    while (i < tickers.length) { const k = i++; out[k] = await getStats(tickers[k]); }
  }));
  return out;
}
