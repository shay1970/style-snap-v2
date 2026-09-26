const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => /^https?:\/\//i.test(String(u || "")) ? esc(u) : "#";
const pct = (x, d=1) => x == null || !isFinite(x) ? "—" : (x>0?"+":"") + (x*100).toFixed(d) + "%";
const num = (x, d=2) => x == null || !isFinite(x) ? "—" : x.toFixed(d);
const MODE_HE = {real:"אמיתי", pre:"תרחיש מראש", imaginary:"דמיוני"};
const hostOf = u => { try { return new URL(u).hostname; } catch { return u; } };
const hasHebrew = s => /[֐-׿]/.test(s || "");
$("#dateline").textContent = new Date().toISOString().slice(0,10) + " · NEWS → US EQUITIES";

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

/* ---------- tabs ---------- */
function showTab(name) {
  document.querySelectorAll("nav.tabs button").forEach(x => x.setAttribute("aria-selected", x.dataset.tab === name));
  for (const t of ["news", "new", "log"]) $("#tab-" + t).hidden = t !== name;
  if (name === "log") loadLog();
  if (name === "news" && !newsLoadedAt) loadNews();
}
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

/* ---------- health ---------- */
api("/api/health").then(h => {
  if (!h.claude) { $("#avail").hidden = false; $("#avail").textContent = "ANTHROPIC_API_KEY לא מוגדר בשרת — אי אפשר להריץ ניתוח."; $("#go").disabled = true; }
}).catch(() => {});

