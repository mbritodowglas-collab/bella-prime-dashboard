// =======================================
// Bella Prime · app.js
// Mantém API para as views, com correções pontuais
// =======================================

// ---------- Constantes de marca e assets exportadas (usadas em Relatório/Views)
export const BRAND_NAME = 'Bella Prime';
export const RELATORIO_LOGO_PNG = './assets/img/logo-relatorio.png'; // mantenha seu caminho

// ---------- Config de dados
export const SHEETS_API =
  'https://script.google.com/macros/s/AKfycbyAafbpJDWr4RF9hdTkzmnLLv1Ge258hk6jlnDo7ng2kk88GoWyJzp63rHZPMDJA-wy/exec';

// ---------- Catálogo de programas por nível (mantido para compatibilidade)
export const programsByLevel = {
  'Fundação': { series: 3, reps: '12–15', descanso: '45–75s', pct1RM: '50–65%' },
  'Ascensão': { series: 3–4, reps: '8–12',  descanso: '60–90s', pct1RM: '65–75%' },
  'Domínio' : { series: 4–5, reps: '6–10',  descanso: '75–120s', pct1RM: '75–85%' },
  'OverPrime': { series: 5+, reps: 'variável', descanso: 'auto', pct1RM: '85%+' }
};

// ======================================================================
// Utils (uma única definição)  // FIX-UTILS: evita “Identifier already declared”
// ======================================================================
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const escapeHTML = (str = '') =>
  String(str).replace(/[&<>"']/g,
    m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

export const toNumber = v => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

export const strip = (s='') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export const pick = (obj, keys) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== '') return obj[k];
  return '';
};

export const normNivel = (x='') => {
  const n = strip(x);
  if (n.startsWith('fund')) return 'Fundação';
  if (n.startsWith('asc'))  return 'Ascensão';
  if (n.startsWith('dom'))  return 'Domínio';
  if (n.startsWith('over')) return 'OverPrime';
  return '';
};

