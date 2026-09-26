// Outbound HTTP helpers: timeouts, size caps, and a guard against fetching
// internal addresses when the URL comes from the user (/api/article).
import dns from 'node:dns/promises';
import net from 'node:net';

const UA = 'Mozilla/5.0 (compatible; EventMap/1.0; +https://localhost)';
const MAX_BYTES = 3 * 1024 * 1024;

function privateV4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
function privateIp(ip) {
  if (net.isIPv4(ip)) return privateV4(ip);
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateV4(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublic(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('רק כתובות http/https');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('כתובת פנימית חסומה');
}

async function readCapped(res) {
  const reader = res.body.getReader();
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) { reader.cancel(); break; }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks);
  const ct = res.headers.get('content-type') || '';
  const cs = /charset=([\w-]+)/i.exec(ct)?.[1] || /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 2048).toString('latin1'))?.[1] || 'utf-8';
  try { return new TextDecoder(cs.toLowerCase()).decode(buf); } catch { return buf.toString('utf8'); }
}

// Fetch a URL. With {untrusted:true} every hop (including redirects) must
// resolve to a public address.
export async function getText(href, { untrusted = false, timeoutMs = 12000, accept } = {}) {
  let url = new URL(href);
  for (let hop = 0; hop < 5; hop++) {
    if (untrusted) await assertPublic(url);
    const res = await fetch(url, {
      redirect: untrusted ? 'manual' : 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': UA, accept: accept || '*/*', 'accept-language': 'en-US,en;q=0.9,he;q=0.8' },
    });
    if (untrusted && res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} מ-${url.hostname}`);
    return { text: await readCapped(res), finalUrl: url.toString() };
  }
  throw new Error('יותר מדי הפניות');
}

export async function getJson(href, opts) {
  return JSON.parse((await getText(href, { ...opts, accept: 'application/json' })).text);
}
