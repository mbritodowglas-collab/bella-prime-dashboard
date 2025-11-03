// ================================
// VIEW: Dashboard
// ================================
import { Store, statusCalc } from '../app.js';

let chartRef = null; // barras (níveis)

// ---------------- PARAMS (espelhados do TreinoView) ----------------
const PARAMS = {
  'Fundação': {
    series: '3',
    reps: '12–15',
    descanso: '45–75s',
    intensidade1RM: '50–65%',
    cadencia: '2:1–2:2',
    metodos: 'pirâmide truncada (±5%), circuito leve, isometria leve (2s)',
    cardio: [
      { tipo: 'LISS', duracao_min: 25, FCR: '60–65%', instrucao: 'Ritmo contínuo, conversa possível.' },
      { tipo: 'MISS (opcional)', duracao_min: 15, FCR: '65–70%', instrucao: 'Ritmo sustentado, fala entrecortada.' }
    ]
  },
  'Ascensão': {
    series: '3',
    reps: '10–14 (ajuste progressivo)',
    descanso: '60–90s',
    intensidade1RM: '65–75% (conforme mesociclo)',
    cadencia: '2:1–2:2',
    metodos: 'pirâmide, bi-set leve, drop simples, isometria (conforme meso)',
    cardio: [
      { tipo: 'LISS', duracao_min: 30, FCR: '60–65%', instrucao: 'Ritmo contínuo.' },
      { tipo: 'MISS', duracao_min: 20, FCR: '65–75%', instrucao: 'Ritmo sustentado.' }
    ]
  },
  'Domínio': {
    series: '4–5',
    reps: '8–12 (conforme foco)',
    descanso: '60–120s',
    intensidade1RM: '70–85% (por mesociclo)',
    cadencia: '2:1–2:2 / 3:1 em tensional',
    metodos: 'pirâmide crescente, bi-set/supersérie, drop, rest-pause, isometria (conforme meso)',
    cardio: [
      { tipo: 'MISS', duracao_min: 20, FCR: '65–75%', instrucao: 'Ritmo sustentado.' }
    ],
    extra: [
      'Distribuição temporal (respeite a sequência de intensidades selecionadas):',
      '- Quebre o período em blocos semanais coerentes (ex.: 4–5 semanas por foco).',
      '- Indique no topo de cada sessão a qual foco/mesociclo aquela semana pertence.'
    ]
  },
  'OverPrime': {
    series: '4–6',
    reps: '6–12 (conforme foco)',
    descanso: '60–150s',
    intensidade1RM: '75–90% (por mesociclo)',
    cadencia: 'variável (inclui cluster/pausas)',
    metodos: 'pirâmide inversa, rest-pause duplo, cluster, tri/giant set, parciais (conforme meso)',
    cardio: [
      { tipo: 'MISS', duracao_min: 20, FCR: '70–80%', instrucao: 'Ritmo desafiador.' }
    ],
    extra: [
      'Distribuição temporal (respeite a sequência de intensidades selecionadas):',
      '- Quebre o período em blocos semanais coerentes (ex.: 4–5 semanas por foco).',
      '- Indique no topo de cada sessão a qual foco/mesociclo aquela semana pertence.'
    ]
  }
};

// gera blocos de cardio formatados (igual ao TreinoView)
function cardioLines(level) {
  const arr = PARAMS[level]?.cardio || [];
  if (!arr.length) return '';
  return arr.map(c => `• ${c.tipo} — ${c.duracao_min}min · ${c.FCR} · ${c.instrucao}`).join('\n');
}

// template de prompt por nível (com placeholders)
function buildPromptTemplate(level) {
  const p = PARAMS[level] || PARAMS['Fundação'];
  const base = [
    'Você é prescritor do sistema Bella Prime · Evo360.',
    'Gere um PROGRAMA DE TREINO estruturado seguindo as regras do nível.',
    '',
    `Cliente: {{CLIENTE_NOME}} | Nível: ${level || '{{NIVEL}}'}`,
    `Programa: {{PROGRAMA}}`,
    `Período: {{DATA_INICIO}} → {{DATA_VENCIMENTO}}`,
    `{{INTENSIDADES}}`, // opcional
    `{{OBJETIVO}}`,     // opcional
    `{{RESTRICOES}}`,   // opcional
    `{{OBSERVACOES}}`,  // opcional
    '',
    'Parâmetros do nível:',
    `- Séries: ${p.series}`,
    `- Repetições: ${p.reps}`,
    `- Descanso: ${p.descanso}`,
    `- %1RM: ${p.intensidade1RM}`,
    `- Cadência: ${p.cadencia}`,
    `- Métodos aplicáveis: ${p.metodos}`,
    '',
    'Estrutura obrigatória por sessão:',
    '- Mobilidade (3 itens do grupo do dia).',
    '- Principais (6–8 exercícios, ordem sugerida: 1 multiarticular principal, 2 secundário, 3 acessório composto, 4 isolador primário, 5 isolador secundário, 6 método aplicado, 7 core técnico opcional).',
    '',
    'Cardio (Karvonen — FCR = (FCmax − FCrep) × %intensidade + FCrep). Modelos:',
    cardioLines(level),
    '',
    'Formato de saída:',
    '- Sessões A, B, C... com listas de exercícios e parâmetros (séries, reps, descanso, cadência).',
    '- Cardio no final conforme FCR, indicando tipo, duração, %FCR e instrução prática.',
    '- Incluir observações do método quando aplicável (NUNCA explicar o gesto motor).'
  ];

  if (p.extra && Array.isArray(p.extra)) base.push('', ...p.extra);
  return base.filter(Boolean).join('\n');
}

