// =====================================
// BELLA PRIME · APP PRINCIPAL (robusto + simples)
// =====================================

// imports (atenção ao case dos nomes dos arquivos)
import { DashboardView } from './views/dashboardview.js';
import { ClienteView }   from './views/clienteview.js';
import { AvaliacaoView } from './views/avaliacaoview.js';

// === CONFIG DA API (Google Apps Script publicado) ===
const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwsOtURP_fuMDzfxysaeVITPZkl2GfRXfz7io9plgAFsgbpScIZGzVTHaRfWPepZv26/exec';

// === Datas utilitárias ===
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const parseISO = (s) => new Date(`${s}T12:00:00`);
const diffDays = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));

// === Fonte de dados (Sheets -> seed.json) ===
async function loadSeed(){
  try{
    const r = await fetch(SHEETS_API, { cache:'no-store' });
    if(!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
    const data = await r.json();
    if(!Array.isArray(data)) throw new Error('Sheets retornou formato inválido');
    return data;
  }catch(e){
    console.warn('⚠️ Falha Sheets, usando seed.json:', e);
    const r2 = await fetch('./assets/data/seed.json', { cache:'no-store' });
    return await r2.json();
  }
}

// === STORE (dados locais) ===
const KEY = 'bp_clientes_v1';

export const Store = {
  state: { clientes: [], filters:{ q:'', nivel:'', status:'' }, scroll:{ '/':0 } },

  async init(){
    try{
      const dados = await loadSeed();

      // Normalização dos registros
      const norm = (dados || []).map(raw => {
        const c = { ...raw };

        // 1) Cidade - Estado -> cidade
        if (!c.cidade && c['Cidade - Estado']) {
          c.cidade = c['Cidade - Estado'];
          delete c['Cidade - Estado'];
        }

        // 2) Campos padrão
        c.id = String(c.id ?? c.email ?? c.contato ?? cryptoRandom());
        c.avaliacoes = Array.isArray(c.avaliacoes) ? c.avaliacoes : [];
        return c;
      });

      this.state.clientes = norm;
      localStorage.setItem(KEY, JSON.stringify(this.state.clientes));
      console.log(`✅ ${this.state.clientes.length} clientes carregadas.`);
    }catch(e){
      console.error('❌ Falha ao inicializar dados', e);
      this.state.clientes = [];
    }
  },

  async reloadFromSheets(){
    await this.init();
  },

  persist(){ localStorage.setItem(KEY, JSON.stringify(this.state.clientes)); },

  list(){
    const { q, nivel, status } = this.state.filters;
    return [...this.state.clientes]
      .sort((a,b)=> (a.nome||'').localeCompare(b.nome||'','pt',{sensitivity:'base'}))
      .filter(c => !q || (c.nome||'').toLowerCase().includes(q.toLowerCase()))
      .filter(c => !nivel || c.nivel === nivel)
      .filter(c => !status || statusCalc(c).label === status);
  },

  byId(id){ return this.state.clientes.find(c => String(c.id) === String(id)); },

  upsert(c){
    const i = this.state.clientes.findIndex(x => String(x.id) === String(c.id));
    if (i >= 0) this.state.clientes[i] = c; else this.state.clientes.push(c);
    this.persist();
  }
};

// util para criar id quando faltar tudo
function cryptoRandom(){
  try { return crypto.randomUUID(); } catch { return 'id_' + Math.random().toString(36).slice(2,9); }
}

// === STATUS (vence/ativa) ===
export function statusCalc(c){
  const renov = c.renovacaoDias ?? 30;
  const hoje  = todayISO();
  const dias  = renov - (diffDays(hoje, c.ultimoTreino || hoje));
  if (dias >= 10) return { label:'Ativa',           klass:'st-ok'   };
  if (dias >= 3)  return { label:'Perto de vencer', klass:'st-warn' };
  if (dias >= 0)  return { label:'Vence em breve',  klass:'st-soon' };
  return            { label:'Vencida',              klass:'st-bad'  };
}

// === Router simples (hash) ===
const idRe = '([\\w\\-+.@=]+)';
const routes = [
  { path: new RegExp('^#\\/$'),                         view: DashboardView },
  { path: new RegExp('^#\\/cliente\\/' + idRe + '$'),   view: ClienteView   },
  { path: new RegExp('^#\\/avaliacao\\/' + idRe + '$'), view: AvaliacaoView },
];

async function render(){
  const hash = location.hash || '#/';
  const match = routes.find(r => r.path.test(hash));
  const app = document.getElementById('app');
  if(!match){ app.innerHTML = '<div class="card"><h2>404</h2></div>'; return; }
  const params = match.path.exec(hash).slice(1);
  const View   = match.view;
  app.innerHTML = await View.template(...params);
  if (View.init) await View.init(...params);
}

window.addEventListener('hashchange', render);

// === Boot: abre no dashboard ===
(async () => {
  await Store.init();
  if (!location.hash) location.hash = '#/';
  await render();
})();