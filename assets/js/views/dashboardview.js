// ================================
// VIEW: Dashboard
// ================================
import { Store, statusCalc } from '../app.js';

let chartRef = null;

export const DashboardView = {
  async template(){
    const k = kpi(Store.state.clientes);
    return `
      <section class="row">
        <div class="kpi"><h4>Total</h4><div class="num">${k.total}</div></div>
        <div class="kpi"><h4>Fundação</h4><div class="num">${k.fundacao}</div></div>
        <div class="kpi"><h4>Ascensão</h4><div class="num">${k.ascensao}</div></div>
        <div class="kpi"><h4>Domínio</h4><div class="num">${k.dominio}</div></div>
        <div class="kpi"><h4>OverPrime</h4><div class="num">${k.over}</div></div>
      </section>

      <section class="card controls">
        <input class="input" id="q" placeholder="Buscar por nome..." />
        <select id="nivel" class="input">
          <option value="">Todos níveis</option>
          <option>Fundação</option><option>Ascensão</option><option>Domínio</option><option>OverPrime</option>
        </select>
        <select id="status" class="input">
          <option value="">Todos status</option>
          <option>Ativa</option><option>Perto de vencer</option><option>Vence em breve</option><option>Vencida</option>
        </select>
        <span style="flex:1"></span>
        <button class="btn btn-outline" id="syncBtn">Atualizar (Google)</button>
        <button class="btn btn-outline" id="importBtn">Importar</button>
        <input type="file" id="file" style="display:none" accept="application/json" />
        <button class="btn btn-primary" id="exportBtn">Exportar JSON</button>

        <!-- Novos controles para exportar/copiar todas as respostas -->
        <button class="btn btn-ghost" id="copyCsvBtn" title="Gerar CSV e copiar">Copiar CSV</button>
        <button class="btn btn-ghost" id="copyJsonLinesBtn" title="Gerar JSON Lines e copiar">Copiar JSONL</button>
      </section>

      <section class="card chart-card">
        <canvas id="chartNiveis" height="140"></canvas>
      </section>

      <section class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Nível</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th style="width:180px;text-align:right;">Ações</th> <!-- largura maior -->
            </tr>
          </thead>
        <tbody id="tbody"></tbody>
        </table>
        <div id="empty" style="display:none;padding:12px;color:#aaa">Sem clientes para exibir.</div>
      </section>
    `;
  },

  async init(){
    const $ = s => document.querySelector(s);

    // filtros – estado inicial
    $('#q').value = Store.state.filters.q || '';
    $('#nivel').value = Store.state.filters.nivel || '';
    $('#status').value = Store.state.filters.status || '';

    const renderTable = () => {
      const list = Store.list();
      const body = document.getElementById('tbody');
      const empty = document.getElementById('empty');

      if(list.length === 0){
        body.innerHTML = '';
        empty.style.display = 'block';
      } else {
        empty.style.display = 'none';
        body.innerHTML = list.map(rowHTML).join('');
      }

      body.querySelectorAll('a[data-id]').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          location.hash = `#/cliente/${a.dataset.id}`;
        });
      });

      body.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = e.currentTarget.dataset.id;
          const nome = e.currentTarget.dataset.nome;
          if (confirm(`Deseja realmente excluir ${nome}?`)) {
            Store.state.clientes = Store.state.clientes.filter(c => String(c.id) !== String(id));
            Store.persist();
            chartNiveis();
            renderTable();
          }
        });
      });
    };

    const debounce = (fn, ms=200)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms);} };
    $('#q').addEventListener('input', debounce(e => { Store.state.filters.q = e.target.value; renderTable(); }));
    $('#nivel').addEventListener('change', e => { Store.state.filters.nivel = e.target.value; renderTable(); });
    $('#status').addEventListener('change', e => { Store.state.filters.status = e.target.value; renderTable(); });

    document.getElementById('exportBtn').addEventListener('click', () => Store.exportJSON?.());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('file').click());
    document.getElementById('file').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      await Store.importJSON?.(f);
      chartNiveis();
      renderTable();
      e.target.value = '';
    });

    document.getElementById('syncBtn').addEventListener('click', async ()=>{
      const btn = document.getElementById('syncBtn');
      const old = btn.textContent;
      btn.disabled = true; btn.textContent = 'Atualizando...';
      try{
        await Store.reloadFromSheets();
        Store.state.filters = { q:'', nivel:'', status:'' };
        $('#q').value=''; $('#nivel').value=''; $('#status').value='';
        chartNiveis();
        renderTable();
      } finally {
        btn.disabled = false; btn.textContent = old;
      }
    });

    // --- Novas ações: copiar CSV / JSONL (com métricas normalizadas) ---
    $('#copyCsvBtn').addEventListener('click', async ()=>{
      const csv = formatCSVWithMetrics(Store.state.clientes);
      await copyToClipboard(csv);
      toast('CSV copiado para o clipboard.');
    });

    $('#copyJsonLinesBtn').addEventListener('click', async ()=>{
      const jl = formatJSONLinesWithMetrics(Store.state.clientes);
      await copyToClipboard(jl);
      toast('JSON Lines copiado para o clipboard.');
    });

    chartNiveis();
    renderTable();
  }
};

