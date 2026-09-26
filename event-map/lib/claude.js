// Stage 1: Claude labels the event, picks candidates/indices and, for real
// events, checks the claim against news sites with the web_search server tool.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
const VERIFY_DOMAINS = (process.env.VERIFY_DOMAINS ||
  'reuters.com,apnews.com,bloomberg.com,cnbc.com,wsj.com,ft.com,bbc.com,bbc.co.uk,aljazeera.com,timesofisrael.com,theguardian.com,nytimes.com,marketwatch.com,ynet.co.il,globes.co.il')
  .split(',').map(s => s.trim()).filter(Boolean);

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class AnalysisError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const RULES = `
RESEARCH RULES (from the user's own event study, 40 geopolitical events 2021-2026, basket SPY/XLE/USO/GLD/ITA; trade = fade the headline gap at Open[D], exit Close[D+4]):
- Label BEFORE prices. "process" = news STARTS something open-ended (full war, tariff/sanctions/export-ban regime, pandemic wave, systemic contagion, open-ended military campaign). "one-off" = discrete completed action (single strike, assassination, capture, fully specified cut, truce/ceasefire, resolved crisis). If unclear, split into scenario A and B with a label each.
- One-off: fade won 74% (n=23, mean +0.71%) but NOT significant vs ordinary big gaps (boot p 0.32).
- Process with |z|>=2: fade lost (mean -3.72%, hit 33%) → do not fade; big process gaps tended to continue (dominated by the Mar-2026 Iran war).
- SPY gap-downs >=2σ on geopolitical news were bought back within 5 sessions (+1.35% vs -0.50% benchmark).
- USO gaps >=2σ on process events tended to continue (fade -4.30% vs +1.78% benchmark).
- Multiple-comparison risk: these are hypotheses, not proven edges.
Known analog events in the sample (use for "analog"): Russia invades Ukraine (2022-02-24, process); OPEC+ surprise cut (2023-04-03, one-off); Wagner mutiny (2023-06-26, one-off); Hamas attack on Israel (2023-10-09, process); US/UK strikes on Houthis (2024-01-12, one-off); Iran missiles on Israel (2024-04-15, one-off); Israel limited strike on Iran (2024-10-28, one-off); Assad falls (2024-12-09, one-off); tariffs on Canada/Mexico/China (2025-02-03, process); Liberation Day tariffs (2025-04-03, process); US-China Geneva truce (2025-05-12, one-off); Israel strikes Iran (2025-06-13, process); US strikes Iran nuclear sites (2025-06-23, one-off); US captures Maduro (2026-01-05, one-off: oil producers faded, refiners MPC/PSX and SLB kept rising); US/Israel war on Iran (2026-03-02, process); US-Iran ceasefire (2026-04-08, one-off).
`;

function buildPrompt({ text, mode, hasImg, verify, sourceUrl }) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a geopolitical-to-equities analyst for a Hebrew-speaking trader. Map this news event to affected US-listed stocks and ETFs.
Today: ${today}. Mode: ${mode} (real = happened now; pre = pre-registered scenario that has not happened, you MUST give A/B scenarios; imaginary = demo).
${hasImg ? 'An image (screenshot of a tweet or article) is attached — transcribe its core claim into the summary and treat it as UNVERIFIED until checked.' : ''}
${sourceUrl ? `The text was pulled from: ${sourceUrl}` : ''}
${verify
    ? 'VERIFY FIRST: use web_search (a few targeted queries, wire services first) to check whether the core claim is reported by Reuters/AP/Bloomberg or other major outlets, and when. Report what you found honestly in "verification"; do not upgrade an unconfirmed claim.'
    : 'You are not browsing for this request: set verification.status to "not_checked" and say what must be confirmed from Reuters/AP/Bloomberg.'}
