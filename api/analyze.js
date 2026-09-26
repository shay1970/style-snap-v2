const Anthropic = require('@anthropic-ai/sdk');

// Only same-site pages may call this endpoint from a browser. Extra origins
// (e.g. a custom domain) can be added via ALLOWED_ORIGINS="https://a.com,https://b.com".
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_B64 = 7 * 1024 * 1024; // ~5MB decoded
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_HOUR || '20', 10);
const RATE_WINDOW_MS = 60 * 60 * 1000;

// Best-effort per-IP limiter. It lives in the function instance's memory, so it
// resets on cold start and isn't shared between instances — keep a spend cap on
// the Anthropic account as the hard limit.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin GET/POST from some browsers omits Origin
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    if (new URL(origin).host === host) return true;
  } catch (e) { return false; }
  return EXTRA_ORIGINS.includes(origin);
}

function str(v, fallback, max) {
  if (typeof v !== 'string') return fallback;
  const s = v.replace(/[<>"'`&\\]/g, '').trim().slice(0, max);
  return s || fallback;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(req)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { return res.status(originAllowed(req) ? 200 : 403).end(); }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }
  if (!originAllowed(req)) { return res.status(403).json({ error: 'Forbidden' }); }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) { return res.status(429).json({ error: 'Too many requests' }); }

  const { image, mimeType } = req.body || {};
  if (typeof image !== 'string' || !image) { return res.status(400).json({ error: 'Missing image data' }); }
  if (image.length > MAX_IMAGE_B64) { return res.status(413).json({ error: 'Image too large' }); }
  const mediaType = ALLOWED_MIME.has(mimeType) ? mimeType : 'image/jpeg';
  if (!process.env.ANTHROPIC_API_KEY) { return res.status(500).json({ error: 'Server not configured' }); }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'Analyze clothing in this image. Respond with ONLY a JSON array (no markdown, no explanation). Start with [ and end with ]. Each item: {"type":"שם עברי","cat":"tops|bottoms|footwear|accessories|outerwear","color":"English","hex":"#hex","brand":"brand or Unknown","style":"Casual|Sporty|Classic","gender":"גברים|נשים|יוניסקס","conf":0.9}' }
        ]
      }]
    });
    const text = response.content[0].text.trim();
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd <= jsonStart) {
      throw new Error('No JSON array in response');
    }
    const items = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    if (!Array.isArray(items)) throw new Error('Response is not an array');
    const validCats = new Set(['tops','bottoms','footwear','accessories','outerwear']);
    const validStyles = new Set(['Casual','Sporty','Classic']);
    const validGenders = new Set(['גברים','נשים','יוניסקס']);
    // Model output is untrusted (text in the photo can steer it), and the client
    // renders these fields as HTML — so only plain, bounded values go back.
    const sanitized = items.slice(0, 20).filter(item => item && typeof item === 'object').map((item, i) => ({
      id: i+1,
      type: str(item.type, 'פריט לבוש', 40),
      cat: validCats.has(item.cat) ? item.cat : 'tops',
      color: str(item.color, 'Unknown', 30),
      hex: typeof item.hex === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(item.hex) ? item.hex : '#888888',
      brand: str(item.brand, 'Unknown', 40),
      style: validStyles.has(item.style) ? item.style : 'Casual',
      gender: validGenders.has(item.gender) ? item.gender : 'יוניסקס',
      conf: typeof item.conf === 'number' && isFinite(item.conf) ? Math.min(1, Math.max(0, item.conf)) : 0.85
    }));
    return res.status(200).json({ items: sanitized });
  } catch (error) {
    console.error('Claude API error:', error.message);
    return res.status(500).json({ error: 'Analysis failed' });
  }
};
