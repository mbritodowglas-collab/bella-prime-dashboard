// Bella Prime SPA — Router + Store + Status
import { DashboardView } from './views/DashboardView.js';
import { ClienteView } from './views/ClienteView.js';
import { AvaliacaoView } from './views/AvaliacaoView.js';

// Utils de data
const todayISO = ()=>{const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),da=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${da}`;}
const parseISO = (s)=> new Date(`${s}T12:00:00`);
const diffDays = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));

// Store (LocalStorage + seed)
const KEY='bp_clientes_v1';
async function loadSeed(){
  try{
    const r=await fetch('./assets/data/seed.json',{cache:'no-store'});
    if(!r.ok) throw 0;
    return await r.json();
  }catch{
    console.warn('seed vazio');
    return [];
  }
}

export const Store = {
  state:{ clientes:[], filters:{q:'',nivel:'',status:''}, scroll:{'/':0} },
  async init(){
    const raw = localStorage.getItem(KEY);
    if(raw){ try{ this.state.clientes = JSON.parse(raw); } catch{} }
    if(!raw || this.state.clientes.length===0){
      this.state.clientes = await loadSeed();
      this.persist();
    }
  },
  persist(){ localStorage.setItem(KEY, JSON.stringify(this.state.clientes)); },
  list(){
    const {q,nivel,status} = this.state.filters;
    return [...this.state.clientes]
      .sort((a,b)=> a.nome.localeCompare(b.nome,'pt',{sensitivity:'base'}))
      .filter(c => !q || c.nome.toLowerCase().includes(q.toLowerCase()))
      .filter(c => !nivel || c.nivel===nivel)
      .filter(c => !status || statusCalc(c).label===status);
  },
  byId(id){ return this.state.clientes.find(c=> String(c.id)===String(id)); },
  upsert(c){
    const i = this.state.clientes.findIndex(x=> String(x.id)===String(c.id));
    if(i>=0) this.state.clientes[i]=c; else this.state.clientes.push(c);
    this.persist();
  },
  exportJSON(){
    const blob=new Blob([JSON.stringify(this.state.clientes,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`clientes-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
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

// Status do plano
export function statusCalc(c){
  const renov=c.renovacaoDias??30;
  const hoje=todayISO();
  const dias = renov - (diffDays(hoje, c.ultimoTreino));
  if(dias >= 10) return {label:'Ativa', klass:'st-ok'};
  if(dias >= 3)  return {label:'Perto de vencer', klass:'st-warn'};
  if(dias >= 0)  return {label:'Vence em breve', klass:'st-soon'};
  return {label:'Vencida', klass:'st-bad'};
}

// Router
const routes=[
  { path:/^#\/$/, view:DashboardView },
  { path:/^#\/cliente\/(\w+)$/, view:ClienteView },
  { path:/^#\/avaliacao\/(\w+)$/, view:AvaliacaoView },
];

async function render(){
  const hash = location.hash || '#/';
  const match = routes.find(r => r.path.test(hash));
  const app = document.getElementById('app');
  if(!match){ app.innerHTML='<div class="card"><h2>404</h2></div>'; return; }
  const params = match.path.exec(hash).slice(1);
  const View = match.view;
  app.innerHTML = await View.template(...params);
  await View.init(...params);
  if(hash==="#/"){ requestAnimationFrame(()=> window.scrollTo(0, Store.state.scroll['/']||0)); }
}

window.addEventListener('hashchange', async ()=>{
  if(location.hash.startsWith('#/cliente') || location.hash.startsWith('#/avaliacao')){
    Store.state.scroll['/'] = window.scrollY;
  }
  await render();
});

// Boot
(async function(){
  await Store.init();
  if(!location.hash) location.hash = '#/';
  await render();
})();