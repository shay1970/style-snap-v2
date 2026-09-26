import { send, passwordRequired } from '../lib/api.js';

export default function handler(req, res) {
  send(res, 200, { ok: true, claude: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN), passwordRequired: passwordRequired() });
}
