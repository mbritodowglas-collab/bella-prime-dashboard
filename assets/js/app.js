// =====================================
// BELLA PRIME · APP PRINCIPAL (default no painel)
// =====================================

import { DashboardView } from './views/dashboardview.js';
import { ClienteView }   from './views/clienteview.js';
import { AvaliacaoView } from './views/avaliacaoview.js';

const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwsOtURP_fuMDzfxysaeVITPZkl2GfRXfz7io9plgAFsgbpScIZGzVTHaRfWPepZv26/exec';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const parseISO = (s) => new Date(`${s}T12:00:00`);
const diffDays  = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));

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
      const dados = await loadSeed();
      const norm = (dados || []).map(raw => {
        const c = { ...raw };

        // “Cidade - Estado” -> cidade
        if (!c.cidade && c['Cidade - Estado']) {
          c.cidade = c['Cidade - Estado'];
          delete c['Cidade - Estado'];
        }

        c.id         = String(c.id ?? c.email ?? c.contato ?? cryptoId());
        c.avaliacoes = Array.isArray(c.avaliacoes) ? c.avaliacoes : [];
        return c;
      });

      this.state.clientes = norm;
      this.persist();
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

function cryptoId(){
  try { return crypto.randomUUID(); }
  catch { return 'id_' + Math.random().toString(36).slice(2,9); }
}

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

// ---------- Boot: SEM depender de clicar “Início” ----------
(async () => {
  await Store.init();
  // não força hash — render() já considera dashboard como default
  await render();
})();