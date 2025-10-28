// =====================================
// BELLA PRIME · APP PRINCIPAL (robusto)
// =====================================

import { DashboardView } from './views/dashboardview.js';
import { ClienteView }   from './views/clienteview.js';
import { AvaliacaoView } from './views/avaliacaoview.js';

// ===== CONFIG DA API (Apps Script) =====
const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwsOtURP_fuMDzfxysaeVITPZkl2GfRXfz7io9plgAFsgbpScIZGzVTHaRfWPepZv26/exec';

// ===== FUNÇÕES DE DATA =====
const todayISO = () => {
  const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
};
const parseISO = (s)=> new Date(`${s}T12:00:00`);
const diffDays = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));

// ===== CARGA DE DADOS (com fallback duplo) =====
async function loadSeed() {
  // 1) tenta Google Sheets
  try {
    const r = await fetch(SHEETS_API, { cache: 'no-store', mode: 'cors' });
    if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('Sheets retornou formato inválido');
    console.log(`✅ Planilha: ${data.length} clientes`);
    return data;
  } catch (err) {
    console.warn('⚠️ Falha Sheets:', err?.message || err);
  }
  // 2) tenta seed.json local
  try {
    const r = await fetch('./assets/data/seed.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`seed.json HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('seed.json inválido');
    console.log(`✅ seed.json: ${data.length} clientes`);
    return data;
  } catch (err2) {
    console.warn('⚠️ Falha seed.json:', err2?.message || err2);
  }
  // 3) último recurso: array vazio (não quebra UI)
  console.error('❌ Nenhuma fonte de dados disponível. Renderizando vazio.');
  return [];
}

// ===== STORE (LocalStorage) =====
const KEY = 'bp_clientes_v1';

export const Store = {
  state: { clientes: [], filters: { q:'', nivel:'', status:'' }, scroll: { '/': 0 } },

  async init(){
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { this.state.clientes = JSON.parse(raw) || []; } catch {}
    }
    if (!raw || !Array.isArray(this.state.clientes) || this.state.clientes.length === 0) {
      this.state.clientes = await loadSeed();
      this.persist();
    }
  },

  persist(){ localStorage.setItem(KEY, JSON.stringify(this.state.clientes)); },

  async reloadFromSheets(){
    this.state.clientes = await loadSeed();
    this.persist();
  },

  list(){
    const { q, nivel, status } = this.state.filters;
    return [...this.state.clientes]
      .sort((a,b)=> (a.nome||'').localeCompare(b.nome||'', 'pt', {sensitivity:'base'}))
      .filter(c => !q || (c.nome||'').toLowerCase().includes(q.toLowerCase()))
      .filter(c => !nivel || c.nivel === nivel)
      .filter(c => !status || statusCalc(c).label === status);
  },

  byId(id){ return this.state.clientes.find(c => String(c.id) === String(id)); },

  upsert(c){
    const i = this.state.clientes.findIndex(x => String(x.id) === String(c.id));
    if (i >= 0) this.state.clientes[i] = c; else this.state.clientes.push(c);
    this.persist();
  },

  exportJSON(){
    const blob=new Blob([JSON.stringify(this.state.clientes,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`clientes-${todayISO()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  },

  async importJSON(file){
    const text=await file.text();
    const incoming=JSON.parse(text);
    const map=new Map(this.state.clientes.map(c=>[String(c.id),c]));
    for(const nc of incoming){
      const id=String(nc.id);
      if(map.has(id)){
        const base=map.get(id);
        const avs=[...(base.avaliacoes||[]), ...(nc.avaliacoes||[])];
        const seen=new Set(); const dedup=[];
        for(const a of avs){
          const key=`${a.data}|${a.pontuacao}`;
          if(!seen.has(key)){ seen.add(key); dedup.push(a); }
        }
        map.set(id, {...base, ...nc, avaliacoes: dedup.sort((a,b)=>a.data.localeCompare(b.data))});
      } else {
        map.set(id, nc);
      }
    }
    this.state.clientes=[...map.values()];
    this.persist();
  }
};

// ===== STATUS DO PLANO =====
export function statusCalc(c){
  const renov=c.renovacaoDias ?? 30;
  const hoje=todayISO();
  const dias = renov - (diffDays(hoje, c.ultimoTreino||hoje));
  if(dias >= 10) return {label:'Ativa',           klass:'st-ok'};
  if(dias >= 3)  return {label:'Perto de vencer', klass:'st-warn'};
  if(dias >= 0)  return {label:'Vence em breve',  klass:'st-soon'};
  return {label:'Vencida',         klass:'st-bad'};
}

// ===== ROTAS (SPA) =====
const idRe = '([\\w\\-+.@=]+)'; // ids com letras, números, _, -, +, ., @, =
const routes = [
  { path: new RegExp('^#\\/$'),                         view: DashboardView },
  { path: new RegExp('^#\\/cliente\\/' + idRe + '$'),   view: ClienteView },
  { path: new RegExp('^#\\/avaliacao\\/' + idRe + '$'), view: AvaliacaoView },
];

async function render(){
  const hash = location.hash || '#/';
  const match = routes.find(r => r.path.test(hash));
  const app = document.getElementById('app');
  if(!match){ app.innerHTML='<div class="card"><h2>404</h2></div>'; return; }
  const params = match.path.exec(hash).slice(1);
  const View = match.view;
  try {
    app.innerHTML = await View.template(...params);
    if (View.init) await View.init(...params);
  } catch(e){
    console.error('Render error:', e);
    app.innerHTML = `<div class="card"><h2>Erro ao montar a tela</h2><pre style="white-space:pre-wrap">${e?.message||e}</pre></div>`;
  }
  if(hash==="#/"){ requestAnimationFrame(()=> window.scrollTo(0, Store.state.scroll['/']||0)); }
}

window.addEventListener('hashchange', async ()=>{
  if(location.hash.startsWith('#/cliente') || location.hash.startsWith('#/avaliacao')){
    Store.state.scroll['/'] = window.scrollY;
  }
  await render();
});

// ===== BOOT =====
(async function(){
  await Store.init();
  if(!location.hash) location.hash = '#/';
  await render();
})();