function rowHTML(c){
  const status = statusCalc(c);
  const klass = {
    'Fundação': 'level-fundacao',
    'Ascensão': 'level-ascensao',
    'Domínio':   'level-dominio',
    'OverPrime': 'level-overprime'
  }[c.nivel] || 'level-fundacao';

  return `
    <tr>
      <td>${escapeHTML(c.nome || '')}</td>
      <td><span class="badge ${klass}">${c.nivel}</span></td>
      <td>${c.ultimoTreino || '-'}</td>
      <td><span class="status ${status.klass}">${status.label}</span></td>
      <td style="text-align:right;white-space:nowrap;">
        <div style="display:inline-flex;gap:8px;">
          <a href="#" data-id="${c.id}" class="btn btn-outline" style="padding:4px 10px;">Ver</a>
          <a href="#/relatorio/${c.id}" class="btn btn-outline" style="padding:4px 10px;">🧾 Relatório</a>
          <button class="btn btn-danger btn-del" data-id="${c.id}" data-nome="${escapeHTML(c.nome || '')}" title="Excluir" style="padding:4px 10px;">🗑️</button>
        </div>
      </td>
    </tr>`;
}

function kpi(arr){
  const total = arr.length;
  const by = arr.reduce((a, c) => { a[c.nivel] = (a[c.nivel] || 0) + 1; return a; }, {});
  return {
    total,
    fundacao: by['Fundação'] || 0,
    ascensao: by['Ascensão'] || 0,
    dominio:  by['Domínio']   || 0,
    over:     by['OverPrime'] || 0
  };
}

