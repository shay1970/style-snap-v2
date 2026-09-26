import { send, guard, handle } from '../lib/api.js';
import { SOURCES } from '../lib/sources.js';

export default handle(async (req, res) => {
  if (!guard(req, res, { methods: ['GET'] })) return;
  send(res, 200, SOURCES.map(({ id, name, lang }) => ({ id, name, lang })));
});
