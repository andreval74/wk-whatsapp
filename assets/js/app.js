/* WK WhatsApp — sistema de relatórios de conversa por assunto
   Roda inteiramente no navegador (parse, categorização automática e busca).
   fflate (assets/js/fflate.js) é usado só para ler .zip exportados do WhatsApp. */

const STORAGE_KEY = 'wkwhatsapp_saved_searches_v1';

function toISO(dmy) {
  const p = dmy.split('/');
  let [d,m,y] = p;
  if (y.length === 2) y = (parseInt(y) < 70 ? '20' : '19') + y;
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}
function stripAccents(s) {
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function norm(s) { return stripAccents((s||'').toLowerCase()); }
function escapeHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function parseAmount(s) {
  if (!s) return NaN;
  s = s.trim();
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  return parseFloat(s);
}

let DEFAULT_BLOCKS = [];
let DEFAULT_CAT_META = [];
let DEFAULT_TITLE = 'Conversa padrão';

let ALL_BLOCKS = [];
let CAT_META = [];
let CURRENT_TITLE = DEFAULT_TITLE;

const AMOUNT_RE_SRC = 'r\\$\\s?([\\d.,]+)';
function prepareBlocks(blocksArr) {
  blocksArr.forEach(b => {
    b._iso = toISO(b.date);
    const fullText = b.date + ' ' + b.category + ' ' + b.messages.map(m => m.sender + ' ' + m.text).join(' ');
    b._search = norm(fullText);
    b._amounts = [];
    const re = new RegExp(AMOUNT_RE_SRC, 'gi');
    let m;
    while ((m = re.exec(fullText)) !== null) {
      const v = parseAmount(m[1]);
      if (!isNaN(v)) b._amounts.push(v);
    }
  });
  return blocksArr;
}

function loadDataset(blocksArr, catMetaArr, title) {
  const cleaned = JSON.parse(JSON.stringify(blocksArr)).map(b => { delete b._iso; delete b._search; delete b._amounts; return b; });
  ALL_BLOCKS = prepareBlocks(cleaned);
  CAT_META = catMetaArr;
  CURRENT_TITLE = title;
  document.getElementById('convTitle').textContent = title;
  const totalMsgs = ALL_BLOCKS.reduce((a,b)=>a+b.messages.length,0);
  document.getElementById('convSub').textContent = `${totalMsgs} mensagens · ${ALL_BLOCKS.length} dias · organizadas por assunto`;
  state = { cat:null, q:'', from:'', to:'', minVal:null, maxVal:null, sender:null };
  lastChips = [];
  visibleCount = 40;
  document.getElementById('search').value='';
  document.getElementById('dateFrom').value='';
  document.getElementById('dateTo').value='';
  document.getElementById('aiInput').value='';
  renderChips();
  renderCatList();
  renderFeed();
}

let state = { cat: null, q: '', from: '', to: '', minVal: null, maxVal: null, sender: null };
let lastChips = [];
let visibleCount = 40;

// ---------- Category sidebar ----------
const catlistEl = document.getElementById('catlist');
function renderCatList() {
  const totalMsgs = ALL_BLOCKS.reduce((a,b)=>a+b.messages.length,0);
  let html = `<div class="cat-item ${state.cat===null?'active':''}" data-name="__all__">
      <span class="dot" style="background:#00a884"></span>
      <span class="cat-name">Todos os assuntos</span>
      <span class="cat-count">${totalMsgs}</span>
    </div>`;
  CAT_META.forEach(c => {
    html += `<div class="cat-item ${state.cat===c.name?'active':''}" data-name="${c.name.replace(/"/g,'&quot;')}">
      <span class="dot" style="background:${c.color}"></span>
      <span class="cat-name">${c.name}</span>
      <span class="cat-count">${c.count}</span>
    </div>`;
  });
  catlistEl.innerHTML = html;
  catlistEl.querySelectorAll('.cat-item').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.getAttribute('data-name');
      state.cat = (name === '__all__') ? null : name;
      visibleCount = 40;
      renderCatList();
      renderFeed();
    });
  });
}
function catColor(name) {
  const c = CAT_META.find(c => c.name === name);
  return c ? c.color : '#555';
}