function chartNiveis(){
  const el = document.getElementById('chartNiveis');
  if (!el) return;
  if (chartRef) chartRef.destroy();
  if (typeof window.Chart !== 'function') return; // fail-safe

  const arr = Store.state.clientes;
  chartRef = new Chart(el, {
    type: 'bar',
    data: {
      labels: ['Fundação', 'Ascensão', 'Domínio', 'OverPrime'],
      datasets: [{
        label: 'Distribuição por Nível',
        data: [
          arr.filter(c => c.nivel === 'Fundação').length,
          arr.filter(c => c.nivel === 'Ascensão').length,
          arr.filter(c => c.nivel === 'Domínio').length,
          arr.filter(c => c.nivel === 'OverPrime').length,
        ],
        borderWidth: 1
      }]
    },
    options: { responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

// ---------- utilidades de exportação / clipboard ----------
function safeCell(v){
  if (v === null || v === undefined) return '';
  return String(v).replace(/\r?\n/g,' ').replace(/"/g,'""');
}

// === Nova camada de normalização (última avaliação + métricas) ===
function pick(obj, keys){
  for (const k of keys){
    const val = obj?.[k];
    if (val != null && String(val).trim() !== '') return val;
  }
  return undefined;
}
const toNum = v => v == null ? undefined : Number(String(v).replace(',', '.'));
function isFiniteNum(v){ return Number.isFinite(toNum(v)); }

function latestEval(cliente){
  const avs = Array.isArray(cliente?.avaliacoes) ? cliente.avaliacoes.slice() : [];
  if (avs.length === 0) return {};
  avs.sort((a,b)=> (a.data||'').localeCompare(b.data||''));
  const last = avs[avs.length - 1] || {};

  const peso    = toNum(pick(last, ["peso","Peso (kg)","peso_kg"]));
  const cintura = toNum(pick(last, ["cintura","Cintura (cm)","cintura_cm"]));
  const quadril = toNum(pick(last, ["quadril","Quadril (cm)","quadril_cm"]));
  const abdome  = toNum(pick(last, ["abdome","Abdome (cm)","Abdome","abdome_cm"]));
  let   altura  = toNum(pick(last, ["altura","Altura (cm)","altura_cm","Altura (m)","altura_m"]));
  if (isFiniteNum(altura) && altura > 0 && altura <= 3) altura = altura * 100; // m -> cm

  const rcq = (isFiniteNum(cintura) && isFiniteNum(quadril) && quadril) ? (cintura / quadril) : undefined;
  const rce = (isFiniteNum(cintura) && isFiniteNum(altura) && altura) ? (cintura / altura) : (isFiniteNum(last?.whtr) ? Number(last.whtr) : undefined);

  return { data:last.data || '', peso, cintura, quadril, abdome, altura, rcq, rce };
}

// CSV com métricas normalizadas
function formatCSVWithMetrics(arr){
  if(!Array.isArray(arr)) return '';
  const fields = [
    'id','nome','contato','email','cidade','nivel','pontuacao','ultimoTreino','objetivo',
    // métricas da última avaliação (normalizadas)
    'data_avaliacao','peso','cintura','quadril','abdome','rcq','rce'
  ];
  const header = fields.join(',');
  const rows = arr.map(o => {
    const m = latestEval(o);
    const row = {
      id: o.id, nome: o.nome, contato: o.contato, email: o.email, cidade: o.cidade,
      nivel: o.nivel, pontuacao: o.pontuacao, ultimoTreino: o.ultimoTreino, objetivo: o.objetivo,
      data_avaliacao: m.data || '',
      peso:    isFinite(m.peso)    ? String(m.peso).replace('.', ',') : '',
      cintura: isFinite(m.cintura) ? String(m.cintura).replace('.', ',') : '',
      quadril: isFinite(m.quadril) ? String(m.quadril).replace('.', ',') : '',
      abdome:  isFinite(m.abdome)  ? String(m.abdome).replace('.', ',') : '',
      rcq:     isFinite(m.rcq)     ? String(m.rcq.toFixed(3)).replace('.', ',') : '',
      rce:     isFinite(m.rce)     ? String(m.rce.toFixed(3)).replace('.', ',') : ''
    };
    return fields.map(f => `"${safeCell(row[f])}"`).join(',');
  });
  return [header, ...rows].join('\n');
}

// JSON Lines com métricas normalizadas
function formatJSONLinesWithMetrics(arr){
  if(!Array.isArray(arr)) return '';
  return arr.map(o => {
    const m = latestEval(o);
    return JSON.stringify({
      id: o.id, nome: o.nome, contato: o.contato, email: o.email, cidade: o.cidade,
      nivel: o.nivel, pontuacao: o.pontuacao, ultimoTreino: o.ultimoTreino, objetivo: o.objetivo,
      avaliacao: {
        data: m.data || null,
        peso: m.peso ?? null,
        cintura: m.cintura ?? null,
        quadril: m.quadril ?? null,
        abdome: m.abdome ?? null,
        altura_cm: m.altura ?? null,
        rcq: m.rcq ?? null,
        rce: m.rce ?? null
      }
    });
  }).join('\n');
}

// === Versões anteriores (mantidas, se quiser usar em outro ponto) ===
function formatCSV(arr){
  if(!Array.isArray(arr)) return '';
  const fields = ['id','nome','contato','email','cidade','nivel','pontuacao','ultimoTreino','objetivo'];
  const header = fields.join(',');
  const rows = arr.map(o => fields.map(f => `"${safeCell(o[f])}"`).join(','));
  return [header, ...rows].join('\n');
}

function formatJSONLines(arr){
  if(!Array.isArray(arr)) return '';
  return arr.map(o => JSON.stringify(o)).join('\n');
}

async function copyToClipboard(text){
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch(e){
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e2) { console.warn('copy fallback failed', e2); }
    document.body.removeChild(ta);
    return false;
  }
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// ---------- toast simples ----------
let toastT = null;
function toast(msg, error=false){
  let el = document.getElementById('toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.style.position = 'fixed';
    el.style.right = '16px';
    el.style.bottom = '16px';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = error ? 'rgba(183,28,28,.95)' : 'rgba(212,175,55,.95)';
  el.style.color = '#0b0b0b';
  el.style.padding = '10px 14px';
  el.style.borderRadius = '10px';
  el.style.fontWeight = '600';
  clearTimeout(toastT);
  toastT = setTimeout(()=> el.style.display = 'none', 2600);
}