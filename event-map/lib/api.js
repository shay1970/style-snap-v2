// Shared helpers for the api/ handlers. They run both as Vercel functions and
// under the local server.js, so they only use the plain Node req/res API.
import { timingSafeEqual } from 'node:crypto';

const MAX_BODY = 10 * 1024 * 1024;
const PASSWORD = process.env.APP_PASSWORD || '';
const ON_VERCEL = !!process.env.VERCEL;
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

export function send(res, status, body, headers = {}) {
  const isStr = typeof body === 'string';
  res.writeHead(status, { 'content-type': isStr ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(isStr ? body : JSON.stringify(body));
}

export function query(req) {
  return new URL(req.url, 'http://local').searchParams;
}

// Vercel has already parsed the body into req.body; locally we read the stream.
export async function readJson(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { throw httpError(400, 'JSON לא תקין'); } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString('utf8') || '{}'); } catch { throw httpError(400, 'JSON לא תקין'); } }
    return req.body || {};
  }
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw httpError(413, 'גוף הבקשה גדול מדי');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw httpError(400, 'JSON לא תקין'); }
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function passwordOk(req) {
  const given = String(req.headers['x-app-password'] || '');
  const a = Buffer.from(given), b = Buffer.from(PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

// A page on another site must not be able to make a signed-in browser spend
// the API key by POSTing here.
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { if (new URL(o).host === host) return true; } catch { return false; }
  return EXTRA_ORIGINS.includes(o);
}

// Best-effort per-IP limiter. It lives in one function instance's memory, so
// it resets on cold start — keep a monthly spend limit on the Anthropic
// account as the hard cap.
const hits = new Map();
function rateLimited(key, limit, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
  const over = recent.length >= limit;
  if (!over) recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return over;
}

// Gate every endpoint that costs money or fetches third-party URLs.
// Returns true when the request may proceed; otherwise it has already responded.
export function guard(req, res, { methods, limit } = {}) {
  if (methods && !methods.includes(req.method)) { send(res, 405, { error: 'Method not allowed' }); return false; }
  if (req.method !== 'GET' && !originOk(req)) { send(res, 403, { error: 'Forbidden' }); return false; }
  if (!PASSWORD && ON_VERCEL) { send(res, 503, { error: 'השרת לא מוגדר: צריך להגדיר APP_PASSWORD ב-Vercel.', code: 'no_password' }); return false; }
  if (PASSWORD && !passwordOk(req)) { send(res, 401, { error: 'סיסמה שגויה או חסרה.', code: 'auth' }); return false; }
  if (limit) {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    if (rateLimited(`${limit.key}:${ip}`, limit.max, limit.windowMs)) { send(res, 429, { error: 'יותר מדי בקשות — נסה שוב מאוחר יותר.' }); return false; }
  }
  return true;
}

export function handle(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'שגיאת שרת' });
      if (!e.status) console.error(e);
    }
  };
}

export const passwordRequired = () => !!PASSWORD || ON_VERCEL;
