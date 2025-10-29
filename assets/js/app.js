// =====================================
// BELLA PRIME · APP PRINCIPAL (versão simplificada)
// =====================================

// importa as views
import { DashboardView } from './views/dashboardview.js';
import { ClienteView }   from './views/clienteview.js';
import { AvaliacaoView } from './views/avaliacaoview.js';

// === CONFIGURAÇÃO DA API (Google Sheets) ===
const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwsOtURP_fuMDzfxysaeVITPZkl2GfRXfz7io9plgAFsgbpScIZGzVTHaRfWPepZv26/exec';

// === FUNÇÕES DE DATA ===
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// === FUNÇÃO DE CARGA ===
async function loadSeed(){
  try {
    const r = await fetch(SHEETS_API, { cache: 'no-store' });
    if(!r.ok) throw new Error('Erro na API');
    return await r.json();
  } catch(e){
    console.warn('⚠️ Falha ao buscar Google Sheets, usando seed.json', e);
    const r = await fetch('./assets/data/seed.json');
    return await r.json();
  }
}

// === STORE (dados locais) ===
export const Store = {
  state: { clientes: [] },

  async init(){
    try {
      const dados = await loadSeed();
      this.state.clientes = Array.isArray(dados) ? dados : [];
      console.log(`✅ ${this.state.clientes.length} clientes carregadas.`);
    } catch(e){
      console.error('❌ Falha ao inicializar dados', e);
    }
  }
};

// === STATUS DE CLIENTE ===
export function statusCalc(c){
  const hoje = todayISO();
  const diff = Math.floor((new Date(hoje) - new Date(c.ultimoTreino || hoje)) / 86400000);
  if (diff < 20) return { label: 'Ativa', klass: 'st-ok' };
  if (diff < 30) return { label: 'Perto de vencer', klass: 'st-warn' };
  return { label: 'Vencida', klass: 'st-bad' };
}

// === FUNÇÃO DE RENDERIZAÇÃO SIMPLIFICADA ===
async function render(view){
  const app = document.getElementById('app');
  app.innerHTML = await view.template();
  if(view.init) await view.init();
}

// === INÍCIO DIRETO NO DASHBOARD ===
(async () => {
  await Store.init();
  await render(DashboardView);
})();