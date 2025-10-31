// ================================
// VIEW: Dashboard
// ================================
import { Store, statusCalc } from '../app.js';

let chartRef = null;
let pesoChart = null;
let rcqChart  = null;
let whtrChart = null;

export const DashboardView = {
  async template(){
    const k = kpi(Store.state.clientes);
    const firstClient = (Store.list() || [])[0];

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
        <button class="btn btn-ghost" id="copyCsvBtn" title="Gerar CSV e copiar">Copiar CSV</button>
        <button class="btn btn-ghost" id="copyJsonLinesBtn" title="Gerar JSONL e copiar">Copiar JSONL</button>
        <button class="btn btn-outline" id="openMsgBtn">💬 Mensagens rápidas</button>
      </section>

      <section class="card chart-card">
        <canvas id="chartNiveis" height="140"></canvas>
      </section>

      ${firstClient ? `
        <section class="card chart-card">
          <h3>Evolução do Peso (kg) — ${escapeHTML(firstClient.nome||'')}</h3>
          <div id="pesoEmpty" style="display:none;color:#aaa">Sem dados suficientes.</div>
          <canvas id="dashPeso" height="160"></canvas>
        </section>

        <section class="card chart-card">
          <h3>Relação Cintura/Quadril (RCQ)</h3>
          <small class="muted">alvo prático (mulheres): ≲ 0,85</small>
          <div id="rcqEmpty" style="display:none;color:#aaa">Sem dados suficientes.</div>
          <canvas id="dashRCQ" height="160"></canvas>
        </section>

        <section class="card chart-card">
          <h3>RCE / WHtR (cintura/estatura)</h3>
          <small class="muted">meta: &lt; 0,50</small>
          <div id="whtrEmpty" style="display:none;color:#aaa">Sem dados suficientes.</div>
          <canvas id="dashWHtR" height="160"></canvas>
        </section>
      ` : ''}

      <section class="card">
        <table class="table">
          <thead>
            <tr><th>Nome</th><th>Nível</th><th>Vencimento</th><th>Status</th><th style="text-align:right">Ações</th></tr>
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
            ${msgTemplate(2, 'Boas-vindas + eBook Bella Prime')}
            ${msgTemplate(3, 'Pós-formulário — Solicitar fotos')}
            ${msgTemplate(4, 'Follow-up — Relembrar envio das fotos')}
            ${msgTemplate(5, 'Oferta leve — Posso te enviar o eBook Bella Prime?')}
          </div>
        </div>
      </div>
    `;
  },

  async init(){
    const $ = s => document.querySelector(s);
    $('#q').value = Store.state.filters.q || '';
    $('#nivel').value = Store.state.filters.nivel || '';
    $('#status').value = Store.state.filters.status || '';

    // (restante do código de filtros, gráficos e exportação igual)
    // …

    // ===== Modal de Mensagens =====
    const modal = $('#msgModal'); const back = $('#msgBackdrop');
    const openBtn = $('#openMsgBtn'); const closeBtn = $('#msgCloseBtn');
    openBtn.addEventListener('click',()=>{modal.classList.add('show');back.classList.add('show');});
    closeBtn.addEventListener('click',()=>{modal.classList.remove('show');back.classList.remove('show');});
    back.addEventListener('click',()=>{modal.classList.remove('show');back.classList.remove('show');});

    // === Mensagens rápidas ===
    const BLOG = 'https://mbritodowglas-collab.github.io/mdpersonal/';
    const AVAL = 'https://mbritodowglas-collab.github.io/mdpersonal/avaliacao';

    const msgs = {
      msg1: `Oi! 👋 Seja bem-vinda!\nAqui eu falo sobre *treino feminino*, *emagrecimento real* e *neurociência de hábitos*.\n\nTe envio o link da **avaliação gratuita** pra montar teu diagnóstico? 💪✨\n\nAvaliação: ${AVAL}\nBlog: ${BLOG}`,
      msg2: `Oi! 🌹 Bem-vinda!\nTenho um material chamado **Bella Prime™** — um método que une treino, mente e hábitos.\nQuer dar uma olhada no conceito? 💫`,
      msg3: `Oi 👋\nRecebi teu formulário e preciso só de 3 fotos (frente, costas e de lado) pra montar o diagnóstico.\nTop e short ou legging preta, boa luz e postura natural.`,
      msg4: `Oi! 👋\nVi que preencheu o formulário mas ainda não recebi as fotos.\nSem elas não consigo ajustar o plano. Quer que te mande o exemplo de como tirar? 📸`,
      msg5: `Oi! 🌸 Tudo bem?\nTenho um eBook que explica como o *Tratamento Bella Prime* funciona — com treino, neurociência e mudança de hábitos.\nQuer que eu te envie pra dar uma olhada? 💪✨`
    };

    for (const k in msgs) document.getElementById(k).textContent = msgs[k];
    document.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',()=>{copyToClipboard(document.querySelector(btn.dataset.copy).textContent);toast('Copiado!');});
    });
    document.querySelectorAll('[data-wa]').forEach(btn=>{
      btn.addEventListener('click',()=>{const msg=document.querySelector(btn.dataset.wa).textContent.trim();window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');});
    });
  }
};

// ========= Helpers =========
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