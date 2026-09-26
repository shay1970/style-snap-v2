import { send, guard, handle, query } from '../lib/api.js';
import { getNews } from '../lib/news.js';

export default handle(async (req, res) => {
  if (!guard(req, res, { methods: ['GET'], limit: { key: 'news', max: 120, windowMs: 3600_000 } })) return;
  const q = query(req);
  const sources = (q.get('sources') || '').split(',').filter(Boolean);
  send(res, 200, await getNews({ sources, q: q.get('q') || '' }));
});