/* ---------- news feed ---------- */
let sources = [], active = new Set(), newsLoadedAt = 0, newsItems = [];
function saveActive() { try { localStorage.setItem("em.sources", JSON.stringify([...active])); } catch {} }
function timeAgo(iso) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} ד׳`;
  if (m < 1440) return `לפני ${Math.round(m/60)} ש׳`;
  return new Date(iso).toLocaleDateString("he-IL");
}
function renderChips() {
  $("#srcChips").innerHTML = `<button type="button" data-id="*" aria-pressed="${active.size === 0}">הכל</button>` +
    sources.map(s => `<button type="button" data-id="${esc(s.id)}" aria-pressed="${active.has(s.id)}">${esc(s.name)}</button>`).join("");
  $("#srcChips").querySelectorAll("button").forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (id === "*") active.clear(); else active.has(id) ? active.delete(id) : active.add(id);
    saveActive(); renderChips(); loadNews();
  });
}
async function initNews() {
  try { sources = await api("/api/sources"); } catch (e) { $("#nstatus").textContent = "טעינת המקורות נכשלה: " + e.message; return; }
  try { JSON.parse(localStorage.getItem("em.sources") || "[]").forEach(id => sources.some(s => s.id === id) && active.add(id)); } catch {}
  renderChips(); loadNews();
}
let newsReq = 0;
async function loadNews() {
  const my = ++newsReq;
  $("#nstatus").textContent = "טוען כותרות…";
  const qs = new URLSearchParams();
  if (active.size) qs.set("sources", [...active].join(","));
  try {
    const r = await api("/api/news?" + qs);
    if (my !== newsReq) return;
    newsItems = r.items; newsLoadedAt = Date.now();
    renderNews();
    const errs = r.errors.length ? ` · לא נטענו: ${r.errors.map(e => e.source).join(", ")}` : "";
    $("#nstatus").textContent = `${r.items.length} כותרות · עודכן ${new Date().toLocaleTimeString("he-IL", {hour:"2-digit", minute:"2-digit"})}${errs}`;
  } catch (e) { if (my === newsReq) $("#nstatus").textContent = "טעינת החדשות נכשלה: " + e.message; }
}
function renderNews() {
  const q = $("#nq").value.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const items = terms.length ? newsItems.filter(i => { const h = (i.title + " " + i.summary).toLowerCase(); return terms.every(t => h.includes(t)); }) : newsItems;
  $("#newsList").innerHTML = items.length ? items.map((it, k) => {
    const dir = hasHebrew(it.title) ? "rtl" : "ltr";
    return `<article class="nitem">
      <span class="m">${esc(it.publisher)}${it.publisher !== it.source ? " · " + esc(it.source) : ""} · ${esc(timeAgo(it.date))}</span>
      <span class="t" dir="${dir}">${esc(it.title)}</span>
      ${it.summary && it.summary !== it.title ? `<span class="s" dir="${dir}">${esc(it.summary.slice(0, 260))}</span>` : ""}
      <div class="row"><button class="btn primary" type="button" data-k="${newsItems.indexOf(it)}">נתח</button>
      <a class="hint" href="${safeUrl(it.link)}" target="_blank" rel="noopener noreferrer">למקור ↗</a></div>
    </article>`;
  }).join("") : `<p class="hint">אין כותרות${terms.length ? " שתואמות לסינון" : ""}.</p>`;
  $("#newsList").querySelectorAll("button[data-k]").forEach(b => b.onclick = () => pickNews(newsItems[+b.dataset.k], b));
}
$("#nq").oninput = renderNews;
$("#nrefresh").onclick = loadNews;
setInterval(() => { if (!document.hidden && !$("#tab-news").hidden) loadNews(); }, 5 * 60 * 1000);

async function pickNews(it, btn) {
  btn.disabled = true; btn.textContent = "מושך כתבה…";
  let body = "";
  try {
    const a = await api("/api/article", { method: "POST", body: JSON.stringify({ url: it.link }) });
    body = a.text && a.text.length > (it.summary || "").length ? a.text : "";
  } catch { /* paywall/blocked: fall back to headline + summary */ }
  btn.disabled = false; btn.textContent = "נתח";
  $("#url").value = it.link;
  $("#ev").value = [it.title, `(${it.publisher}, ${it.date ? it.date.slice(0,16).replace("T"," ") + " UTC" : ""})`, "", body || it.summary || ""].join("\n").trim();
  document.querySelector("input[name=mode][value=real]").checked = true; syncMode();
  showTab("new");
  status(body ? "הכתבה נמשכה. בדוק ולחץ \"נתח אירוע\"." : "לא הצלחתי למשוך את גוף הכתבה — נשארו הכותרת והתקציר.");
}

$("#pull").onclick = async () => {
  const u = $("#url").value.trim();
  if (!u) { status("הדבק קישור לכתבה."); return; }
  $("#pull").disabled = true; status("מושך כתבה…");
  try {
    const a = await api("/api/article", { method: "POST", body: JSON.stringify({ url: u }) });
    $("#ev").value = [a.title, a.siteName || a.published ? `(${[a.siteName, a.published].filter(Boolean).join(", ")})` : "", "", a.text].join("\n").trim();
    status(a.text ? "הטקסט נמשך." : "נמשכה רק כותרת — ייתכן שהכתבה מאחורי חומת תשלום.");
  } catch (e) { status(e.message); }
  $("#pull").disabled = false;
};

/* ---------- analysis ---------- */
function syncMode() { $("#verifyWrap").hidden = document.querySelector("input[name=mode]:checked").value !== "real"; }
document.querySelectorAll("input[name=mode]").forEach(r => r.onchange = syncMode);

function log(msg){ const el = $("#log"); el.hidden = false; el.textContent += msg + "\n"; el.scrollTop = el.scrollHeight; }
function status(t){ $("#status").textContent = t; }
function fileToB64(f) {
  return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = bad; r.readAsDataURL(f); });
}

let ctl = null;
$("#form").onsubmit = async e => {
  e.preventDefault();
  const text = $("#ev").value.trim();
  const file = $("#img").files?.[0];
  if (!text && !file) { status("כתוב אירוע או צרף צילום מסך."); return; }
  if (file && file.size > 5 * 1024 * 1024) { status("התמונה גדולה מ-5MB."); return; }
  const mode = document.querySelector("input[name=mode]:checked").value;
  ctl = new AbortController();
  $("#go").disabled = true; $("#stop").hidden = false; $("#log").textContent = ""; $("#result").innerHTML = ""; $("#intro").hidden = true;
  status(mode === "real" && $("#verify").checked ? "Claude מאמת ומנתח… (עד 2 דקות)" : "Claude מנתח… (עד דקה)");
  let gotResult = false;
  try {
    const payload = { text, mode, verify: $("#verify").checked, sourceUrl: $("#url").value.trim() || undefined };
    if (file) payload.image = { data: await fileToB64(file), mediaType: file.type };
    const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ctl.signal });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        if (ev.type === "log") log(ev.msg);
        else if (ev.type === "error") { showErr(ev.error); if (ev.detail) log("   " + ev.detail); gotResult = true; }
        else if (ev.type === "result") { renderResult(ev.doc, $("#result")); status("מוכן."); gotResult = true; }
      }
    }
    if (!gotResult) showErr("החיבור לשרת נקטע לפני שהתקבלה תשובה.");
  } catch (err) {
    if (err.name === "AbortError") status("נעצר.");
    else showErr(err.message || "שגיאה");
  } finally { finish(); }
};
$("#stop").onclick = () => ctl?.abort();
function finish(){ $("#go").disabled = false; $("#stop").hidden = true; }
function showErr(m){ status(""); $("#result").innerHTML = `<div class="notice err" style="margin-top:14px">${esc(m)}</div>`; }

/* ---------- render ---------- */
function dirCell(d){ return d === "down" ? `<span class="dir down">↓ יורד</span>` : `<span class="dir up">↑ עולה</span>`; }
function pxCells(px){
  if (!px) return `<td class="n">—</td><td class="n">—</td><td class="n">—</td>`;
  return `<td class="n">${num(px.last)}</td><td class="n">${pct(px.two,1)}</td><td class="n ${px.m1>0?"pos":px.m1<0?"neg":""}">${pct(px.m1)}</td>`;
}
function labelTag(l){ return l === "process" ? `<span class="tag proc">process</span>` : l === "one-off" ? `<span class="tag one">one-off</span>` : `<span class="tag">${esc(l||"—")}</span>`; }
function bullets(a){ return (a||[]).length ? `<ul>${a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="hint">—</p>`; }
const V_HE = { confirmed:["מאומת","ok"], partly:["מאומת חלקית","mid"], unconfirmed:["לא אומת","mid"], contradicted:["סותר את הדיווחים","bad"], not_checked:["לא נבדק","mid"] };
function srcList(list){ return (list||[]).length ? `<ul class="src">${list.map(s => `<li><a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a></li>`).join("")}</ul>` : ""; }

function renderResult(d, host){
  const s = d.s1 || {}, v = s.verification || {};
  const [vHe, vCls] = V_HE[v.status] || [v.status || "—", "mid"];
  const stockRows = (d.stocks||[]).map(c => `<tr><td class="tk">${esc(c.ticker)}<small>${esc(c.name)}</small></td><td>${dirCell(c.dir)}</td><td class="n">${esc(c.order||"—")}</td>
      <td><span class="score">${esc(c.exposure ?? "—")}</span>${c.exposure_basis ? `<span class="ev">${esc(c.exposure_basis)}</span>` : ""}</td>
      <td>${esc(c.mechanism)}${c.err ? `<span class="ev">${esc(c.err)}</span>`:""}</td>${pxCells(c.px)}</tr>`).join("");
  const idxRows = (d.indices||[]).map(c => `<tr><td class="tk">${esc(c.ticker)}</td><td>${dirCell(c.dir)}</td><td>${esc(c.mechanism)}</td>${pxCells(c.px)}
    <td class="n">${c.px ? `${pct(c.px.lastGap,2)} · z ${num(c.px.z,1)}` : "—"}</td></tr>`).join("");
  const sc = (s.scenarios||[]).map(x => `<div class="box"><h3>תרחיש ${esc(x.name)} ${labelTag(x.label)}</h3><p>${esc(x.desc)}</p></div>`).join("");
  host.innerHTML = `
    ${d.priceNote ? `<div class="notice" style="margin-top:14px">${esc(d.priceNote)}</div>` : ""}
    <h2 class="sec">האירוע</h2>
    <p class="lede">${esc(s.summary)}</p>
    <div class="tags"><span class="tag">${esc(MODE_HE[d.mode]||d.mode)}</span>${labelTag(s.label)}<span class="tag">${esc((d.createdAt||"").slice(0,16).replace("T"," "))}</span></div>
    <div class="box" style="margin-top:10px"><h3>אימות: <span class="vstat ${vCls}">${esc(vHe)}</span></h3>
      <p>${esc(v.note || "")}</p>${srcList(v.sources)}
      ${v.searched?.length ? `<details style="margin-top:6px"><summary class="hint">תוצאות חיפוש נוספות (${v.searched.length})</summary>${srcList(v.searched)}</details>` : ""}
      ${d.sourceUrl ? `<p class="hint" style="margin-top:6px">מקור הקלט: <a href="${safeUrl(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(d.sourceUrl))}</a></p>` : ""}
    </div>
    <p class="hint" style="margin-top:8px"><b>יום D:</b> ${esc(s.reaction_day)}<br><b>נימוק תיוג:</b> ${esc(s.label_reason)}</p>
    ${sc ? `<div class="ab">${sc}</div>` : ""}
    <h2 class="sec">10 מניות</h2>
    <div class="tbl"><table><thead><tr><th>טיקר</th><th>כיוון</th><th class="n">סדר</th><th>חשיפה</th><th>מנגנון</th><th class="n">סגירה</th><th class="n">2σ גאפ</th><th class="n">1M</th></tr></thead><tbody>${stockRows}</tbody></table></div>
    <p class="hint">חשיפה (הערכת Claude, לא אומתה מול נתוני חברה): 3 = חשיפה מהותית ומתועדת · 2 = משנית · 1 = היגיון בלבד. 1M גדול בכיוון האירוע = אולי כבר מתומחר.</p>
    ${d.dropped?.length ? `<p class="hint">סוננו: ${d.dropped.map(c=>esc(c.ticker)).join(", ")}</p>` : ""}
    <h2 class="sec">מדדים ו-ETF</h2>
    <div class="tbl"><table><thead><tr><th>טיקר</th><th>כיוון</th><th>למה</th><th class="n">סגירה</th><th class="n">2σ גאפ</th><th class="n">1M</th><th class="n">גאפ אחרון</th></tr></thead><tbody>${idxRows}</tbody></table></div>
    <p class="hint">|z| ≥ 2 בגאפ אחרון = השוק כבר הגיב חזק (רלוונטי לאירוע אמיתי אחרי פתיחה).</p>
    <h2 class="sec">תקדים ומחקר</h2>
    <div class="cols">
      <div class="box"><h3>תקדים: ${esc(s.analog?.event)}</h3><p>${esc(s.analog?.what_happened)}</p><p class="hint" style="margin-top:6px"><b>מה שונה:</b> ${esc(s.analog?.difference)}</p></div>
      <div class="box"><h3>מה המחקר אומר (השערות)</h3>${bullets(s.research_says)}</div>
      <div class="box"><h3>ביקורת</h3>${bullets(s.critique)}</div>
      <div class="box"><h3>מה יהפוך את התזה</h3>${bullets(s.reversers)}</div>
    </div>`;
}

/* ---------- log tab ---------- */
let rows = [];
async function loadLog(){
  $("#detail").innerHTML = ""; $("#list").hidden = false;
  try { rows = await api("/api/analyses"); $("#dbNote").hidden = true; }
  catch (e) { $("#dbNote").hidden = false; $("#dbNote").textContent = "טעינת היומן נכשלה (" + e.message + ")."; return; }
  if (!rows.length) { $("#list").innerHTML = `<p class="hint">עוד אין ניתוחים שמורים. ניתוח במצב "אמיתי" או "תרחיש מראש" נשמר כאן אוטומטית, עם מקום לרשום מה קרה בפועל.</p>`; return; }
  $("#list").innerHTML = rows.map(r => `<button class="item" data-id="${esc(r.id)}">
    <span class="m">${esc(r.createdAt?.slice(0,10))} · ${esc(MODE_HE[r.mode]||r.mode)} · ${esc(r.s1?.label||"")}${r.outcome ? " · ✓ תוצאה" : ""}</span>
    <span class="t">${esc(r.s1?.summary || r.event?.slice(0,120))}</span>
    <span class="m" style="direction:ltr;text-align:right">${(r.stocks||[]).map(s=>esc(s.ticker)).join(" ")}</span></button>`).join("");
  $("#list").querySelectorAll(".item").forEach(b => b.onclick = () => openDetail(b.dataset.id));
}
function openDetail(id){
  const r = rows.find(x => x.id === id); if (!r) return;
  const host = $("#detail");
  host.innerHTML = `<div class="row" style="margin-top:16px"><button class="btn ghost" id="back">← חזרה לרשימה</button><button class="btn ghost" id="del" style="margin-inline-start:auto">מחק</button></div><div id="dres"></div>
    <h2 class="sec">מה קרה בפועל</h2>
    <div class="card stack"><textarea id="outc" placeholder="גאפ בפועל, פתיחה→D+4 בנכס הכותרת, האם התיוג החזיק, מה פספסנו…">${esc(r.outcome||"")}</textarea>
    <div class="row"><button class="btn" id="saveOut">שמור תוצאה</button><span class="hint" id="outSt"></span></div></div>`;
  renderResult(r, $("#dres"));
  $("#list").hidden = true;
  $("#back").onclick = () => { host.innerHTML = ""; $("#list").hidden = false; };
  $("#del").onclick = async () => {
    if (!confirm("למחוק את הניתוח מהיומן?")) return;
    try { await api("/api/analyses/" + encodeURIComponent(id), { method: "DELETE" }); loadLog(); }
    catch (e) { $("#outSt").textContent = "המחיקה נכשלה: " + e.message; }
  };
  $("#saveOut").onclick = async () => {
    const b = $("#saveOut"); b.disabled = true; $("#outSt").textContent = "שומר…";
    try { const row = await api("/api/analyses/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ outcome: $("#outc").value }) }); Object.assign(r, row); $("#outSt").textContent = "נשמר."; }
    catch (e) { $("#outSt").textContent = "השמירה נכשלה: " + e.message; }
    b.disabled = false;
  };
}

initNews();