// versão “universal” (sem parametrizar nível — para qualquer caso)
function buildPromptUniversal() {
  const base = [
    'Você é prescritor do sistema Bella Prime · Evo360.',
    'Gere um PROGRAMA DE TREINO estruturado.',
    '',
    'Cliente: {{CLIENTE_NOME}} | Nível: {{NIVEL}}',
    'Programa: {{PROGRAMA}}',
    'Período: {{DATA_INICIO}} → {{DATA_VENCIMENTO}}',
    '{{INTENSIDADES}}',
    '{{OBJETIVO}}',
    '{{RESTRICOES}}',
    '{{OBSERVACOES}}',
    '',
    'Parâmetros do nível (preencha conforme o nível informado):',
    '- Séries: {{SERIES}}',
    '- Repetições: {{REPETICOES}}',
    '- Descanso: {{DESCANSO}}',
    '- %1RM: {{PERCENT_1RM}}',
    '- Cadência: {{CADENCIA}}',
    '- Métodos aplicáveis: {{METODOS}}',
    '',
    'Estrutura obrigatória por sessão:',
    '- Mobilidade (3 itens do grupo do dia).',
    '- Principais (6–8 exercícios; ordem: 1 multiarticular principal; 2 secundário; 3 acessório composto; 4 isolador primário; 5 isolador secundário; 6 método; 7 core técnico opcional).',
    '',
    'Cardio (Karvonen):',
    '- Tipo: {{CARDIO_TIPO}} · Duração: {{CARDIO_MIN}}min · FCR: {{CARDIO_FCR}} · Instrução: {{CARDIO_NOTAS}}',
    '',
    'Formato de saída:',
    '- Sessões A, B, C... (parâmetros completos).',
    '- Cardio ao final (tipo, duração, %FCR e instrução prática).',
    '- Observações do método quando aplicável (não explicar gesto motor).',
    '',
    'Se o nível for Domínio/OverPrime, considere blocos semanais e a sequência de intensidades.'
  ];
  return base.join('\n');
}

// ---------------- /PARAMS ----------------