// ---------- AI-like natural language query parser ----------
const MONTHS = {janeiro:1,fevereiro:2,marco:3,'março':3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
const CATEGORY_SYNONYMS = [
  {cat: "Financeiro, Pagamentos e Cobranças", keys: ["financeiro","pagamento","pagamentos","dinheiro","cobranca","cobrancas","divida","dividas","boleto","pix","unimed","financiamento","juros","valores"]},
  {cat: "Imóveis, Aluguel e Reformas", keys: ["imovel","imoveis","casa","aluguel","reforma","reformas","apartamento","condominio","chacara","sanepar","alpes"]},
  {cat: "Internet e Telefonia", keys: ["internet","claro","sercomtel","fibra","telefone","telefonia","modem"]},
  {cat: "Produtos, Encomendas e Vendas", keys: ["produto","produtos","adesivo","adesivos","venda","vendas","encomenda","encomendas","etiqueta","etiquetas","rotulo","rotulos","caneca","canecas"]},
  {cat: "Família e Saúde", keys: ["familia","saude","filho","filhos","deisi","depressao"]},
  {cat: "Fé, Oração e Igreja", keys: ["fe","oracao","deus","igreja","pastor"]},
  {cat: "Cobrança de Terceiros (Rodrigo, Lorival, Ivan)", keys: ["rodrigo","lorival","ivan","samuel"]},
  {cat: "Conversas do Dia a Dia", keys: ["diaadia","geral","bomdia"]},
];
const STOPWORDS = new Set(["sobre","de","do","da","dos","das","em","com","o","a","os","as","que","pra","para","conversas","conversa","mensagens","mensagem","me","mostra","mostre","busca","buscar","pesquisa","pesquisar","ache","encontre","quero","ver","alguma","algum","todas","todos","assunto","onde","tem","teve","houve","fala","falamos","falando"]);

function parseAIQuery(raw) {
  let q = ' ' + norm(raw) + ' ';
  const result = { cat: null, from: '', to: '', q: '', minVal: null, maxVal: null, sender: null, chips: [] };
  let monthNum = null;
  for (const name in MONTHS) {
    const re = new RegExp('\\b' + name + '\\b');
    if (re.test(q)) { monthNum = MONTHS[name]; q = q.replace(re, ' '); break; }
  }
  let yearVal = null;
  const ym = q.match(/\b(20\d{2})\b/);
  if (ym) { yearVal = ym[1]; q = q.replace(ym[0], ' '); }
  if (monthNum && yearVal) {
    const mm = String(monthNum).padStart(2,'0');
    const lastDay = new Date(parseInt(yearVal), monthNum, 0).getDate();
    result.from = `${yearVal}-${mm}-01`;
    result.to = `${yearVal}-${mm}-${String(lastDay).padStart(2,'0')}`;
    result.chips.push(`Período: ${mm}/${yearVal}`);
  } else if (yearVal) {
    result.from = `${yearVal}-01-01`;
    result.to = `${yearVal}-12-31`;
    result.chips.push(`Ano: ${yearVal}`);
  } else if (monthNum) {
    result.chips.push(`Mês: ${monthNum}`);
  }
  const dateTokenRe = /(\d{2})\/(\d{2})\/(\d{4})/g;
  const foundDates = [];
  let dm;
  while ((dm = dateTokenRe.exec(q)) !== null) foundDates.push(dm[0]);
  if (foundDates.length >= 2) {
    const iso1 = toISO(foundDates[0]), iso2 = toISO(foundDates[1]);
    result.from = iso1 < iso2 ? iso1 : iso2;
    result.to = iso1 < iso2 ? iso2 : iso1;
    result.chips = result.chips.filter(c => !c.startsWith('Período') && !c.startsWith('Ano'));
    result.chips.push(`Entre ${foundDates[0]} e ${foundDates[1]}`);
    foundDates.forEach(d => q = q.replace(d, ' '));
  } else if (foundDates.length === 1) {
    const iso = toISO(foundDates[0]);
    if (/depois de|apos|a partir de/.test(q)) { result.from = iso; result.chips.push(`A partir de ${foundDates[0]}`); }
    else if (/antes de|ate /.test(q)) { result.to = iso; result.chips.push(`Até ${foundDates[0]}`); }
    else { result.from = iso; result.to = iso; result.chips.push(`Data: ${foundDates[0]}`); }
    q = q.replace(foundDates[0], ' ');
  }
  let vm;
  if (vm = q.match(/(?:acima de|maior que|mais de)\s*r?\$?\s?([\d.,]+)/)) {
    result.minVal = parseAmount(vm[1]);
    result.chips.push(`Valor ≥ R$ ${vm[1]}`);
    q = q.replace(vm[0], ' ');
  }
  if (vm = q.match(/(?:abaixo de|menor que|menos de)\s*r?\$?\s?([\d.,]+)/)) {
    result.maxVal = parseAmount(vm[1]);
    result.chips.push(`Valor ≤ R$ ${vm[1]}`);
    q = q.replace(vm[0], ' ');
  }
  if (/\beliseu\b/.test(q)) {
    result.sender = 'eliseu';
    result.chips.push('Remetente: Eliseu');
    q = q.replace(/\beliseu\b/, ' ');
  } else if (/\b(andre|eu falei|eu disse|minhas mensagens)\b/.test(q)) {
    result.sender = 'andre';
    result.chips.push('Remetente: André');
    q = q.replace(/\b(andre|eu falei|eu disse|minhas mensagens)\b/, ' ');
  }
  const qCompact = q.replace(/\s+/g, '');
  for (const entry of CATEGORY_SYNONYMS) {
    const hit = entry.keys.find(k => qCompact.includes(k) || q.includes(k));
    if (hit && CAT_META.some(c => c.name === entry.cat)) {
      result.cat = entry.cat;
      result.chips.push('Assunto: ' + entry.cat);
      entry.keys.forEach(k => { q = q.replace(new RegExp('\\b'+k+'\\b','g'), ' '); });
      break;
    }
  }
  if (!result.cat) {
    for (const c of CAT_META) {
      const cWords = norm(c.name).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
      if (cWords.some(w => qCompact.includes(w))) {
        result.cat = c.name;
        result.chips.push('Assunto: ' + c.name);
        cWords.forEach(w => { q = q.replace(new RegExp(w,'g'), ' '); });
        break;
      }
    }
  }
  q = q.split(/\s+/).filter(w => w && !STOPWORDS.has(w)).join(' ').trim();
  result.q = q;
  if (q) result.chips.push(`Palavras-chave: "${q}"`);
  if (result.chips.length === 0) result.chips.push(`Busca livre: "${raw}"`);
  return result;
}

function applyAIResult(r) {
  state.cat = r.cat;
  state.from = r.from || '';
  state.to = r.to || '';
  state.q = r.q || '';
  state.minVal = r.minVal;
  state.maxVal = r.maxVal;
  state.sender = r.sender;
  lastChips = r.chips;
  document.getElementById('search').value = state.q;
  document.getElementById('dateFrom').value = state.from;
  document.getElementById('dateTo').value = state.to;
  visibleCount = 40;
  renderChips();
  renderCatList();
  renderFeed();
}
function renderChips() {
  const chipsEl = document.getElementById('chips');
  if (!lastChips.length) { chipsEl.innerHTML = ''; return; }
  chipsEl.innerHTML = lastChips.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join('');
}
document.getElementById('aiBtn').addEventListener('click', runAI);
document.getElementById('aiInput').addEventListener('keydown', e => { if (e.key === 'Enter') runAI(); });
function runAI() {
  const raw = document.getElementById('aiInput').value.trim();
  if (!raw) return;
  applyAIResult(parseAIQuery(raw));
}

// ---------- Saved searches ----------
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e) { return []; }
}
function persistSaved(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch(e) {}
}
function renderSavedList() {
  const list = loadSaved();
  const el = document.getElementById('savedlist');
  if (!list.length) { el.innerHTML = '<div id="noSaved">Nenhuma pesquisa salva ainda.</div>'; return; }
  el.innerHTML = list.map((s, i) => `
    <div class="saved-item" data-i="${i}">
      <span>🔎</span>
      <span class="sname" title="${escapeHtml(s.raw)}">${escapeHtml(s.name)}</span>
      <span class="sdel" data-del="${i}">✕</span>
    </div>`).join('');
  el.querySelectorAll('.saved-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.sdel')) return;
      const i = parseInt(item.getAttribute('data-i'));
      const s = loadSaved()[i];
      document.getElementById('aiInput').value = s.raw;
      applyAIResult(s.result);
    });
  });
  el.querySelectorAll('.sdel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = parseInt(btn.getAttribute('data-del'));
      const list2 = loadSaved();
      list2.splice(i, 1);
      persistSaved(list2);
      renderSavedList();
    });
  });
}
document.getElementById('saveBtn').addEventListener('click', () => {
  const raw = document.getElementById('aiInput').value.trim();
  if (!raw) { alert('Digite uma pergunta no campo de IA antes de salvar.'); return; }
  const r = parseAIQuery(raw);
  const suggested = r.chips.slice(0,2).join(' · ') || raw;
  const name = prompt('Nome para esta pesquisa salva:', suggested.slice(0,60));
  if (!name) return;
  const list = loadSaved();
  list.unshift({ name, raw, result: r });
  persistSaved(list);
  renderSavedList();
});

