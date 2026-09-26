import { send, guard, handle, readJson } from '../lib/api.js';
import { fetchArticle } from '../lib/news.js';

export default handle(async (req, res) => {
  if (!guard(req, res, { methods: ['POST'], limit: { key: 'article', max: 60, windowMs: 3600_000 } })) return;
  const { url } = await readJson(req);
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return send(res, 400, { error: 'כתובת לא תקינה' });
  try { send(res, 200, await fetchArticle(url)); }
  catch (e) { send(res, 502, { error: 'לא הצלחתי לקרוא את הכתבה: ' + (e.message || e) }); }
});
