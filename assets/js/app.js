// ==============================
// Bella Prime · App (com suas regras)
// ==============================

// —— Base/Config
const BASE = window.__BP_BASE__ || './';
const APP_NAME = 'Bella Prime';

// Troque pelo seu endpoint Apps Script (mantive o que você já usava)
const SHEETS_API = 'https://script.google.com/macros/s/AKfycbyAafbpJDWr4RF9hdTkzmnLLv1Ge258hk6jlnDo7ng2kk88GoWyJzp63rHZPMDJA-wy/exec';
const CACHE_KEY  = 'bp_clientes_v3';

// —— Utils (definição única)
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const escapeHTML = (str = '') =>
  String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// —— SUAS FUNÇÕES (copiadas e mantidas)
const strip = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pick = (obj, keys) => { for (const k of keys) if (obj[k] !== undefined && obj[k] !== '') return obj[k]; };
const normNivel = (x='') => {
  const n = strip(x);
  if (n.startsWith('fund')) return 'Fundação';
  if (n.startsWith('asc'))  return 'Ascensão';
  if (n.startsWith('dom'))  return 'Domínio';
  if (n.startsWith('over')) return 'OverPrime';
  return '';
};

// Mantém a mesma ideia: ignora metacampos e devolve respostas úteis
function collectAnswersFromRaw(raw){
  if (!raw) return {};
  const ignore = new Set([
    'id','identificador','uid','usuario',
    'nome','nome completo','seu nome','qual e o seu nome','qual seu nome','aluna','cliente','paciente',
    'contato','whatsapp','whats','telefone',
    'email','e-mail','mail',
    'cidade-estado','cidade - estado','cidade/estado','cidade_estado','cidade-uf','cidade uf','cidadeuf','cidade',
    'nivel','nível','nivelatual','fase','faixa',
    'pontuacao','pontuação','score','pontos','nota',
    'ultimotreino','ultimaavaliacao','dataavaliacao','data',
    'renovacaodias','renovacao','ciclodias',
    'peso','peso (kg)','peso kg',
    'cintura','cintura (cm)','cintura cm',
    'quadril','quadril (cm)','quadril cm',
    'novo_nivel','novonivel','nivel_novo','nivel aprovado','nivel_aprovado',
    'aprovado','aprovacao','aprovação','aprovacao_professor','ok','apto','apta',
    'data_decisao','data_upgrade','data_mudanca','data da decisao',
    'observacao_professor','observacao','comentario'
  ]);
  const norm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const out = {};
  for (const [label, val] of Object.entries(raw)){
    if (val === null || val === undefined || String(val).trim()==='') continue;
    if (ignore.has(norm(label))) continue;
    out[label] = String(val);
  }
  return out;
}

// Regras de pontuação (mantidas)
function calcularPontuacao(respostas){
  if (!respostas || typeof respostas !== 'object') return 0;
  const criterios = [
    { chave:/execu[cç][aã]o|t[ée]cnica|movimento|postura/i, bom:['boa','correta','excelente','sem dificuldade'], ruim:['ruim','errada','muita dificuldade'], peso:1 },
    { chave:/frequ[êe]ncia|dias por semana|quantas vezes/i, bom:['4','5','6','7'], ruim:['0','1','2','nenhum','rara'], peso:1 },
    { chave:/dor|les[aã]o|limita[cç][aã]o|tendinite|condromalacia|condromal[áa]cia|lombar|joelho|ombro/i, bom:['nenhuma','não','nao','controlada'], ruim:['sim','frequente','constante'], peso:-1 },
    { chave:/sono/i, bom:['bom','regular','7','8','9'], ruim:['ruim','ins[ôo]nia','5','4','3'], peso:1 },
    { chave:/alimenta[cç][aã]o|dieta|nutri/i, bom:['equilibrada','organizada','planejada','acompanha'], ruim:['desorganizada','ruim','pula','lanches'], peso:1 },
    { chave:/tempo de treino|treina h[aá]|experi[êe]ncia/i, bom:['1 ano','2 anos','3 anos','mais de','> 1'], ruim:['iniciante','come[çc]ando','< 3 meses'], peso:1 },
    { chave:/const[âa]ncia|disciplina|motiva[cç][aã]o/i, bom:['alta','boa','constante'], ruim:['baixa','oscilante'], peso:0.5 },
  ];
  let score = 0;
  for (const [pergunta,resposta] of Object.entries(respostas)){
    for (const c of criterios){
      if (c.chave.test(pergunta)){
        const t = String(resposta).toLowerCase();
        if (c.bom.some(b => t.includes(b))) score += c.peso;
        else if (c.ruim && c.ruim.some(r => t.includes(r))) score -= Math.abs(c.peso);
      }
    }
  }
  return Math.max(0, Math.min(9, score));
}
function nivelPorPontuacao(s){ return (s <= 3.5 ? 'Fundação' : s <= 5.9 ? 'Ascensão' : 'Domínio'); }
function prontidaoPorPontuacao(s){ return (s >= 6 ? 'Pronta para subir' : s >= 5.0 ? 'Quase lá' : 'Manter nível'); }