// ---------- filtering + rendering ----------
function highlight(text, q) {
  if (!q) return escapeHtml(text);
  const esc = escapeHtml(text);
  try {
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return esc.replace(re, '<mark>$1</mark>');
  } catch(e) { return esc; }
}
function filterBlocks() {
  const q = norm(state.q);
  const min = (state.minVal != null && !isNaN(state.minVal)) ? state.minVal : null;
  const max = (state.maxVal != null && !isNaN(state.maxVal)) ? state.maxVal : null;
  return ALL_BLOCKS.filter(b => {
    if (state.cat && b.category !== state.cat) return false;
    if (state.from && b._iso < state.from) return false;
    if (state.to && b._iso > state.to) return false;
    if (q && !b._search.includes(q)) return false;
    if (min != null || max != null) {
      const lo = min != null ? min : -Infinity;
      const hi = max != null ? max : Infinity;
      if (!b._amounts.some(a => a >= lo && a <= hi)) return false;
    }
    if (state.sender) {
      const ok = b.messages.some(m => {
        if (state.sender === 'eliseu') return /eliseu/i.test(m.sender);
        if (state.sender === 'andre') return /andr/i.test(m.sender);
        return true;
      });
      if (!ok) return false;
    }
    return true;
  });
}
const feedEl = document.getElementById('feed');
const infoEl = document.getElementById('resultInfo');
function renderFeed() {
  const filtered = filterBlocks();
  const totalMsgs = filtered.reduce((a,b)=>a+b.messages.length,0);
  infoEl.textContent = `${filtered.length} dias de conversa · ${totalMsgs} mensagens encontradas`;
  if (filtered.length === 0) {
    feedEl.innerHTML = '<div id="empty">Nenhuma conversa encontrada com esse filtro.</div>';
    return;
  }
  const slice = filtered.slice(0, visibleCount);
  const rawQ = state.q;
  let html = '';
  slice.forEach((b, idx) => {
    const color = catColor(b.category);
    html += `<div class="day-block" data-idx="${idx}">
      <div class="day-header">
        <div>
          <span class="date">${b.date}</span>
          <span class="badge" style="background:${color}">${b.category}</span>
        </div>
        <span class="toggle">▾ ${b.messages.length} msgs</span>
      </div>
      <div class="msgs">`;
    b.messages.forEach(m => {
      let cls = 'eliseu';
      if (m.sender === 'sistema') cls = 'sistema';
      else if (/andr/i.test(m.sender)) cls = 'andre';
      const senderLabel = m.sender === 'sistema' ? '' : `<b>${escapeHtml(m.sender)}</b><br>`;
      html += `<div class="msg ${cls}">${cls!=='sistema'?senderLabel:''}${highlight(m.text, rawQ)}<span class="meta">${m.time}</span></div>`;
    });
    html += `</div></div>`;
  });
  feedEl.innerHTML = html;
  feedEl.querySelectorAll('.day-block').forEach(el => {
    el.querySelector('.day-header').addEventListener('click', () => el.classList.toggle('open'));
  });
  if (state.q || state.cat || state.from || state.to || state.minVal != null || state.maxVal != null || state.sender) {
    feedEl.querySelectorAll('.day-block').forEach(el => el.classList.add('open'));
  }
  if (filtered.length > visibleCount) {
    const wrap = document.createElement('div');
    wrap.id = 'loadMoreWrap';
    wrap.innerHTML = `<button id="loadMoreBtn">Carregar mais dias (${filtered.length - visibleCount} restantes)</button>`;
    feedEl.appendChild(wrap);
    document.getElementById('loadMoreBtn').addEventListener('click', () => { visibleCount += 60; renderFeed(); });
  }
}
let debounceTimer;
document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { state.q = e.target.value; visibleCount = 40; renderFeed(); }, 200);
});
document.getElementById('dateFrom').addEventListener('change', e => { state.from = e.target.value; visibleCount=40; renderFeed(); });
document.getElementById('dateTo').addEventListener('change', e => { state.to = e.target.value; visibleCount=40; renderFeed(); });
document.getElementById('clearBtn').addEventListener('click', () => {
  state = { cat:null, q:'', from:'', to:'', minVal:null, maxVal:null, sender:null };
  lastChips = [];
  document.getElementById('search').value='';
  document.getElementById('dateFrom').value='';
  document.getElementById('dateTo').value='';
  document.getElementById('aiInput').value='';
  visibleCount = 40;
  renderChips();
  renderCatList();
  renderFeed();
});

