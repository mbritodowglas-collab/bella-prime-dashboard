// =====================================
// BELLA PRIME · APP (DIAGNÓSTICO FORTE)
// Mostra no DOM cada fase de boot e captura qualquer erro.
// =====================================

const logBox = (() => {
  const el = document.createElement('pre');
  el.id = 'diag';
  el.style.cssText = 'background:#111;border:1px solid #333;color:#d4af37;padding:10px;border-radius:8px;margin:16px 0;white-space:pre-wrap';
  const host = document.getElementById('app') || document.body;
  host.prepend(el);
  const w = (m) => { el.textContent += (el.textContent ? '\n' : '') + m; };
  return { write: w, el };
})();

function ok(step){ logBox.write('✅ ' + step); }
function fail(step, err){ logBox.write('❌ ' + step + ' → ' + (err?.message || err)); }

// --- Passo 1: ambiente básico
try {
  ok('Boot: index carregou JS (app.js)');
  if (!('fetch' in window)) throw new Error('fetch ausente');
} catch (e) {
  fail('Checagem ambiente', e);
}

// --- Passo 2: Chart.js presente?
try {
  if (window.Chart) ok('Chart.js disponível');
  else ok('Chart.js ainda não disponível (sem problema — só o gráfico depende).');
} catch (e) {
  fail('Chart.js', e);
}

// --- Passo 3: importar views (case-sensitive)
let DashboardView, ClienteView, AvaliacaoView;
try {
  ({ DashboardView } = await import('./views/dashboardview.js'));
  ({ ClienteView }   = await import('./views/clienteview.js'));
  ({ AvaliacaoView } = await import('./views/avaliacaoview.js'));
  ok('Views importadas: dashboardview.js, clienteview.js, avaliacaoview.js');
} catch (e) {
  fail('Import de views', e);
  throw e;
}

// --- Passo 4: helpers de data
const todayISO = () => {
  const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
};
const parseISO = (s)=> new Date(`${s}T12:00:00`);
const diffDays = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));

// --- Passo 5: fonte de dados (Sheets → seed.json)
const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwsOtURP_fuMDzfxysaeVITPZkl2GfRXfz7io9plgAFsgbpScIZGzVTHaRfWPepZv26/exec';

async function loadSeed(){
  // tenta Sheets
  try{
    const r = await fetch(SHEETS_API, { cache:'no-store', mode:'cors' });
    if(!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
    const data = await r.json();
    if(!Array.isArray(data)) throw new Error('Formato inválido da API');
    ok(`Sheets OK: ${data.length} clientes`);
    return data;
  }catch(e){
    fail('Sheets falhou, caindo para seed.json', e);
  }
  // seed.json
  try{
    const r = await fetch('./assets/data/seed.json?v=diag', { cache:'no-store' });
    if(!r.ok) throw new Error(`seed.json HTTP ${r.status}`);
    const data = await r.json();
    ok(`seed.json OK: ${data.length} clientes`);
    return data;
  }catch(e){
    fail('seed.json falhou', e);
    return [];
  }
}

// --- Passo 6: Store (com logs)
const KEY = 'bp_clientes_v1';
export const Store = {
  state:{ clientes:[], filters:{q:'',nivel:'',status:''}, scroll:{'/':0} },
  async init(){
    ok('Store.init()');
    const raw = localStorage.getItem(KEY);
    if(raw){
      try{ this.state.clientes = JSON.parse(raw) || []; ok(`LocalStorage: ${this.state.clientes.length} clientes`); }catch{}
    }
    if(!raw || this.state.clientes.length===0){
      this.state.clientes = await loadSeed();
      this.persist();
      ok(`Dados carregados: ${this.state.clientes.length}`);
    }
  },
  persist(){ localStorage.setItem(KEY, JSON.stringify(this.state.clientes)); },
  async reloadFromSheets(){ this.state.clientes = await loadSeed(); this.persist(); },
  list(){
    const {q,nivel,status} = this.state.filters;
    return [...this.state.clientes]
      .sort((a,b)=> (a.nome||'').localeCompare(b.nome||'','pt',{sensitivity:'base'}))
      .filter(c => !q || (c.nome||'').toLowerCase().includes(q.toLowerCase()))
      .filter(c => !nivel || c.nivel===nivel)
      .filter(c => !status || statusCalc(c).label===status);
  },
  byId(id){ return this.state.clientes.find(c=> String(c.id)===String(id)); },
  upsert(c){ const i=this.state.clientes.findIndex(x=>String(x.id)===String(c.id)); if(i>=0) this.state.clientes[i]=c; else this.state.clientes.push(c); this.persist(); },
  exportJSON(){ const blob=new Blob([JSON.stringify(this.state.clientes,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`clientes-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href); },
  async importJSON(file){
    const text=await file.text(); const incoming=JSON.parse(text);
    const map=new Map(this.state.clientes.map(c=>[String(c.id),c]));
    for(const nc of incoming){
      const id=String(nc.id);
      if(map.has(id)){
        const base=map.get(id);
        const avs=[...(base.avaliacoes||[]), ...(nc.avaliacoes||[])];
        const seen=new Set(); const dedup=[];
        for(const a of avs){ const k=`${a.data}|${a.pontuacao}`; if(!seen.has(k)){ seen.add(k); dedup.push(a); } }
        map.set(id,{...base,...nc,avaliacoes:dedup.sort((a,b)=>a.data.localeCompare(b.data))});
      } else { map.set(id,nc); }
    }
    this.state.clientes=[...map.values()]; this.persist();
  }
};

export function statusCalc(c){
  const renov=c.renovacaoDias??30;
  const hoje=todayISO();
  const dias=renov - (diffDays(hoje, c.ultimoTreino||hoje));
  if(dias>=10) return {label:'Ativa',klass:'st-ok'};
  if(dias>=3)  return {label:'Perto de vencer',klass:'st-warn'};
  if(dias>=0)  return {label:'Vence em breve',klass:'st-soon'};
  return {label:'Vencida',klass:'st-bad'};
}

// --- Passo 7: Router
const idRe = '([\\w\\-+.@=]+)';
const routes = [
  { path: new RegExp('^#\\/$'),                         view: DashboardView },
  { path: new RegExp('^#\\/cliente\\/' + idRe + '$'),   view: ClienteView },
  { path: new RegExp('^#\\/avaliacao\\/' + idRe + '$'), view: AvaliacaoView },
];

async function render(){
  const hash = location.hash || '#/';
  const app = document.getElementById('app');
  try{
    const match = routes.find(r => r.path.test(hash));
    if(!match){ app.innerHTML='<div class="card"><h2>404</h2></div>'; return; }
    const params = match.path.exec(hash).slice(1);
    const View = match.view;
    ok('Render: ' + hash);
    app.innerHTML = await View.template(...params);
    if(View.init) await View.init(...params);
  }catch(e){
    fail('Render', e);
    app.innerHTML = `<div class="card"><h2>Erro</h2><pre>${e?.message||e}</pre></div>`;
  }
}
window.addEventListener('hashchange', async ()=>{
  if(location.hash.startsWith('#/cliente')||location.hash.startsWith('#/avaliacao')){
    Store.state.scroll['/']=window.scrollY;
  }
  await render();
});

// --- Passo 8: Boot
(async function(){
  try{
    await Store.init();
    if(!location.hash) location.hash = '#/';
    await render();
    ok('Boot concluído');
  }catch(e){
    fail('Boot geral', e);
  }
})();