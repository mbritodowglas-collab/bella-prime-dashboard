// Bella Prime SPA — Router + Store + Status + Google Sheets sync

import { DashboardView } from './views/DashboardView.js';
import { ClienteView } from './views/ClienteView.js';
import { AvaliacaoView } from './views/AvaliacaoView.js';
import { pontuar, classificar } from './avaliacao.js'; // motor de pontuação

// ===== Utils de data =====
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
};
const parseISO = (s)=> new Date(`${s}T12:00:00`);
const diffDays = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));

// ===== Fonte de dados (LocalStorage + Google Sheets) =====
const KEY = 'bp_clientes_v1';

// URL da tua API (Apps Script) — já com cache bust
const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwni99x2tbrMYfwqqr5QeiQ3m88oKY07Zn0nrJ58cWMfb8_44J5n_oQKmQQjoH8ek3q/exec';

async function loadSeed(){
  try{
    const url = `${SHEETS_API}?t=${Date.now()}`;
    const r = await fetch(url, { cache:'no-store' });
    if(!r.ok) throw new Error('Falha ao buscar planilha');
    const rows = await r.json();

    const norm = (v)=> (v ?? '').toString().trim().toLowerCase();
    const intSafe = (v)=> { const n=parseInt((v??'').toString().replace(/\D+/g,''),10); return isNaN(n)?0:n; };

    // extrai “n treinamentos/semana” de textos do Forms
    function parseFreq(txt){
      const t = norm(txt);
      const m = t.match(/(\d+)/);
      if(m) return Number(m[1]);
      if(t.includes('diar') || t.includes('todos os dias')) return 7;
      if(t.includes('nenhuma') || t.includes('0')) return 0;
      return 0;
    }
    // traduz descrições (ruim/bom/ótimo etc.) para escala 1–5
    function scale5(txt){
      const t = norm(txt);
      if(/(péssim|horr|muito ruim)/.test(t)) return 1;
      if(/(ruim|baixo)/.test(t)) return 2;
      if(/(regular|médio|moderado|medio)/.test(t)) return 3;
      if(/(bom|boa)/.test(t)) return 4;
      if(/(excelente|ótim|otim)/.test(t)) return 5;
      return 3;
    }

    // mapeia cada linha da planilha para cliente do app
    return rows.map((x,i)=>{
      const nome  = x.nome || x["Nome completo"] || 'Sem nome';
      const whats = x.whatsapp || x["Whatsapp"] || '';
      const email = x.email || x["E-mail"] || '';
      const obj   = x.objetivo || x["Qual o seu objetivo?"] || '';
      const freq  = parseFreq(x.frequenciaSemanal || x["Quantas vezes pode treinar por semana?"]);
      const estaT = /sim/.test(norm(x.estaTreinando || x["Está treinando?"] || 'não'));
      const sono  = scale5(x.sono || x["Qualidade de sono"]);
      const est   = scale5(x.estresse || x["Estresse diário"]);
      const comp  = intSafe(x.comprometimento || x["🔥 De 1 a 10, qual o seu nível de comprometimento com essa mudança?"]);

      // monta objeto de respostas para o motor de pontuação
      const respostas = {
        estaTreinando: estaT,
        frequenciaSemanal: freq,
        sono,
        dorLesao: 0,
        estresse: est,
        comprometimento: comp,
        planoAlimentar: 'nao',
        acompanhamentoProfissional: false
      };
      const p = pontuar(respostas);
      const n = classificar(p, []);

      const hoje = todayISO();

      return {
        id: String(x.id ?? i+1),
        nome,
        contato: whats,
        email,
        objetivo: obj,
        nivel: n,
        pontuacao: p,
        ultimoTreino: hoje,
        status: 'Ativa',
        cidade: '',
        avaliacoes: [{ data: hoje, pontuacao: p, nivel: n }]
      };
    });
  }catch(e){
    console.error('Erro ao ler Google Sheets:', e);
    return [];
  }
}

// ===== Store =====
export const Store = {
  state:{ clientes:[], filters:{q:'',nivel:'',status:''}, scroll:{'/':0} },

  async init(){
    const raw = localStorage.getItem(KEY);
    if(raw){ try{ this.state.clientes = JSON.parse(raw); } catch{ /* ignora */ } }
    if(!raw || this.state.clientes.length===0){
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

// ===== Status do plano =====
export function statusCalc(c){
  const renov=c.renovacaoDias??30;
  const hoje=todayISO();
  const dias = renov - (diffDays(hoje, c.ultimoTreino));
  if(dias >= 10) return {label:'Ativa', klass:'st-ok'};
  if(dias >= 3)  return {label:'Perto de vencer', klass:'st-warn'};
  if(dias >= 0)  return {label:'Vence em breve', klass:'st-soon'};
  return {label:'Vencida', klass:'st-bad'};
}

// ===== Router =====
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

// ===== Boot =====
(async function(){
  await Store.init();
  if(!location.hash) location.hash = '#/';
  await render();
})();