${RULES}
MAPPING RULES:
- 12 to 15 candidate stocks: US-listed, liquid (prefer market cap > $2B; liquid ADRs allowed). Include names likely to FALL, not only rise.
- order 1 = what the headline says; order 2 = who benefits/suffers from the reaction (substitutes, refiners vs producers, own-fab competitor benefits while same-supplier competitor is hurt).
- exposure (1-3) = how directly the company's revenue/assets/supply chain is tied to the event: 3 = major, documented exposure (e.g. >20% revenue or key assets in the affected country/product); 2 = meaningful but secondary; 1 = reasoning only. exposure_basis = the concrete fact behind it (in Hebrew, name the country/product/segment). Do not invent precise percentages you are unsure of.
- 4 to 7 indices/ETFs from: SPY, QQQ, IWM, SMH, XLE, USO, UNG, GLD, SLV, TLT, UUP, ITA, XAR, EWT, FXI, KWEB, EWJ, EWY, EPOL, VGK, EWZ, REMX, COPX, WEAT, DBA, JETS, XOP.
- Tickers exactly as on US exchanges (class shares with a dash, e.g. BRK-B).
Your FINAL message must be ONLY one JSON object (no prose before or after), all prose fields in Hebrew:
{"summary": "one or two sentences: what happened / what is assumed",
 "verification": {"status": "confirmed" | "partly" | "unconfirmed" | "contradicted" | "not_checked", "note": "short Hebrew: who reports it, when, what differs", "sources": [{"title":"...","url":"https://..."}]},
 "reaction_day": "which US session is D and why (weekend/overnight gap or intraday)",
 "label": "one-off" | "process" | "split",
 "label_reason": "short",
 "scenarios": [{"name":"A","desc":"...","label":"one-off|process"},{"name":"B","desc":"...","label":"..."}]  (empty array if not split; REQUIRED for pre mode),
 "candidates": [{"ticker":"XOM","name":"Exxon Mobil","dir":"up"|"down","order":1|2,"exposure":1|2|3,"exposure_basis":"short Hebrew","mechanism":"short Hebrew"}],
 "indices": [{"ticker":"USO","dir":"up"|"down","why":"short Hebrew"}],
 "analog": {"event":"closest analog from the list or 'מחוץ למדגם'","what_happened":"short","difference":"what is different now"},
 "research_says": ["2-4 bullets applying the research rules to THIS label, stated as hypotheses"],
 "critique": ["2-4 bullets: what may already be priced, where the rules may break, practical risk (position size, gap through stop)"],
 "reversers": ["2-4 things that would flip the thesis"]}

EVENT:
${text.slice(0, 20000)}`;
}

export function extractJson(s) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  const candidates = [fenced?.[1], s];
  for (const c of candidates) {
    if (!c) continue;
    const a = c.indexOf('{'), b = c.lastIndexOf('}');
    if (a < 0 || b <= a) continue;
    try { return JSON.parse(c.slice(a, b + 1)); } catch { /* try next */ }
  }
  return null;
}

function collectSearchResults(content) {
  const out = [];
  for (const b of content) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.type === 'web_search_result' && r.url) out.push({ title: r.title || r.url, url: r.url });
    }
  }
  return out;
}

export async function analyzeEvent({ text, mode, image, verify, sourceUrl, signal }) {
  const userContent = [];
  if (image) userContent.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } });
  userContent.push({ type: 'text', text: buildPrompt({ text, mode, hasImg: !!image, verify, sourceUrl }) });

  const messages = [{ role: 'user', content: userContent }];
  const tools = verify ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, allowed_domains: VERIFY_DOMAINS }] : undefined;
  const allContent = [];
  let final;

  // Server tools can end a turn with pause_turn; resend to let it continue.
  for (let round = 0; round < 4; round++) {
    let msg;
    try {
      msg = await getClient().beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        thinking: { type: 'adaptive' },
        output_config: { effort: process.env.CLAUDE_EFFORT || 'high' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        ...(tools ? { tools } : {}),
        messages,
      }, { signal }).finalMessage();
    } catch (e) {
      if (signal?.aborted) throw new AnalysisError('cancelled');
      if (e instanceof Anthropic.AuthenticationError) throw new AnalysisError('auth', 'מפתח ה-API של Anthropic לא תקין או חסר.');
      if (e instanceof Anthropic.RateLimitError) throw new AnalysisError('rate_limited');
      if (e instanceof Anthropic.BadRequestError) throw new AnalysisError('bad_request', e.message);
      if (e instanceof Anthropic.APIError) throw new AnalysisError('upstream_error', e.message);
      throw new AnalysisError('upstream_error', e?.message);
    }
    allContent.push(...msg.content);
    if (msg.stop_reason === 'refusal') throw new AnalysisError('refused');
    if (msg.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: msg.content });
      continue;
    }
    final = msg;
    break;
  }
  if (!final) throw new AnalysisError('upstream_error', 'הניתוח לא הסתיים');

  // The JSON is the text after the last tool result.
  let lastTool = -1;
  final.content.forEach((b, i) => { if (b.type.endsWith('_tool_result') || b.type === 'server_tool_use') lastTool = i; });
  const tail = final.content.slice(lastTool + 1).filter(b => b.type === 'text').map(b => b.text).join('');
  const out = extractJson(tail) || extractJson(final.content.filter(b => b.type === 'text').map(b => b.text).join(''));
  if (!out || !Array.isArray(out.candidates)) throw new AnalysisError('invalid_json');

  out.verification ??= { status: 'not_checked', note: '', sources: [] };
  const searched = collectSearchResults(allContent);
  if (searched.length) {
    const have = new Set((out.verification.sources || []).map(s => s.url));
    out.verification.searched = searched.filter(s => !have.has(s.url)).slice(0, 8);
  }
  out.model = final.model;
  return out;
}