export const DashboardView = {
  async template(){
    const k = kpi(Store.state.clientes);

    // CSS dos modais
    const modalCSS = `
      <style>
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;z-index:9998}
        .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999}
        .modal.show,.modal-backdrop.show{display:flex}
        .modal-card{width:min(960px,92vw);max-height:86vh;overflow:auto;background:#121316;border:1px solid var(--border);
          border-radius:14px;box-shadow:var(--shadow);padding:14px}
        .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .modal-grid{display:grid;grid-template-columns:1fr;gap:10px}
        .msg-item,.prompt-item{border:1px solid var(--border);border-radius:12px;padding:10px;background:rgba(255,255,255,.02)}
        .msg-actions,.prompt-actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
        .msg-title,.prompt-title{font-weight:700;margin:0 0 6px}
        .msg-text,.prompt-text{white-space:pre-wrap}
        .muted{opacity:.85}
        @media(min-width:860px){ .modal-grid{grid-template-columns:1fr 1fr} }
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

        <button class="btn btn-outline" id="copyCsvBtn" title="Gerar CSV e copiar">Copiar CSV</button>
        <button class="btn btn-outline" id="copyJsonLinesBtn" title="Gerar JSON Lines e copiar">Copiar JSONL</button>

        <button class="btn btn-outline" id="openMsgBtn">💬 Mensagens rápidas</button>
        <button class="btn btn-outline" id="openPromptBtn">🧠 Prompts de Treino</button>
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

      <!-- Modal de Prompts de Treino -->
      <div class="modal-backdrop" id="promptBackdrop"></div>
      <div class="modal" id="promptModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 style="margin:0">🧠 Prompts de Elaboração de Treino</h3>
            <button class="btn btn-outline" id="promptCloseBtn">Fechar</button>
          </div>
          <p class="muted" style="margin:0 0 8px">
            *Templates com placeholders. Preencha depois de colar (ex.: {{CLIENTE_NOME}}, {{PROGRAMA}}, {{DATA_INICIO}}...).*
          </p>
          <div class="modal-grid" id="promptGrid">
            <!-- preenchido em runtime -->
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

    // Exportações rápidas
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

    // Renderização inicial
    chartNiveis();
    renderTable();

    // ===== Modal de Mensagens =====
    const modal = $('#msgModal'); const back = $('#msgBackdrop');
    const openBtn = $('#openMsgBtn'); const closeBtn = $('#msgCloseBtn');

    openBtn.addEventListener('click',()=>{ modal.classList.add('show'); back.classList.add('show'); });
    closeBtn.addEventListener('click',()=>{ modal.classList.remove('show'); back.classList.remove('show'); });
    back.addEventListener('click',()=>{ modal.classList.remove('show'); back.classList.remove('show'); });

    // Mensagens rápidas com seus links
    const BLOG = 'https://mbritodowglas-collab.github.io/mdpersonal/';
    const AVAL = 'https://mbritodowglas-collab.github.io/mdpersonal/avaliacao';

    const msgs = {
      msg1: `Oi! 👋 Seja bem-vinda!\nAqui eu falo sobre *treino feminino*, *emagrecimento real* e *neurociência de hábitos*.\n\nTe envio o link da **avaliação gratuita** pra montar teu diagnóstico? 💪✨\n\nAvaliação: ${AVAL}\nBlog: ${BLOG}`,
      msg2: `Oi! 🌹 Bem-vinda!\nTenho um material chamado **Bella Prime™** — um método que une treino, mente e hábitos.\nQuer dar uma olhada no conceito? 💫`,
      msg3: `Oi 👋\nRecebi teu formulário e preciso só de 3 fotos (frente, costas e de lado) pra montar o diagnóstico.\nTop e short ou legging preta, boa luz e postura natural.\nSe preferir, te envio a imagem-guia. 📸`,
      msg4: `Oi! 👋\nVi que preencheu o formulário mas ainda não recebi as fotos.\nSem elas não consigo ajustar o plano. Quer que te mande o exemplo de como tirar? 📸`,
      msg5: `Oi! 🌸 Tudo bem?\nTenho um eBook que explica como o *Tratamento Bella Prime* funciona — com treino, neurociência e mudança de hábitos.\nQuer que eu te envie pra dar uma olhada? 💪✨`
    };

    for (const k in msgs) {
      const el = document.getElementById(k);
      if (el) el.textContent = msgs[k];
    }

    document.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const target = document.querySelector(btn.dataset.copy);
        if (!target) return;
        copyToClipboard(target.textContent);
        toast('Copiado!');
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

    // ===== Modal de Prompts de Treino =====
    const pModal = $('#promptModal'); const pBack = $('#promptBackdrop');
    const pOpen = $('#openPromptBtn'); const pClose = $('#promptCloseBtn');

    pOpen.addEventListener('click',()=>{ pModal.classList.add('show'); pBack.classList.add('show'); });
    pClose.addEventListener('click',()=>{ pModal.classList.remove('show'); pBack.classList.remove('show'); });
    pBack.addEventListener('click',()=>{ pModal.classList.remove('show'); pBack.classList.remove('show'); });

    // Monta cards com os templates de prompt (Fundação / Ascensão / Domínio / OverPrime + Universal)
    const grid = document.getElementById('promptGrid');
    if (grid){
      const items = [
        ['universal', 'Template Universal', buildPromptUniversal()],
        ['fundacao',  'Fundação',          buildPromptTemplate('Fundação')],
        ['ascensao',  'Ascensão',          buildPromptTemplate('Ascensão')],
        ['dominio',   'Domínio',           buildPromptTemplate('Domínio')],
        ['overprime', 'OverPrime',         buildPromptTemplate('OverPrime')],
      ];
      grid.innerHTML = items.map(([key, title, txt]) => promptCardHTML(key, title, txt)).join('');

      // copiar prompt
      grid.querySelectorAll('[data-copy-prompt]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const target = grid.querySelector(btn.dataset.copyPrompt);
          if (!target) return;
          copyToClipboard(target.textContent);
          toast('Prompt copiado!');
        });
      });
    }
  }
};

// ---------- tabela ----------
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

// ---------- KPI e gráfico de níveis ----------
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

// ---------- utilidades ----------
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function safeCell(v){
  if (v === null || v === undefined) return '';
  return String(v).replace(/\r?\n/g,' ').replace(/"/g,'""');
}

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

function formatCSVWithMetrics(arr){
  if(!Array.isArray(arr)) return '';
  const fields = [
    'id','nome','contato','email','cidade','nivel','pontuacao','ultimoTreino','objetivo',
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

// ---------- Templates ----------
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

function promptCardHTML(key, titulo, texto){
  const safeId = `prompt_${key.replace(/[^a-z0-9_-]/gi,'_')}`;
  return `
  <div class="prompt-item">
    <h4 class="prompt-title">${titulo || key}</h4>
    <div class="prompt-text" id="${safeId}">${escapeHTML(texto || '')}</div>
    <div class="prompt-actions">
      <button class="btn btn-outline" data-copy-prompt="#${safeId}">Copiar prompt</button>
    </div>
  </div>`;
}

// ---------- clipboard ----------
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