// ---------- Download current report as a portable .json file ----------
document.getElementById('downloadBtn').addEventListener('click', () => {
  const exportBlocks = ALL_BLOCKS.map(b => {
    const { _iso, _search, _amounts, ...rest } = b;
    return rest;
  });
  const payload = { title: CURRENT_TITLE, blocks: exportBlocks, categories: CAT_META };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = norm(CURRENT_TITLE).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'relatorio';
  a.href = url;
  a.download = `relatorio_${slug}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ---------- WhatsApp export parser (client-side) ----------
function parseWhatsAppExport(text) {
  text = text.replace(/^﻿/, '').replace(/‎/g, '');
  const lines = text.split(/\r?\n/);
  const lineRe1 = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*([^:]+):\s(.*)$/;
  const lineRe1sys = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.*)$/;
  const lineRe2 = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s(.*)$/;
  const messages = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw;
    let m = line.match(lineRe1);
    if (m) {
      cur = { date: normalizeDate(m[1]), time: m[2].slice(0,5), sender: m[3].trim(), text: m[4] };
      messages.push(cur);
      continue;
    }
    m = line.match(lineRe2);
    if (m) {
      cur = { date: normalizeDate(m[1]), time: m[2].slice(0,5), sender: m[3].trim(), text: m[4] };
      messages.push(cur);
      continue;
    }
    m = line.match(lineRe1sys);
    if (m) {
      cur = { date: normalizeDate(m[1]), time: m[2].slice(0,5), sender: 'sistema', text: m[3] };
      messages.push(cur);
      continue;
    }
    if (cur !== null && line.length) {
      cur.text += '\n' + line;
    }
  }
  return messages;
}
function normalizeDate(d) {
  let [dd, mm, yy] = d.split('/');
  if (yy.length === 2) yy = (parseInt(yy) < 70 ? '20' : '19') + yy;
  dd = dd.padStart(2,'0'); mm = mm.padStart(2,'0');
  return `${dd}/${mm}/${yy}`;
}
function groupIntoDayBlocks(messages) {
  const byDate = new Map();
  messages.forEach(m => {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date).push(m);
  });
  const blocks = [];
  byDate.forEach((msgs, date) => blocks.push({ date, messages: msgs }));
  return blocks;
}

// ---------- Automatic topic detection (offline, keyword-frequency based) ----------
const PT_STOPWORDS = new Set(("de da do das dos em no na nos nas um uma uns umas e ou mas por para com sem sob sobre entre até " +
  "que se eu tu ele ela nos vos eles elas voce voces meu minha meus minhas teu tua teus tuas seu sua seus suas nosso nossa " +
  "isso isto aquilo esse essa esses essas este esta estes estas aqui ali la agora hoje ontem amanha depois antes ja nao sim " +
  "vou vai vamos vao foi fui era eram sou es somos sao ser estar esta estou estamos estao tem tinha tinham ter tera " +
  "muito muita muitos muitas pouco pouca mais menos bem mal tudo nada algo alguem ninguem cada qualquer todo toda todos todas " +
  "bom boa bons boas dia dias tarde noite manha obrigado obrigada por favor entao ok blz kk kkk kkkk kkkkk rs rsrs rsrsrs " +
  "midia oculta mensagem apagada figurinha sticker imagem video audio arquivo anexo ligacao chamada perdida contato " +
  "voce vc pra pro num numa neste nesta nesse nessa naquele naquela onde quando como porque porq pq qual quais quanto quantos " +
  "oi ola alo falar disse falou pode poderia gostaria queria quer fazer tenho cara vamos vou estou esta estava tava tinha " +
  "deixa deixar olha olhar sabe saber acho achei certo certeza tipo mesmo ainda gente pessoal amigo irmao mano precisa precisamos " +
  "manda mandar mandei enviei enviar vai foi ser estar assim coisa coisas algo tudo nada bora la pois https http www com br " +
  "final ainda dessa desse nessa nesse pela pelo isso essa esse aquele aquela").split(/\s+/));

function tokenize(text) {
  const t = norm(text).replace(/<[^>]*>/g, ' ');
  return (t.match(/[a-z]{4,}/g) || []).filter(w => !PT_STOPWORDS.has(w));
}

function autoCategorize(blocks) {
  const globalFreq = new Map();
  const docFreq = new Map();
  const blockTokens = blocks.map(b => {
    const text = b.messages.map(m => m.text).join(' ');
    const toks = tokenize(text);
    const counts = new Map();
    toks.forEach(w => counts.set(w, (counts.get(w)||0)+1));
    counts.forEach((c,w) => {
      globalFreq.set(w, (globalFreq.get(w)||0)+c);
      docFreq.set(w, (docFreq.get(w)||0)+1);
    });
    return counts;
  });
  const nBlocks = blocks.length || 1;
  const candidates = [];
  globalFreq.forEach((freq, w) => {
    const df = docFreq.get(w);
    if (df < Math.max(2, nBlocks*0.01) || df > nBlocks*0.6) return;
    const score = freq * Math.log(nBlocks / (1+df));
    candidates.push({ w, freq, df, score });
  });
  candidates.sort((a,b) => b.score - a.score);

  const seeds = [];
  const stems = [];
  for (const c of candidates) {
    const stem = c.w.slice(0, 5);
    if (stems.includes(stem)) continue;
    seeds.push(c.w);
    stems.push(stem);
    if (seeds.length >= 8) break;
  }

  const PALETTE = ["#c0392b","#8e44ad","#2980b9","#16a085","#d35400","#2c3e50","#c2185b","#00796b","#5d4037","#455a64"];
  const catNames = seeds.map(w => w.charAt(0).toUpperCase() + w.slice(1));
  const FALLBACK = "Conversas Gerais";

  blocks.forEach((b, i) => {
    const counts = blockTokens[i];
    let best = null, bestScore = 0;
    seeds.forEach((seed, si) => {
      const stem = seed.slice(0,5);
      let score = 0;
      counts.forEach((c, w) => { if (w.slice(0,5) === stem) score += c; });
      if (score > bestScore) { bestScore = score; best = si; }
    });
    b.category = (best !== null && bestScore > 0) ? catNames[best] : FALLBACK;
  });

  const catCounts = new Map(), catDays = new Map();
  blocks.forEach(b => {
    catCounts.set(b.category, (catCounts.get(b.category)||0) + b.messages.length);
    catDays.set(b.category, (catDays.get(b.category)||0) + 1);
  });
  const catMeta = Array.from(catCounts.keys()).map((name) => ({
    name, count: catCounts.get(name), days: catDays.get(name),
    color: name === FALLBACK ? '#7f8c8d' : PALETTE[catNames.indexOf(name) % PALETTE.length]
  })).sort((a,b) => b.count - a.count);

  return catMeta;
}

// ---------- Upload / file handling ----------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const genBtn = document.getElementById('genBtn');
const statusEl = document.getElementById('uploadStatus');
const restoreBtn = document.getElementById('restoreBtn');
let pendingFile = null;

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) setFile(fileInput.files[0]); });

function setFile(file) {
  const okExt = /\.(zip|txt|json)$/i.test(file.name);
  if (!okExt) {
    statusEl.className = 'err';
    statusEl.textContent = 'Formato não suportado. Envie um .zip ou .txt exportado do WhatsApp, ou um .json de relatório salvo anteriormente.';
    return;
  }
  pendingFile = file;
  fileNameEl.textContent = '📄 ' + file.name;
  genBtn.style.display = 'block';
  genBtn.textContent = /\.json$/i.test(file.name) ? 'Carregar relatório salvo' : 'Gerar relatório por assunto';
  statusEl.className = '';
  statusEl.textContent = '';
}

genBtn.addEventListener('click', () => {
  if (!pendingFile) return;
  genBtn.disabled = true;
  statusEl.className = '';
  statusEl.textContent = 'Processando arquivo...';
  setTimeout(() => processFile(pendingFile), 30);
});

async function processFile(file) {
  try {
    if (/\.json$/i.test(file.name)) {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload.blocks) throw new Error('Este .json não parece ser um relatório salvo por este sistema.');
      loadDataset(payload.blocks, payload.categories || autoCategorize(payload.blocks), payload.title || file.name.replace(/\.json$/i,''));
      restoreBtn.style.display = 'block';
      statusEl.className = 'ok';
      statusEl.textContent = 'Relatório salvo carregado com sucesso.';
      return;
    }
    let text;
    if (/\.zip$/i.test(file.name)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const entries = fflate.unzipSync(buf);
      const txtNames = Object.keys(entries).filter(n => /\.txt$/i.test(n));
      if (!txtNames.length) throw new Error('Nenhum arquivo .txt de conversa foi encontrado dentro do .zip.');
      txtNames.sort((a,b) => entries[b].length - entries[a].length);
      text = fflate.strFromU8(entries[txtNames[0]]);
    } else {
      text = await file.text();
    }
    statusEl.textContent = 'Identificando mensagens...';
    const messages = parseWhatsAppExport(text);
    if (!messages.length) throw new Error('Não foi possível reconhecer mensagens nesse arquivo. Confirme que é um export de conversa do WhatsApp (Exportar conversa > Sem mídia).');
    const blocks = groupIntoDayBlocks(messages);
    statusEl.textContent = 'A IA está identificando os assuntos...';
    const catMeta = autoCategorize(blocks);
    const title = file.name.replace(/\.(zip|txt)$/i, '');
    loadDataset(blocks, catMeta, title);
    restoreBtn.style.display = 'block';
    statusEl.className = 'ok';
    statusEl.textContent = `Relatório gerado: ${messages.length} mensagens em ${blocks.length} dias, ${catMeta.length} assuntos detectados.`;
  } catch (err) {
    statusEl.className = 'err';
    statusEl.textContent = 'Erro: ' + err.message;
  } finally {
    genBtn.disabled = false;
  }
}

restoreBtn.addEventListener('click', () => {
  loadDataset(DEFAULT_BLOCKS, DEFAULT_CAT_META, DEFAULT_TITLE);
  restoreBtn.style.display = 'none';
  fileNameEl.textContent = '';
  genBtn.style.display = 'none';
  statusEl.className = '';
  statusEl.textContent = '';
  pendingFile = null;
  fileInput.value = '';
});

// ---------- init: load default dataset from ./data/*.json ----------
async function init() {
  try {
    const [blocksRes, catsRes, metaRes] = await Promise.all([
      fetch('data/blocks.json'),
      fetch('data/categories.json'),
      fetch('data/meta.json'),
    ]);
    DEFAULT_BLOCKS = await blocksRes.json();
    DEFAULT_CAT_META = await catsRes.json();
    const meta = await metaRes.json();
    DEFAULT_TITLE = meta.title || 'Conversa padrão';
  } catch (e) {
    DEFAULT_BLOCKS = [];
    DEFAULT_CAT_META = [];
    DEFAULT_TITLE = 'Nenhuma conversa carregada';
  }
  loadDataset(DEFAULT_BLOCKS, DEFAULT_CAT_META, DEFAULT_TITLE);
  renderSavedList();
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('appShell').style.visibility = 'visible';
}
init();
