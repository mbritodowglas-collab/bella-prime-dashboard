// =====================================
// BELLA PRIME · APP PRINCIPAL (default no painel + normalização Sheets)
// =====================================

import { DashboardView } from './views/dashboardview.js';
import { ClienteView }   from './views/clienteview.js';
import { AvaliacaoView } from './views/avaliacaoview.js';

const SHEETS_API = 'https://script.google.com/macros/s/AKfycbyAafbpJDWr4RF9hdTkzmnLLv1Ge258hk6jlnDo7ng2kk88GoWyJzp63rHZPMDJA-wy/exec';

// ---------- Datas ----------
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const parseISO = (s) => new Date(`${s}T12:00:00`);
const diffDays  = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));

// ---------- Utils ----------
function cryptoId(){
  try { return crypto.randomUUID(); }
  catch { return 'id_' + Math.random().toString(36).slice(2,9); }
}
const strip = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pick = (obj, keys) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== '') return obj[k];
  return undefined;
};

// ---------- Dados (Sheets -> seed.json) ----------
async function loadSeed(){
  try{
    const r = await fetch(SHEETS_API, { cache:'no-store' });
    if(!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
    const data = await r.json();
    if(!Array.isArray(data)) throw new Error('Sheets retornou formato inválido');
    console.log('Sheets OK:', data.length);
    return data;
  }catch(e){
    console.warn('Sheets falhou, usando seed.json:', e);
    const r2 = await fetch('./assets/data/seed.json', { cache:'no-store' });
    const data = await r2.json();
    console.log('seed.json:', Array.isArray(data) ? data.length : 0);
    return data;
  }
}

// ---------- Store ----------
const KEY = 'bp_clientes_v1';

export const Store = {
  state: {
    clientes: [],
    filters: { q:'', nivel:'', status:'' },
    scroll: { '/': 0 }
  },

  async init(){
    try{
      const brutos = await loadSeed();

      // 1) normaliza chaves (case/acentos) por linha
      const normRow = (raw) => {
        const o = {};
        for (const [k, v] of Object.entries(raw || {})) o[strip(k)] = v;
        return o;
      };

      // 2) transforma cada linha em um "registro base" com avaliação opcional
      const registros = (brutos || []).map(raw => {
        const o = normRow(raw);

        // nome: cobre "Nome completo" e variações comuns do Forms
        const nome = pick(o, [
          'nome','nome completo','seu nome','qual e o seu nome','qual seu nome',
          'aluna','cliente','paciente'
        ]);

        const contato = pick(o, ['contato','whatsapp','whats','telefone']);
        const email   = pick(o, ['email','e-mail','mail']);
        const id      = String(pick(o, ['id','identificador','uid','usuario']) || contato || email || cryptoId());

        // Aceita várias formas de "Cidade - Estado"
        const cidade = pick(o, [
          'cidade-estado','cidade - estado','cidade/estado','cidade_estado',
          'cidade-uf','cidade uf','cidadeuf','cidade'
        ]) || '';

        // Campos de avaliação (data / pontuação / nível)
        const dataAval = pick(o, ['data','dataavaliacao','data da avaliacao','ultimotreino','ultimaavaliacao']);
        const pont     = Number(pick(o, ['pontuacao','pontuação','score','pontos','nota']) || 0);
        const nivelIn  = pick(o, ['nivel','nível','nivelatual','fase','faixa']);

        // normaliza nível
        const nivel = (() => {
          const n = strip(nivelIn || '');
          if (n.startsWith('fund')) return 'Fundação';
          if (n.startsWith('asc'))  return 'Ascensão';
          if (n.startsWith('dom'))  return 'Domínio';
          if (n.startsWith('over')) return 'OverPrime';
          if (pont <= 2)  return 'Fundação';
          if (pont <= 6)  return 'Ascensão';
          if (pont <= 10) return 'Domínio';
          return 'Domínio';
        })();

        const ultimoTreino = pick(o, ['ultimotreino','ultimaavaliacao','dataavaliacao','data']) || undefined;

        const base = {
          id,
          nome: nome || '(Sem nome)',
          contato: contato || '',
          email: email || '',
          cidade,
          nivel,
          pontuacao: isNaN(pont) ? 0 : pont,
          ultimoTreino: ultimoTreino || undefined,
          renovacaoDias: Number(pick(o,['renovacaodias','renovacao','ciclodias'])) || 30,
          avaliacoes: []
        };

        // se existir avaliação nesta linha, adiciona
        if (dataAval || !isNaN(pont)) {
          const dataISO = (dataAval && /^\d{4}-\d{2}-\d{2}$/.test(String(dataAval))) ? String(dataAval) : todayISO();
          base.avaliacoes.push({ data: dataISO, pontuacao: isNaN(pont) ? 0 : pont, nivel });
          base.ultimoTreino = base.ultimoTreino || dataISO;
          base.pontuacao    = isNaN(pont) ? base.pontuacao : pont;
        }

        return base;
      });

      // 3) colapsa por id, mesclando históricos (dedup)
      const map = new Map();
      for (const r of registros) {
        if (!map.has(r.id)) { map.set(r.id, r); continue; }
        const dst = map.get(r.id);

        // completa cadastro
        for (const f of ['nome','contato','email','cidade','nivel','pontuacao','ultimoTreino','renovacaoDias']) {
          if (!dst[f] && r[f]) dst[f] = r[f];
        }

        // mescla avaliações
        const avs = [...(dst.avaliacoes||[]), ...(r.avaliacoes||[])];
        const seen = new Set(); const dedup = [];
        for (const a of avs) {
          const key = `${a.data}|${a.pontuacao}`;
          if (!seen.has(key)) { seen.add(key); dedup.push(a); }
        }
        dedup.sort((a,b)=> a.data.localeCompare(b.data));
        dst.avaliacoes = dedup;

        const last = dedup[dedup.length-1];
        if (last) {
          dst.pontuacao    = last.pontuacao;
          dst.nivel        = last.nivel || dst.nivel;
          dst.ultimoTreino = dst.ultimoTreino || last.data;
        }
      }

      this.state.clientes = [...map.values()];
      this.persist();
      console.log(`✅ Normalizado: ${this.state.clientes.length} clientes`);
    }catch(e){
      console.error('Falha init()', e);
      this.state.clientes = [];
    }
  },

  async reloadFromSheets(){
    await this.init();
  },

  persist(){ localStorage.setItem(KEY, JSON.stringify(this.state.clientes)); },

  list(){
    const { q='', nivel='', status='' } = this.state.filters || {};
    return [...this.state.clientes]
      .sort((a,b)=> (a.nome||'').localeCompare(b.nome||'','pt',{sensitivity:'base'}))
      .filter(c => !q     || (c.nome||'').toLowerCase().includes(q.toLowerCase()))
      .filter(c => !nivel || c.nivel === nivel)
      .filter(c => !status|| statusCalc(c).label === status);
  },

  byId(id){ return this.state.clientes.find(c => String(c.id) === String(id)); },

  upsert(c){
    const i = this.state.clientes.findIndex(x => String(x.id) === String(c.id));
    if (i >= 0) this.state.clientes[i] = c; else this.state.clientes.push(c);
    this.persist();
  },

  exportJSON(){
    const blob = new Blob([JSON.stringify(this.state.clientes, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clientes-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async importJSON(file){
    const text = await file.text();
    const incoming = JSON.parse(text);
    const map = new Map(this.state.clientes.map(c => [String(c.id), c]));
    for (const nc of incoming){
      const id = String(nc.id);
      if (map.has(id)){
        const base = map.get(id);
        const avs  = [...(base.avaliacoes||[]), ...(nc.avaliacoes||[])];
        const seen = new Set(); const dedup = [];
        for (const a of avs){
          const key = `${a.data}|${a.pontuacao}`;
          if (!seen.has(key)) { seen.add(key); dedup.push(a); }
        }
        map.set(id, { ...base, ...nc, avaliacoes: dedup.sort((a,b)=> a.data.localeCompare(b.data)) });
      } else {
        map.set(id, nc);
      }
    }
    this.state.clientes = [...map.values()];
    this.persist();
  }
};

// ---------- Status ----------
export function statusCalc(c){
  const renov = c.renovacaoDias ?? 30;
  const hoje  = todayISO();
  const dias  = renov - (diffDays(hoje, c.ultimoTreino || hoje));
  if (dias >= 10) return { label:'Ativa',           klass:'st-ok'   };
  if (dias >= 3)  return { label:'Perto de vencer', klass:'st-warn' };
  if (dias >= 0)  return { label:'Vence em breve',  klass:'st-soon' };
  return            { label:'Vencida',              klass:'st-bad'  };
}

// ---------- Router (abre direto no painel) ----------
const idRe = '([\\w\\-+.@=]+)';
const routes = [
  { path: new RegExp('^#\\/$'),                         view: DashboardView },
  { path: new RegExp('^#\\/cliente\\/' + idRe + '$'),   view: ClienteView   },
  { path: new RegExp('^#\\/avaliacao\\/' + idRe + '$'), view: AvaliacaoView },
];

async function render(){
  const app  = document.getElementById('app');
  const hash = location.hash;

  let View = DashboardView, params = [];
  if (hash && hash !== '#' && hash !== '#/'){
    const match = routes.find(r => r.path.test(hash));
    if (!match){ app.innerHTML = '<div class="card"><h2>404</h2></div>'; return; }
    params = match.path.exec(hash).slice(1);
    View   = match.view;
  }
  app.innerHTML = await View.template(...params);
  if (View.init) await View.init(...params);
}

window.addEventListener('hashchange', render);

// ---------- Boot ----------
(async () => {
  await Store.init();
  await render(); // default: dashboard
})();