// —— Store (usa tuas regras; Sheets + cache + paginação)
const Store = {
  state: {
    clientes: [],
    filters: { q: '', nivel: '', status: '' },
    page: 1, pageSize: 25
  },

  async init() {
    // 1) cache primeiro (abre UI mesmo offline)
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.state.clientes = arr;
      }
    } catch {}

    // 2) busca do Sheets por cima (sem derrubar a UI se falhar)
    try {
      const r = await fetch(SHEETS_API, { cache: 'no-store' });
      if (!r.ok) throw new Error('Sheets HTTP ' + r.status);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error('Formato inesperado do Sheets');

      const list = this.normalizarComRegrasDoMarcio(data);

      this.state.clientes = list;
      this.persist();
    } catch (e) {
      console.warn('Erro ao buscar Sheets (seguindo com cache/estado atual):', e);
    }
  },

  // Normalização usando TUAS funções (sem reescrever regras)
  normalizarComRegrasDoMarcio(brutos) {
    const normRow = (raw) => {
      const o = {};
      for (const [k, v] of Object.entries(raw || {})) o[strip(k)] = v;
      return o;
    };

    const registros = (brutos || []).map(raw => {
      const o = normRow(raw);
      // Identificação
      const nome    = pick(o, ['nome','nome completo','seu nome','qual e o seu nome','qual seu nome','aluna','cliente']);
      const contato = pick(o, ['contato','whatsapp','whats','telefone']);
      const email   = pick(o, ['email','e-mail','mail']);
      const id      = String(pick(o, ['id','uid','usuario']) || contato || email || Math.random().toString(36).slice(2,9));

      const cidade  = pick(o, ['cidade-estado','cidade - estado','cidade/estado','cidade_estado','cidade-uf','cidade uf','cidadeuf','cidade']) || '';

      // Status / pontuação declarada
      const nivelIn  = pick(o, ['nivel','nível','nivelatual','fase','faixa']);
      const pontForm = Number(pick(o, ['pontuacao','pontuação','score','pontos','nota']) || 0);

      // Métricas (se existirem)
      const toNum = x => (x!==undefined && x!=='' ? Number(String(x).replace(',','.')) : undefined);
      const peso    = toNum(pick(o,['peso','peso (kg)','peso kg']));
      const cintura = toNum(pick(o,['cintura','cintura (cm)','cintura cm']));
      const quadril = toNum(pick(o,['quadril','quadril (cm)','quadril cm']));
      const rcq     = (cintura && quadril && quadril!==0) ? (cintura/quadril) : undefined;

      // Data (se vier)
      const dataAval = pick(o, ['data','dataavaliacao','ultimotreino']);

      // Respostas completas (pra ficha do cliente)
      const respostas = collectAnswersFromRaw(raw);

      // Score e nível (tuas regras)
      const score = (Number.isFinite(pontForm) && pontForm > 0) ? pontForm : calcularPontuacao(respostas);
      const nivelSug = nivelPorPontuacao(score);
      const readiness = prontidaoPorPontuacao(score);

      // Nível final default, respeitando nível informado
      const nivelDefault = (() => {
        const n = strip(nivelIn || '');
        if (n.startsWith('fund')) return 'Fundação';
        if (n.startsWith('asc'))  return 'Ascensão';
        if (n.startsWith('dom'))  return 'Domínio';
        if (n.startsWith('over')) return 'OverPrime';
        return nivelSug;
      })();

      return {
        id,
        nome: nome || '(Sem nome)',
        nome_lc: (nome||'(Sem nome)').toLowerCase(),
        contato: contato || '',
        email: email || '',
        cidade,
        nivel: nivelDefault,
        pontuacao: score,
        sugestaoNivel: nivelSug,
        readiness,
        ultimoTreino: dataAval || undefined,
        renovacaoDias: Number(pick(o,['renovacaodias','renovacao','ciclodias'])) || 30,
        peso: Number.isFinite(peso)?peso:undefined,
        cintura: Number.isFinite(cintura)?cintura:undefined,
        quadril: Number.isFinite(quadril)?quadril:undefined,
        rcq: (typeof rcq === 'number' && !isNaN(rcq)) ? rcq : undefined,
        _answers: respostas
      };
    });

    // Aqui podemos consolidar por ID se o Sheets tiver múltiplas linhas da mesma aluna
    const map = new Map();
    for (const r of registros){
      if (!map.has(r.id)){ map.set(r.id, r); continue; }
      const dst = map.get(r.id);
      for (const f of ['nome','contato','email','cidade','nome_lc']) if (!dst[f] && r[f]) dst[f] = r[f];
      // manter último treino mais recente se aparecer
      if (r.ultimoTreino && (!dst.ultimoTreino || r.ultimoTreino > dst.ultimoTreino)) dst.ultimoTreino = r.ultimoTreino;
      // sobrescrever score/nivel se for melhor definido
      if (typeof r.pontuacao === 'number') dst.pontuacao = r.pontuacao;
      if (r.nivel) dst.nivel = r.nivel;
      // mesclar respostas
      dst._answers = Object.assign({}, dst._answers || {}, r._answers || {});
    }
    return [...map.values()];
  },

  // Filtros e paginação
  statusCalc(c){
    return c.readiness || '—';
  },

  listFiltered() {
    const { q='', nivel='', status='' } = this.state.filters;
    let arr = this.state.clientes;
    if (q){
      const qlc = q.toLowerCase();
      arr = arr.filter(c => (c.nome_lc||'').includes(qlc));
    }
    if (nivel)  arr = arr.filter(c => c.nivel === nivel);
    if (status) arr = arr.filter(c => this.statusCalc(c) === status);
    return arr;
  },

  pageSlice() {
    const arr = this.listFiltered();
    const p = Math.max(1, this.state.page|0);
    const ps = this.state.pageSize|0 || 25;
    const start = (p - 1) * ps;
    return { total: arr.length, page: p, pageSize: ps, items: arr.slice(start, start + ps) };
  },

  persist() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(this.state.clientes)); } catch {}
  },

  exportJSON(){
    const blob = new Blob([JSON.stringify(this.state.clientes,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bella-prime-clientes.json';
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async importJSON(file){
    const text = await file.text();
    const arr = JSON.parse(text);
    if(Array.isArray(arr)){ this.state.clientes = arr; this.persist(); }
  }
};

// —— Views
const DashboardView = {
  route: '#/',
  async init() {
    const el = $('#app');
    el.innerHTML = `
      <section class="bp-row">
        <div class="bp-card">
          <h2>Clientes</h2>
          <div class="bp-filters">
            <input id="f-q" class="bp-input" placeholder="Buscar por nome..." />
            <select id="f-nivel" class="bp-select">
              <option value="">Todos os níveis</option>
              <option>Fundação</option>
              <option>Ascensão</option>
              <option>Domínio</option>
              <option>OverPrime</option>
            </select>
            <select id="f-status" class="bp-select">
              <option value="">Status</option>
              <option>Pronta para subir</option>
              <option>Quase lá</option>
              <option>Manter nível</option>
            </select>
            <button id="btn-export" class="bp-btn">Exportar JSON</button>
            <label class="bp-btn">
              Importar JSON
              <input id="import-file" type="file" accept="application/json" style="display:none" />
            </label>
          </div>

          <div id="tbl-wrap" class="bp-table-wrap">
            <table class="bp-table">
              <thead>
                <tr><th>Nome</th><th>Nível</th><th>Status</th><th>Último treino</th><th>Cidade</th></tr>
              </thead>
              <tbody id="tbody"></tbody>
            </table>
            <div id="empty" class="bp-empty" style="display:none">Sem resultados</div>
          </div>

          <div id="pager" class="bp-pager"></div>
        </div>

        <div class="bp-card">
          <h2>Distribuição por Nível</h2>
          <div style="height:220px">
            <canvas id="chartNiveis" height="200"></canvas>
          </div>
          <small style="opacity:.7">Se o Chart.js não carregar, o app segue normal.</small>
        </div>
      </section>
    `;

    // listeners
    $('#f-q').addEventListener('input', debounce(e => { Store.state.filters.q = e.target.value; Store.state.page=1; this.renderAll(); }, 200));
    $('#f-nivel').addEventListener('change', e => { Store.state.filters.nivel = e.target.value; Store.state.page=1; this.renderAll(); });
    $('#f-status').addEventListener('change', e => { Store.state.filters.status = e.target.value; Store.state.page=1; this.renderAll(); });
    $('#btn-export').addEventListener('click', () => Store.exportJSON());
    $('#import-file').addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0]; if (!f) return;
      await Store.importJSON(f); this.renderAll();
    });

    this.renderAll();
  },

  renderAll(){
    this.renderTable();
    this.renderPager();
    this.renderChart();
  },

  renderTable() {
    const { items } = Store.pageSlice();
    const tb = $('#tbody');
    const empty = $('#empty');
    if (!items.length) { tb.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    tb.innerHTML = items.map(c => `
      <tr>
        <td><a href="#/cliente/${encodeURIComponent(c.id)}">${escapeHTML(c.nome)}</a></td>
        <td>${escapeHTML(c.nivel || '')}</td>
        <td>${escapeHTML(c.readiness || '—')}</td>
        <td>${escapeHTML(c.ultimoTreino || '-')}</td>
        <td>${escapeHTML(c.cidade || '')}</td>
      </tr>
    `).join('');
  },

  renderPager() {
    const wrap = $('#pager');
    const { total, page, pageSize } = Store.pageSlice();
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const cur = Math.min(page, pages);
    Store.state.page = cur;
    wrap.innerHTML = `
      <button id="pg-prev" class="bp-btn" ${cur<=1?'disabled':''}>◀</button>
      <span class="bp-pages">Página ${cur} / ${pages} • ${total} itens</span>
      <button id="pg-next" class="bp-btn" ${cur>=pages?'disabled':''}>▶</button>
    `;
    $('#pg-prev')?.addEventListener('click', () => { Store.state.page = Math.max(1, cur - 1); this.renderTable(); this.renderPager(); });
    $('#pg-next')?.addEventListener('click', () => { Store.state.page = cur + 1; this.renderTable(); this.renderPager(); });
  },

  _chartRef: null,
  renderChart() {
    const ctx = $('#chartNiveis');
    if (!ctx || typeof window.Chart !== 'function') return; // sem Chart.js, sem crash
    try { this._chartRef?.destroy?.(); } catch {}

    const arr = Store.listFiltered();
    const counts = { Fundação:0, Ascensão:0, Domínio:0, OverPrime:0 };
    for (const c of arr) if (counts.hasOwnProperty(c.nivel)) counts[c.nivel]++;
    const data = [counts['Fundação'], counts['Ascensão'], counts['Domínio'], counts['OverPrime']];

    this._chartRef = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['Fundação','Ascensão','Domínio','OverPrime'], datasets: [{ label: 'Clientes', data }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision:0 } } }
      }
    });
  }
};

