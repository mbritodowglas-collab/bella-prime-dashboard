// ================================
// VIEW: Dashboard
// ================================
import { Store, statusCalc } from '../app.js';

let chartRef = null;        // barras (níveis)
let pesoChart = null;       // linha (peso)
let rcqChart  = null;       // linha (RCQ)
let whtrChart = null;       // linha (WHtR/RCE)

export const DashboardView = {
  async template(){
    const k = kpi(Store.state.clientes);
    // pega a 1ª cliente da lista filtrada para os gráficos de métricas
    const firstClient = (Store.list() || [])[0];

    // CSS do modal de mensagens
    const modalCSS = `
      <style>
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;z-index:9998}
        .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999}
        .modal.show,.modal-backdrop.show{display:flex}
        .modal-card{width:min(860px,92vw);max-height:86vh;overflow:auto;background:#121316;border:1px solid var(--border);
          border-radius:14px;box-shadow:var(--shadow);padding:14px}
        .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .modal-grid{display:grid;grid-template-columns:1fr;gap:10px}
        .msg-item{border:1px solid var(--border);border-radius:12px;padding:10px;background:rgba(255,255,255,.02)}
        .msg-actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
        .msg-title{font-weight:700;margin:0 0 6px}
        .msg-text{white-space:pre-wrap}
        @media(min-width:760px){ .modal-grid{grid-template-columns:1fr 1fr} }
      </style>
    `;

    return `
      ${modalCSS}

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
        <button class="btn btn-outline" id="copyCsvBtn" title="Gerar CSV e copiar">Copiar CSV</button>
        <button class="btn btn-outline" id="copyJsonLinesBtn" title="Gerar JSON Lines e copiar">Copiar JSONL</button>

        <!-- Botão para abrir o modal de mensagens -->
        <button class="btn btn-outline" id="openMsgBtn">💬 Mensagens rápidas</button>
      </section>

      <section class="card chart-card">
        <canvas id="chartNiveis" height="140"></canvas>
      </section>

      ${firstClient ? `
        <section class="card chart-card">
          <h3 style="margin-top:0">Evolução do Peso (kg) — ${escapeHTML(firstClient.nome||'')}</h3>
          <div id="pesoEmpty" style="display:none;color:#aaa">Sem dados de peso suficientes.</div>
          <canvas id="dashPeso" height="160"></canvas>
        </section>

        <section class="card chart-card">
          <h3 style="margin-top:0">Relação Cintura/Quadril (RCQ)</h3>
          <small class="muted">cintura ÷ quadril • alvo prático (mulheres): ≲ 0,85</small>
          <div id="rcqEmpty" style="display:none;color:#aaa">Sem dados de cintura/quadril suficientes.</div>
          <canvas id="dashRCQ" height="160"></canvas>
        </section>

        <section class="card chart-card">
          <h3 style="margin-top:0">RCE / WHtR (cintura/estatura)</h3>
          <small class="muted">regra de bolso: manter &lt; 0,50 (cintura menor que metade da altura)</small>
          <div id="whtrEmpty" style="display:none;color:#aaa">Sem dados de cintura/estatura suficientes.</div>
          <canvas id="dashWHtR" height="160"></canvas>
        </section>
      ` : ''}

      <section class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Nível</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th style="width:220px;text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
        <div id="empty" style="display:none;padding:12px;color:#aaa">Sem clientes para exibir.</div>
      </section>

      <!-- Modal de Mensagens Rápidas -->
      <div class="modal-backdrop" id="msgBackdrop"></div>
      <div class="modal" id="msgModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 style="margin:0">💬 Modelos de Mensagens</h3>
            <button class="btn btn-outline" id="msgCloseBtn">Fechar</button>
          </div>
          <div class="modal-grid">
            ${msgTemplate(1, 'Boas-vindas + Avaliação + Blog')}
            ${msgTemplate(2, 'Boas-vindas + eBook Bella Prime (permite enviar?)')}
            ${msgTemplate(3, 'Pós-formulário — Solicitar 3 fotos')}
            ${msgTemplate(4, 'Follow-up — Relembrar envio das fotos')}
            ${msgTemplate(5, 'Oferta leve — “Posso te enviar o eBook Bella Prime?”')}
          </div>
        </div>
      </div>
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
            renderMetricCharts(); // re-render métricas (pode mudar 1ª cliente)
          }
        });
      });
    };

    const debounce = (fn, ms=200)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms);} };
    $('#q').addEventListener('input', debounce(e => { Store.state.filters.q = e.target.value; renderTable(); renderMetricCharts(); }));
    $('#nivel').addEventListener('change', e => { Store.state.filters.nivel = e.target.value; renderTable(); renderMetricCharts(); });
    $('#status').addEventListener('change', e => { Store.state.filters.status = e.target.value; renderTable(); renderMetricCharts(); });

    document.getElementById('exportBtn').addEventListener('click', () => Store.exportJSON?.());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('file').click());
    document.getElementById('file').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      await Store.importJSON?.(f);
      chartNiveis();
      renderTable();
      renderMetricCharts();
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
        renderMetricCharts();
      } finally {
        btn.disabled = false; btn.textContent = old;
      }
    });

    // --- Novas ações: copiar CSV / JSONL (com métricas normalizadas) ---
    document.getElementById('copyCsvBtn').addEventListener('click', async ()=>{
      const csv = formatCSVWithMetrics(Store.state.clientes);
      await copyToClipboard(csv);
      toast('CSV copiado para o clipboard.');
    });

    document.getElementById('copyJsonLinesBtn').addEventListener('click', async ()=>{
      const jl = formatJSONLinesWithMetrics(Store.state.clientes);
      await copyToClipboard(jl);
      toast('JSON Lines copiado para o clipboard.');
    });

    // Renderizações iniciais
    chartNiveis();
    renderTable();
    renderMetricCharts(); // gráficos Peso/RCQ/WHtR

    // ===== Modal de Mensagens =====
    const modal = $('#msgModal'); const back = $('#msgBackdrop');
    const openBtn = $('#openMsgBtn'); const closeBtn = $('#msgCloseBtn');

    openBtn.addEventListener('click',()=>{
      modal.classList.add('show');
      back.classList.add('show');
    });
    closeBtn.addEventListener('click',()=>{
      modal.classList.remove('show');
      back.classList.remove('show');
    });
    back.addEventListener('click',()=>{
      modal.classList.remove('show');
      back.classList.remove('show');
    });

    // === Mensagens rápidas ===
    const BLOG = 'https://mbritodowglas-collab.github.io/mdpersonal/';
    const AVAL = 'https://mbritodowglas-collab.github.io/mdpersonal/avaliacao';

    const msgs = {
      msg1: `Oi! 👋 Seja bem-vinda!\nAqui eu falo sobre *treino feminino*, *emagrecimento real* e *neurociência de hábitos*.\n\nTe envio o link da **avaliação gratuita** pra montar teu diagnóstico? 💪✨\n\nAvaliação: ${AVAL}\nBlog: ${BLOG}`,
      msg2: `Oi! 🌹 Bem-vinda!\nTenho um material chamado **Bella Prime™** — um método que une treino, mente e hábitos.\nQuer dar uma olhada no conceito? 💫`,
      msg3: `Oi 👋\nRecebi teu formulário e preciso só de 3 fotos (frente, costas e de lado) pra montar o diagnóstico.\nTop e short ou legging preta, boa luz e postura natural.\nSe preferir, te envio a imagem-guia. 📸`,
      msg4: `Oi! 👋\nVi que preencheu o formulário mas ainda não recebi as fotos.\nSem elas não consigo ajustar o plano. Quer que te mande o exemplo de como tirar? 📸`,
      msg5: `Oi! 🌸 Tudo bem?\nTenho um eBook que explica como o *Tratamento Bella Prime* funciona — com treino, neurociência e mudança de hábitos.\nQuer que eu te envie pra dar uma olhada? 💪✨`
    };

    // Preenche os blocos do modal
    for (const k in msgs) {
      const el = document.getElementById(k);
      if (el) el.textContent = msgs[k];
    }

    // Botões copiar/whatsapp
    document.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const target = document.querySelector(btn.dataset.copy);
        if (!target) return;
        copyToClipboard(target.textContent);
        toast('Mensagem copiada!');
      });
    });
    document.querySelectorAll('[data-wa]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const target = document.querySelector(btn.dataset.wa);
        if (!target) return;
        const msg = target.textContent.trim();
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank','noopener');
      });
    });
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
    options: { responsive:true, scales:{ y:{ beginAtZero:true } }, plugins:{ legend:{ display:false } } }
  });
}

// ---------- gráficos de métricas (Peso, RCQ, WHtR) ----------
function renderMetricCharts(){
  // destrói instâncias anteriores
  if (pesoChart) pesoChart.destroy();
  if (rcqChart)  rcqChart.destroy();
  if (whtrChart) whtrChart.destroy();

  // Chart.js disponível?
  if (typeof window.Chart !== 'function') return;

  const list = Store.list();
  const c = list[0];
  if (!c) return;

  // helpers
  const toNum = (v)=>{
    if (v===undefined || v===null || v==='') return undefined;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };

  const avals = (c.avaliacoes||[])
    .slice()
    .sort((a,b)=> (a.data||'').localeCompare(b.data||''));

  // PESO
  const pesoCtx = document.getElementById('dashPeso');
  const pesoEmpty = document.getElementById('pesoEmpty');
  const seriePeso = avals.filter(a => typeof a.peso === 'number' && !isNaN(a.peso));
  if (pesoCtx && seriePeso.length >= 1){
    pesoChart = new Chart(pesoCtx, {
      type:'line',
      data:{
        labels: seriePeso.map(a=>a.data||''),
        datasets:[{
          label:'Peso (kg)',
          data: seriePeso.map(a=>Number(a.peso)),
          tension:.35, borderWidth:3,
          borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,.18)',
          fill:true, pointRadius:4, pointHoverRadius:6
        }]
      },
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:false}}}
    });
    if (pesoEmpty) pesoEmpty.style.display='none';
  } else if (pesoEmpty) pesoEmpty.style.display='block';

  // RCQ
  const rcqCtx = document.getElementById('dashRCQ');
  const rcqEmpty = document.getElementById('rcqEmpty');
  const serieRCQ = avals
    .map(a=>{
      let rcq = (typeof a.rcq === 'number' && !isNaN(a.rcq)) ? a.rcq : undefined;
      const cintura = toNum(a.cintura);
      const quadril = toNum(a.quadril);
      if (rcq===undefined && Number.isFinite(cintura) && Number.isFinite(quadril) && quadril!==0){
        rcq = cintura / quadril;
      }
      return rcq!==undefined ? {data:a.data||'', rcq} : null;
    })
    .filter(Boolean);
  if (rcqCtx && serieRCQ.length >= 1){
    rcqChart = new Chart(rcqCtx, {
      type:'line',
      data:{
        labels: serieRCQ.map(x=>x.data),
        datasets:[{
          label:'RCQ',
          data: serieRCQ.map(x=>x.rcq),
          tension:.35, borderWidth:3,
          borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,.18)',
          fill:true, pointRadius:4, pointHoverRadius:6
        }]
      },
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:false,suggestedMin:0.6,suggestedMax:1.0}}}
    });
    if (rcqEmpty) rcqEmpty.style.display='none';
  } else if (rcqEmpty) rcqEmpty.style.display='block';

  // WHtR / RCE
  const whtrCtx = document.getElementById('dashWHtR');
  const whtrEmpty = document.getElementById('whtrEmpty');
  const serieWHtR = avals
    .map(a=>{
      let whtr = (typeof a.whtr === 'number' && !isNaN(a.whtr)) ? a.whtr : undefined;
      const cintura = toNum(a.cintura);
      let altura = toNum(a.altura);
      if (Number.isFinite(altura) && altura <= 3) altura *= 100; // metros -> cm
      if (whtr===undefined && Number.isFinite(cintura) && Number.isFinite(altura) && altura!==0){
        whtr = cintura / altura;
      }
      return whtr!==undefined ? {data:a.data||'', whtr} : null;
    })
    .filter(Boolean);
  if (whtrCtx && serieWHtR.length >= 1){
    const labels = serieWHtR.map(x=>x.data);
    whtrChart = new Chart(whtrCtx, {
      type:'line',
      data:{
        labels,
        datasets:[
          { label:'WHtR', data: serieWHtR.map(x=>x.whtr), tension:.35, borderWidth:3,
            borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,.18)', fill:true, pointRadius:4, pointHoverRadius:6 },
          { label:'Guia 0.50', data: labels.map(()=>0.5), borderWidth:1, borderColor:'#888',
            pointRadius:0, fill:false, borderDash:[6,4], tension:0 }
        ]
      },
      options:{responsive:true,plugins:{legend:{display:false}},
        scales:{y:{beginAtZero:false,suggestedMin:0.35,suggestedMax:0.75}}}
    });
    if (whtrEmpty) whtrEmpty.style.display='none';
  } else if (whtrEmpty) whtrEmpty.style.display='block';
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
const toNumFlat = v => v == null ? undefined : Number(String(v).replace(',', '.'));
function isFiniteNum(v){ return Number.isFinite(toNumFlat(v)); }

function latestEval(cliente){
  const avs = Array.isArray(cliente?.avaliacoes) ? cliente.avaliacoes.slice() : [];
  if (avs.length === 0) return {};
  avs.sort((a,b)=> (a.data||'').localeCompare(b.data||''));
  const last = avs[avs.length - 1] || {};

  const peso    = toNumFlat(pick(last, ["peso","Peso (kg)","peso_kg"]));
  const cintura = toNumFlat(pick(last, ["cintura","Cintura (cm)","cintura_cm"]));
  const quadril = toNumFlat(pick(last, ["quadril","Quadril (cm)","quadril_cm"]));
  const abdome  = toNumFlat(pick(last, ["abdome","Abdome (cm)","Abdome","abdome_cm","abdomen","abdome_cm"]));
  let   altura  = toNumFlat(pick(last, ["altura","Altura (cm)","altura_cm","Altura (m)","altura_m"]));
  if (isFiniteNum(altura) && altura > 0 && altura <= 3) altura = altura * 100; // m -> cm

  const rcq = (isFiniteNum(cintura) && isFiniteNum(quadril) && quadril) ? (cintura / quadril) : (isFiniteNum(last?.rcq) ? Number(last.rcq) : undefined);
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

// versões legadas (mantidas)
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

// ---------- Template de cartão de mensagem ----------
function msgTemplate(num,titulo){
  return `
  <div class="msg-item">
    <h4 class="msg-title">${num}) ${titulo}</h4>
    <div class="msg-text" id="msg${num}"></div>
    <div class="msg-actions">
      <button class="btn btn-outline" data-copy="#msg${num}">Copiar</button>
      <button class="btn btn-primary" data-wa="#msg${num}">Abrir no WhatsApp</button>
    </div>
  </div>`;
}