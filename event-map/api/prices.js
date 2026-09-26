import { send, guard, handle, query } from '../lib/api.js';
import { getManyStats } from '../lib/prices.js';

export default handle(async (req, res) => {
  if (!guard(req, res, { methods: ['GET'], limit: { key: 'prices', max: 120, windowMs: 3600_000 } })) return;
  const tickers = (query(req).get('tickers') || '').split(',').filter(Boolean).slice(0, 25);
  send(res, 200, await getManyStats(tickers));
});