const ClienteView = {
  route: '#/cliente/:id',
  async init(params) {
    const id = params?.id;
    const c = Store.state.clientes.find(x => String(x.id) === String(id));
    const el = $('#app');
    if (!c) {
      el.innerHTML = `
        <div class="bp-card">
          <a class="bp-link" href="#/">← Voltar</a>
          <h2>Cliente não encontrado</h2>
          <p>Verifique o link ou volte ao Dashboard.</p>
        </div>`;
      return;
    }
    const respostasCount = c._answers ? Object.keys(c._answers).length : 0;
    const firstAnswers = c._answers ? Object.entries(c._answers).slice(0, 50) : [];
    el.innerHTML = `
      <div class="bp-card">
        <a class="bp-link" href="#/">← Voltar</a>
        <h2>${escapeHTML(c.nome)}</h2>
        <p><b>Nível:</b> ${escapeHTML(c.nivel || '')} • <b>Status:</b> ${escapeHTML(c.readiness || '—')}</p>
        <p><b>Pontuação:</b> ${escapeHTML(String(c.pontuacao ?? '—'))} • <b>Último treino:</b> ${escapeHTML(c.ultimoTreino || '-')}</p>
        <p><b>Cidade:</b> ${escapeHTML(c.cidade || '')}</p>
      </div>

      <div class="bp-card">
        <h3>Respostas completas <small style="opacity:.7">(${respostasCount})</small></h3>
        <ul id="ansList" style="margin:8px 0 12px 18px;max-height:280px;overflow:auto">
          ${firstAnswers.map(([k,v]) => `<li><b>${escapeHTML(k)}:</b> ${escapeHTML(v)}</li>`).join('')}
        </ul>
        ${respostasCount>50?'<button class="bp-btn" id="ansMore">Carregar mais</button>':''}
        <div class="bp-row" style="gap:10px;margin-top:8px">
          <button class="bp-btn" id="copyAnswers">Copiar tudo</button>
        </div>
        <textarea id="answersText" style="position:absolute;left:-9999px;top:-9999px;">${
          c._answers ? Object.entries(c._answers).map(([k,v]) => `${k}: ${v}`).join('\n') : ''
        }</textarea>
      </div>
    `;

    $('#ansMore')?.addEventListener('click', () => {
      let i = 50;
      const list = $('#ansList');
      const entries = Object.entries(c._answers);
      const next = entries.slice(i, i+50).map(([k,v]) => `<li><b>${escapeHTML(k)}:</b> ${escapeHTML(v)}</li>`).join('');
      list.insertAdjacentHTML('beforeend', next);
      i += 50;
      if (i >= entries.length) $('#ansMore').remove();
    });

    $('#copyAnswers')?.addEventListener('click', () => {
      const ta = $('#answersText');
      ta.select(); ta.setSelectionRange(0, 99999);
      document.execCommand('copy');
    });
  }
};

