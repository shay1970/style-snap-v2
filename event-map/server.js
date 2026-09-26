// Local server: serves public/ and routes /api/<name> to the same handlers
// Vercel runs from api/. On Vercel this file is not used.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { send } from './lib/api.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = +process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const ROUTES = ['health', 'sources', 'news', 'article', 'prices', 'analyze'];
const handlers = Object.fromEntries(await Promise.all(ROUTES.map(async r => [r, (await import(`./api/${r}.js`)).default])));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

async function serveStatic(res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1)));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, 'Not found');
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch { send(res, 404, 'Not found'); }
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://local');
  const m = /^\/api\/(\w+)\/?$/.exec(pathname);
  if (m) return handlers[m[1]] ? handlers[m[1]](req, res) : send(res, 404, { error: 'Not found' });
  if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
  return serveStatic(res, pathname);
}).listen(PORT, HOST, () => {
  console.log(`מפת אירועים: http://${HOST}:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) console.warn('⚠ ANTHROPIC_API_KEY לא מוגדר — הניתוח לא יעבוד.');
  if (!['127.0.0.1', 'localhost'].includes(HOST) && !process.env.APP_PASSWORD) console.warn('⚠ השרת חשוף לרשת בלי APP_PASSWORD — כל מי שמגיע אליו יכול להוציא את קרדיט ה-API שלך.');
});