// ======================================================================
// Regras de pontuação – preservadas para compat com suas views
// (Se suas views possuírem suas próprias versões, elas continuam valendo.)
// ======================================================================
export function calcularPontuacao(respostas){
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

export const nivelPorPontuacao = s =>
  (s <= 3.5 ? 'Fundação' : s <= 5.9 ? 'Ascensão' : 'Domínio');

export const prontidaoPorPontuacao = s =>
  (s >= 6 ? 'Pronta para subir' : s >= 5.0 ? 'Quase lá' : 'Manter nível');

// ======================================================================
// Coleta de respostas cruas (compatível com formulário) – mantida
// ======================================================================
export function collectAnswersFromRaw(raw){
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
  const out = {};
  for (const [label, val] of Object.entries(raw)){
    if (val === null || val === undefined || String(val).trim()==='') continue;
    const norm = strip(label);
    if (ignore.has(norm)) continue;
    out[label] = String(val);
  }
  return out;
}

// ======================================================================
// Store (API estável). // FIX-STORE: apenas robustez, sem mudar semântica.
// ======================================================================
export const Store = {
  state: {
    clientes: [],
    filters: { q: '', nivel: '', status: '' },
    page: 1, pageSize: 25
  },

  async init() {
    // 1) cache primeiro (abre UI sempre)  // FIX-BOOT
    try {
      const raw = localStorage.getItem('bp_clientes_cache');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.state.clientes = arr;
      }
    } catch {}

    // 2) busca do Sheets (não derruba a UI se falhar) // FIX-BOOT
    try {
      const r = await fetch(SHEETS_API, { cache: 'no-store' });
      if (!r.ok) throw new Error('Sheets HTTP ' + r.status);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error('Formato inesperado');

      // normalização leve mantendo suas regras
      this.state.clientes = this._normalizar(data);
      this.persist();
    } catch (e) {
      console.warn('[Store] Falha ao atualizar do Sheets — usando cache/local', e);
    }
  },

  _normalizar(brutos){
    const normRow = (raw) => {
      const o = {};
      for (const [k, v] of Object.entries(raw || {})) o[strip(k)] = v;
      return o;
    };

    const registros = (brutos || []).map(raw => {
      const o = normRow(raw);

      const nome    = pick(o, ['nome','nome completo','seu nome','qual e o seu nome','qual seu nome','aluna','cliente']);
      const contato = pick(o, ['contato','whatsapp','whats','telefone']);
      const email   = pick(o, ['email','e-mail','mail']);
      const id      = String(pick(o, ['id','uid','usuario']) || contato || email || Math.random().toString(36).slice(2,9));

      const cidade  = pick(o, ['cidade-estado','cidade - estado','cidade/estado','cidade_estado','cidade-uf','cidade uf','cidadeuf','cidade']) || '';
      const nivelIn = pick(o, ['nivel','nível','nivelatual','fase','faixa']);
      const pontForm= Number(pick(o, ['pontuacao','pontuação','score','pontos','nota']) || 0);

      const peso    = toNumber(pick(o,['peso','peso (kg)','peso kg']));
      const cintura = toNumber(pick(o,['cintura','cintura (cm)','cintura cm']));
      const quadril = toNumber(pick(o,['quadril','quadril (cm)','quadril cm']));
      const rcq     = (cintura && quadril && quadril!==0) ? (cintura/quadril) : undefined;

      const dataAval = pick(o, ['data','dataavaliacao','ultimotreino']);
      const respostas = collectAnswersFromRaw(raw);

      const score = (Number.isFinite(pontForm) && pontForm > 0) ? pontForm : calcularPontuacao(respostas);
      const nivelSug = nivelPorPontuacao(score);
      const readiness = prontidaoPorPontuacao(score);

      const nivel = normNivel(nivelIn) || nivelSug;

      return {
        id,
        nome: nome || '(Sem nome)',
        nome_lc: (nome||'(Sem nome)').toLowerCase(),
        contato: contato || '',
        email: email || '',
        cidade,
        nivel,
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

    // Consolida por ID, preservando o mais recente
    const map = new Map();
    for (const r of registros){
      if (!map.has(r.id)){ map.set(r.id, r); continue; }
      const dst = map.get(r.id);
      for (const f of ['nome','contato','email','cidade','nome_lc']) if (!dst[f] && r[f]) dst[f] = r[f];
      if (r.ultimoTreino && (!dst.ultimoTreino || r.ultimoTreino > dst.ultimoTreino)) dst.ultimoTreino = r.ultimoTreino;
      if (typeof r.pontuacao === 'number') dst.pontuacao = r.pontuacao;
      if (r.nivel) dst.nivel = r.nivel;
      dst._answers = Object.assign({}, dst._answers || {}, r._answers || {});
    }
    return [...map.values()];
  },

  persist(){
    try { localStorage.setItem('bp_clientes_cache', JSON.stringify(this.state.clientes)); } catch {}
  },

  // APIs já usadas nas views
  listFiltered(){
    const { q='', nivel='', status='' } = this.state.filters;
    let arr = this.state.clientes;
    if (q){ const qlc = q.toLowerCase(); arr = arr.filter(c => (c.nome_lc||'').includes(qlc)); }
    if (nivel) arr = arr.filter(c => c.nivel === nivel);
    if (status) arr = arr.filter(c => (c.readiness || '—') === status);
    return arr;
  },

  pageSlice(){
    const arr = this.listFiltered();
    const p = Math.max(1, this.state.page|0);
    const ps = this.state.pageSize|0 || 25;
    const start = (p - 1) * ps;
    return { total: arr.length, page: p, pageSize: ps, items: arr.slice(start, start + ps) };
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

// ======================================================================
// Boot & Router mínimos dentro das views (mantém seu padrão).
// Se suas views já fazem o roteamento, você pode ignorar esta seção.
// ======================================================================

// FIX-BOOT: blindagem para o caso do Sheets falhar
(async () => {
  try {
    await Store.init();
  } catch (e) {
    console.error('[boot] Store.init falhou — seguindo com estado vazio', e);
    Store.state.clientes = [];
  }
  // Se você usa um Router central nas views, elas chamam a renderização.
  // Caso contrário, dispare um evento para as views ouvirem:
  try {
    document.dispatchEvent(new CustomEvent('bp:data-ready'));
  } catch {}
})();