// —— Router
const Router = {
  routes: [
    { path: /^#\/$/, view: DashboardView },
    { path: /^#\/cliente\/([^/]+)$/, view: ClienteView, map: (m)=>({ id: decodeURIComponent(m[1]) }) }
  ],

  async render() {
    const hash = location.hash || '#/';
    for (const r of this.routes) {
      const m = hash.match(r.path);
      if (m) {
        try { await r.view.init(r.map ? r.map(m) : undefined); }
        catch (e) { this.showError(e); }
        return;
      }
    }
    await DashboardView.init();
  },

  showError(err) {
    console.error('Router error', err);
    const el = $('#app');
    el.innerHTML = `
      <div class="bp-card">
        <h2>Erro ao renderizar</h2>
        <pre style="white-space:pre-wrap">${escapeHTML(err && err.stack ? err.stack : String(err))}</pre>
      </div>
    `;
  },

  start() {
    window.addEventListener('hashchange', () => this.render());
    this.render();
  }
};

// —— Boot (defensivo: app abre mesmo se Sheets cair)
(async () => {
  try {
    await Store.init();
  } catch (e) {
    console.error('Store.init falhou, seguindo com estado vazio', e);
    Store.state.clientes = [];
  } finally {
    try { Router.start(); }
    catch (e) {
      console.error('Falha ao iniciar Router', e);
      $('#app').innerHTML = `<div class="bp-card"><h2>Falha ao iniciar</h2><pre>${escapeHTML(e.stack||String(e))}</pre></div>`;
    }
  }
})();