// ================================
// VIEW: Perfil da Cliente
// ================================
import { Store, PROFESSOR_FORM_URL } from '../app.js';

let pesoChart = null;
let rcqChart  = null;
let rceChart  = null;

export const ClienteView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    // --- histórico de avaliações (tabela) ---
    const historico = (c.avaliacoes || [])
      .slice()
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''))
      .map(a=> `
        <tr>
          <td>${a.data || '-'}</td>
          <td>${a.nivel || '-'}</td>
          <td>${a.pontuacao ?? '-'}</td>
          <td>${a.sugestaoNivel || '-'}</td>
          <td>${a.readiness || '-'}</td>
        </tr>
      `).join('');

    // --- última avaliação (para métricas recentes) ---
    const ultimaAval = (c.avaliacoes || [])
      .slice()
      .sort((a,b)=>(a.data||'').localeCompare(b.data||''))
      .pop() || {};

    const pesoVal    = pick(ultimaAval, ["peso", "Peso (kg)", "peso_kg"]);
    const cinturaVal = pick(ultimaAval, ["cintura", "Cintura (cm)", "cintura_cm"]);
    const quadrilVal = pick(ultimaAval, ["quadril", "Quadril (cm)", "quadril_cm"]);
    // ✅ ler direto do campo salvo na avaliação
    const abdomeVal  = ultimaAval?.abdomen;

    const pesoFmt    = nOrDash(pesoVal, 2);
    const cinturaFmt = nOrDash(cinturaVal, 0);
    const quadrilFmt = nOrDash(quadrilVal, 0);
    const abdomeFmt  = nOrDash(abdomeVal, 0);
    const rcqFmt     = nOrDash(calcRCQ(ultimaAval), 3);
    const rceFmt     = nOrDash(calcRCE(ultimaAval), 3);

    // --- respostas completas (para copiar) ---
    let blocoRespostas = '';
    if (c._answers && Object.keys(c._answers).length > 0) {
      const lista = Object.entries(c._answers)
        .map(([k,v]) => `<li><b>${escapeHTML(k)}:</b> ${escapeHTML(v)}</li>`).join('');
      const texto = Object.entries(c._answers).map(([k,v]) => `${k}: ${v}`).join('\n');
      blocoRespostas = `
        <section class="card">
          <h3>Respostas completas (Sheets)</h3>
          <ul style="margin:8px 0 12px 18px;">${lista}</ul>
          <div class="row" style="gap:10px;">
            <button class="btn btn-outline" id="copyAnswers">Copiar lista</button>
            <small style="opacity:.8">Copia todas as respostas para análise no ChatGPT</small>
          </div>
          <textarea id="answersText" style="position:absolute;left:-9999px;top:-9999px;">${escapePlain(texto)}</textarea>
        </section>
      `;
    }

    // --- normalização dos treinos para suportar as duas nomenclaturas ---
    const treinos = Array.isArray(c.treinos)
      ? c.treinos.slice().map(t => ({
          id: t.id,
          programa: t.programa || '-',
          data_inicio: t.data_inicio || t.inicio || '',
          data_venc:   t.data_venc   || t.vencimento || '',
          observacao:  t.observacao  || t.obs || '',
          plano_texto: t.plano_texto || t.plano || '',
          intensidades: Array.isArray(t.intensidades) ? t.intensidades : (t.intensidade ? [t.intensidade] : []),
          status: t.status || null
        }))
        .sort((a,b)=>(b.data_inicio||'').localeCompare(a.data_inicio||''))
      : [];

    const linhasTreino = treinos.map(t => {
      const status = calcStatusTreino(t); // Ativo / Vencido
      return `
        <tr>
          <td><span class="badge">${escapeHTML(t.programa)}</span></td>
          <td>${t.data_inicio || '-'} → ${t.data_venc || '-'}</td>
          <td><span class="status ${status==='Ativo'?'st-ok':'st-bad'}">${status}</span></td>
          <td>${escapeHTML(t.observacao || '')}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-outline btn-del-treino" data-treino="${escapeHTML(t.id || '')}">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');

    // --- badges ---
    const sugerido = c.sugestaoNivel ? `<span class="badge" style="background:#2b6777">sugerido: ${c.sugestaoNivel}</span>` : '';
    const readyTag = c.readiness ? `<span class="badge" style="background:${badgeColor(c.readiness)}">${c.readiness}</span>` : '';
    const elegivel = c.elegivelPromocao ? `<span class="badge" style="background:#7cb342">elegível</span>` : '';
    const prontasN = c.prontaConsecutivas ? `<small style="opacity:.75">(${c.prontaConsecutivas} reavaliaç${c.prontaConsecutivas>1?'ões':'ão'} prontas seguidas)</small>` : '';

    // --- CTA formulário do professor ---
    const linkProfessor = (PROFESSOR_FORM_URL && c.id)
      ? `${PROFESSOR_FORM_URL}?id=${encodeURIComponent(c.id)}&nome=${encodeURIComponent(c.nome||'')}`
      : '';
    const ctaProfessor = linkProfessor
      ? `<a class="btn btn-primary" href="${linkProfessor}" target="_blank" rel="noopener">📋 Formulário do Professor</a>`
      : `<button class="btn btn-outline" id="professorFormBtn" title="Defina PROFESSOR_FORM_URL no app.js">📋 Formulário do Professor</button>`;

    // --- botão mensagens rápidas + modal ---
    const modalCSS = `
      <style>
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;z-index:9998}
        .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999}
        .modal.show,.modal-backdrop.show{display:flex}
        .modal-card{width:min(860px,92vw);max-height:86vh;overflow:auto;background:#121316;border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow);padding:14px}
        .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .modal-grid{display:grid;grid-template-columns:1fr;gap:10px}
        .msg-item{border:1px solid var(--border);border-radius:12px;padding:10px;background:rgba(255,255,255,.02)}
        .msg-actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
        .msg-title{font-weight:700;margin:0 0 6px}
        .msg-text{white-space:pre-wrap}
        @media(min-width:760px){ .modal-grid{grid-template-columns:1fr 1fr} }
      </style>
    `;

    const quickBtn = `<button class="btn btn-outline" id="quickMsgBtn">💬 Mensagens rápidas</button>`;

    return `
      ${modalCSS}

      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>${escapeHTML(c.nome || '')}</h2>
        <p>
          <b>Nível atual:</b> <span class="badge">${c.nivel || '-'}</span>
          ${sugerido} ${readyTag} ${elegivel} ${prontasN}
        </p>
        <p><b>Última pontuação:</b> ${c.pontuacao ?? '-'}</p>
        <p><b>Última avaliação:</b> ${c.ultimoTreino ?? '-'}</p>
        ${c.objetivo ? `<p><b>Objetivo:</b> ${escapeHTML(c.objetivo)}</p>` : ''}
        ${c.cidade  ? `<p><b>Cidade/Estado:</b> ${escapeHTML(c.cidade)}</p>` : ''}
        ${c.email   ? `<p><b>E-mail:</b> ${escapeHTML(c.email)}</p>` : ''}
        ${c.contato ? `<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>` : ''}
        <div class="row" style="gap:10px;margin-top:12px">
          ${ctaProfessor}
          <a class="btn btn-outline" href="#/relatorio/${c.id}">🧾 Relatório (A4)</a>
          ${quickBtn}
        </div>
      </section>

      <!-- Métricas recentes (última avaliação) -->
      <section class="card">
        <h3 style="margin-top:0">Métricas recentes</h3>
        <div class="table-wrap" style="overflow:auto">
          <table class="table" style="min-width:640px">
            <thead>
              <tr>
                <th>Data</th><th>Peso (kg)</th><th>Cintura (cm)</th><th>Quadril (cm)</th><th>Abdome (cm)</th><th>RCQ</th><th>RCE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${ultimaAval.data || '-'}</td>
                <td>${pesoFmt}</td>
                <td>${cinturaFmt}</td>
                <td>${quadrilFmt}</td>
                <td>${abdomeFmt}</td>
                <td>${rcqFmt}</td>
                <td>${rceFmt}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <small style="opacity:.75">Os valores são lidos das avaliações registradas (não do bloco “Respostas completas”).</small>
      </section>

      <section class="card">
        <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
          <h3 style="margin:0">Treinos Registrados</h3>
          <a class="btn btn-primary" href="#/treino/${c.id}/novo">+ Lançar novo treino</a>
        </div>
        ${treinos.length === 0 ? `<div style="color:#aaa;margin-top:8px">Nenhum treino registrado ainda.</div>` : `
          <div style="overflow:auto;margin-top:8px">
            <table class="table">
              <thead>
                <tr><th>Programa</th><th>Período</th><th>Status</th><th>Obs.</th><th style="text-align:right">Ações</th></tr>
              </thead>
              <tbody>${linhasTreino}</tbody>
            </table>
          </div>
        `}
      </section>

      ${blocoRespostas}

      <section class="card chart-card">
        <h3>Evolução do Peso (kg)</h3>
        <div id="pesoEmpty" style="display:none;color:#aaa">Sem dados de peso suficientes.</div>
        <canvas id="chartPeso" height="160"></canvas>
      </section>

      <section class="card chart-card">
        <div class="row" style="justify-content:space-between;align-items:flex-end;">
          <h3 style="margin:0">Relação Cintura/Quadril (RCQ)</h3>
          <small style="opacity:.85">cintura ÷ quadril • alvo (mulheres): ~&lt; 0,85</small>
        </div>
        <div id="rcqEmpty" style="display:none;color:#aaa">Sem dados de cintura/quadril suficientes.</div>
        <canvas id="chartRCQ" height="160"></canvas>
      </section>

      <section class="card chart-card">
        <div class="row" style="justify-content:space-between;align-items:flex-end;">
          <h3 style="margin:0">RCE (cintura/estatura)</h3>
          <small style="opacity:.85">regra de bolso: manter &lt; 0,50</small>
        </div>
        <div id="rceEmpty" style="display:none;color:#aaa">Sem dados de cintura/estatura suficientes.</div>
        <canvas id="chartRCE" height="160"></canvas>
        <small style="opacity:.75">Linha guia 0,50 = cintura menor que metade da altura.</small>
      </section>

      <!-- Modal de Mensagens Rápidas -->
      <div class="modal-backdrop" id="msgBackdrop"></div>
      <div class="modal" id="msgModal" aria-hidden="true">
        <div class="modal-card">
          <div class="modal-header">
            <h3 style="margin:0">💬 Mensagens rápidas</h3>
            <button class="btn btn-outline" id="msgCloseBtn">Fechar</button>
          </div>
          <div class="modal-grid">

            <div class="msg-item">
              <h4 class="msg-title">1) IG — Boas-vindas + Avaliação + Blog</h4>
              <div class="msg-text" id="msg1"></div>
              <div class="msg-actions">
                <button class="btn btn-outline" data-copy="#msg1">Copiar</button>
                <button class="btn btn-primary" data-wa="#msg1">Abrir no WhatsApp</button>
              </div>
            </div>

            <div class="msg-item">
              <h4 class="msg-title">2) IG — Boas-vindas + eBook Bella Prime</h4>
              <div class="msg-text" id="msg2"></div>
              <div class="msg-actions">
                <button class="btn btn-outline" data-copy="#msg2">Copiar</button>
                <button class="btn btn-primary" data-wa="#msg2">Abrir no WhatsApp</button>
              </div>
            </div>

            <div class="msg-item">
              <h4 class="msg-title">3) Pós-formulário — Solicitar 3 fotos</h4>
              <div class="msg-text" id="msg3"></div>
              <div class="msg-actions">
                <button class="btn btn-outline" data-copy="#msg3">Copiar</button>
                <button class="btn btn-primary" data-wa="#msg3">Abrir no WhatsApp</button>
              </div>
            </div>

            <div class="msg-item">
              <h4 class="msg-title">4) Follow-up — Relembrar envio das fotos</h4>
              <div class="msg-text" id="msg4"></div>
              <div class="msg-actions">
                <button class="btn btn-outline" data-copy="#msg4">Copiar</button>
                <button class="btn btn-primary" data-wa="#msg4">Abrir no WhatsApp</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    // copiar respostas
    const copyBtn = document.getElementById('copyAnswers');
    if (copyBtn){
      copyBtn.addEventListener('click', () => {
        const ta = document.getElementById('answersText');
        ta.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copiado!';
        setTimeout(()=> copyBtn.textContent = 'Copiar lista', 1200);
      });
    }

    // aviso caso PROFESSOR_FORM_URL não esteja setado
    const profBtn = document.getElementById('professorFormBtn');
    if (profBtn){
      profBtn.addEventListener('click', ()=> {
        alert('Defina PROFESSOR_FORM_URL no app.js para abrir o Formulário do Professor com ID/nome.');
      });
    }

    // ---------- Mensagens rápidas ----------
    const modal = document.getElementById('msgModal');
    const backdrop = document.getElementById('msgBackdrop');
    const openBtn = document.getElementById('quickMsgBtn');
    const closeBtn= document.getElementById('msgCloseBtn');

    const openModal = ()=>{ modal.classList.add('show'); backdrop.classList.add('show'); };
    const closeModal= ()=>{ modal.classList.remove('show'); backdrop.classList.remove('show'); };

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);

    // Modelos (com foco: treino feminino, emagrecimento e neurociência de hábitos)
    const nome = c?.nome ? c.nome.split(' ')[0] : '';
    const blogHint  = '🔗 [seu-link-do-blog-aqui]';
    const ebookHint = '📘 [link-do-eBook-Bella-Prime]';
    const avaliacaoCTA = 'Posso te enviar o link da avaliação gratuita?';

    const M1 = [
      `Oi! 👋 Seja muito bem-vinda!`,
      `Aqui eu falo de *treino feminino*, *emagrecimento real* e *neurociência aplicada à mudança de hábitos*.`,
      ``,
      `Se quiser, te mando o link da **avaliação gratuita** que uso pra montar um diagnóstico personalizado.`,
      `É rapidinho e já mostra por onde começar pra ter resultado de verdade. 💪✨`,
      ``,
      `Enquanto isso, passa no blog — toda semana tem dicas práticas:`,
      `${blogHint}`,
      ``,
      `${avaliacaoCTA}`
    ].join('\n');

    const M2 = [
      `Oi, tudo bem? 👋`,
      `Vi que você começou a me seguir — bem-vinda! 🌹`,
      `Preparei um **eBook gratuito** apresentando o **Tratamento Bella Prime™**: níveis de evolução, método e como ele integra *treino + mente + hábitos*.`,
      ``,
      `Quer o link pra baixar?`,
      `${ebookHint}`
    ].join('\n');

    const M3 = [
      `Oi${nome?`, ${nome}`:''}! 👋`,
      `Recebi seu formulário e já posso começar teu diagnóstico.`,
      `Pra eu montar com precisão, me envie **3 fotos corporais**: *frente, costas e de lado*.`,
      ``,
      `👉 Do pescoço pra baixo, roupas de treino (top + short/legging preta), em pé, com boa iluminação.`,
      `Assim analiso postura, pontos de retenção e defino o plano com mais assertividade. 💪✨`
    ].join('\n');

    const M4 = [
      `Oi${nome?`, ${nome}`:''}! Tudo bem? 😊`,
      `Vi que você preencheu o formulário, mas ainda não finalizamos o envio das fotos.`,
      `Sem elas eu não consigo concluir teu diagnóstico nem ajustar treino e hábitos com precisão.`,
      ``,
      `Se preferir, te mando um exemplo de como fazer — é simples e rapidinho.`,
      `Quer que eu te envie o modelo pra facilitar? 📸`
    ].join('\n');

    // injeta textos
    const setText = (sel, txt) => { const el = document.getElementById(sel); if (el) el.textContent = txt; };
    setText('msg1', M1);
    setText('msg2', M2);
    setText('msg3', M3);
    setText('msg4', M4);

    // ações de copiar e abrir no WhatsApp
    const handleCopy = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const ta = document.createElement('textarea');
      ta.value = el.textContent || '';
      ta.setAttribute('readonly','');
      ta.style.position='fixed'; ta.style.left='-9999px';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, ta.value.length);
      document.execCommand('copy');
      document.body.removeChild(ta);
    };
    const onlyDigits = s => String(s||'').replace(/\D+/g,'');
    const waOpen = (selector) => {
      const msg = (document.querySelector(selector)?.textContent||'').trim();
      if (!msg) return;
      const phone = onlyDigits(c?.contato);
      const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
                        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank', 'noopener');
    };

    document.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const sel = btn.getAttribute('data-copy');
        handleCopy(sel);
        btn.textContent = 'Copiado!';
        setTimeout(()=> btn.textContent = 'Copiar', 1200);
      });
    });
    document.querySelectorAll('[data-wa]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const sel = btn.getAttribute('data-wa');
        waOpen(sel);
      });
    });

    // Excluir treino
    document.querySelectorAll('.btn-del-treino').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-treino');
        if (!tid) return;
        const ok = confirm('Remover este treino? Esta ação não pode ser desfeita.');
        if (!ok) return;
        const cli = Store.byId(id);
        if (!cli || !Array.isArray(cli.treinos)) return;
        cli.treinos = cli.treinos.filter(t => String(t.id) !== String(tid));
        Store.upsert(cli);
        location.hash = `#/cliente/${id}`;
      });
    });

    // ========== Gráficos (somente se Chart estiver carregado) ==========
    if (typeof window.Chart !== 'function') return;

    // Peso
    const pesoCtx = document.getElementById('chartPeso');
    const pesoEmpty = document.getElementById('pesoEmpty');
    const seriePeso = (c.avaliacoes || [])
      .filter(a => typeof a.peso === 'number' && !isNaN(a.peso))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (pesoChart) pesoChart.destroy();
    if (pesoCtx && seriePeso.length >= 1) {
      pesoChart = new Chart(pesoCtx, {
        type: 'line',
        data: {
          labels: seriePeso.map(a => a.data || ''),
          datasets: [{
            label: 'Peso (kg)',
            data: seriePeso.map(a => Number(a.peso)),
            tension: 0.35, borderWidth: 3,
            borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.18)',
            fill: true, pointRadius: 4, pointHoverRadius: 6
          }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }
      });
      if (pesoEmpty) pesoEmpty.style.display = 'none';
    } else if (pesoEmpty) { pesoEmpty.style.display = 'block'; }

    // RCQ
    const rcqCtx = document.getElementById('chartRCQ');
    const rcqEmpty = document.getElementById('rcqEmpty');
    const serieRCQ = (c.avaliacoes || [])
      .map(a => {
        const rcq = (typeof a.rcq === 'number' && !isNaN(a.rcq))
          ? a.rcq
          : (toNum(a.cintura) && toNum(a.quadril) && Number(a.quadril) !== 0
              ? Number(a.cintura)/Number(a.quadril)
              : undefined);
        return { ...a, rcq };
      })
      .filter(a => typeof a.rcq === 'number' && !isNaN(a.rcq))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (rcqChart) rcqChart.destroy();
    if (rcqCtx && serieRCQ.length >= 1) {
      const labels = serieRCQ.map(a => a.data || '');
      rcqChart = new Chart(rcqCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'RCQ', data: serieRCQ.map(a => Number(a.rcq)), tension: 0.35, borderWidth: 3,
              borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.18)', fill: true, pointRadius: 4, pointHoverRadius: 6 }
          ]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }
      });
      if (rcqEmpty) rcqEmpty.style.display = 'none';
    } else if (rcqEmpty) { rcqEmpty.style.display = 'block'; }

    // RCE (WHtR)
    const rceCtx = document.getElementById('chartRCE');
    const rceEmpty = document.getElementById('rceEmpty');
    const serieRCE = (c.avaliacoes || [])
      .map(a => {
        const cintura = toNum(a.cintura);
        let altura = toNum(a.altura);
        if (typeof altura === 'number' && altura <= 3) altura = altura*100; // se veio em metros
        const rce = (typeof a.whtr === 'number' && !isNaN(a.whtr))
          ? a.whtr
          : (Number.isFinite(cintura) && Number.isFinite(altura) && altura !== 0 ? cintura/altura : undefined);
        return { ...a, rce };
      })
      .filter(a => typeof a.rce === 'number' && !isNaN(a.rce))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (rceChart) rceChart.destroy();
    if (rceCtx && serieRCE.length >= 1) {
      const labels = serieRCE.map(a => a.data || '');
      rceChart = new Chart(rceCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label:'RCE', data: serieRCE.map(a=>Number(a.rce)), tension:0.35, borderWidth:3,
              borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.18)', fill:true, pointRadius:4, pointHoverRadius:6 },
            { label:'Guia 0,50', data: labels.map(()=>0.5), borderWidth:1, borderColor:'#888',
              pointRadius:0, fill:false, borderDash:[6,4], tension:0 }
          ]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } },
          scales:{ y:{ beginAtZero:false, suggestedMin:0.35, suggestedMax:0.75 } } }
      });
      if (rceEmpty) rceEmpty.style.display = 'none';
    } else if (rceEmpty) { rceEmpty.style.display = 'block'; }
  }
};

// ============ helpers ============
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapePlain(s){ return String(s || '').replace(/\r?\n/g, '\n'); }
function toNum(v){
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
function nOrDash(v, d=0){
  if (v == null || v === '') return '-';
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n.toFixed(d) : '-';
}
function isNum(v){ return Number.isFinite(Number(v)); }
function pick(obj, keys){
  for (const k of keys){
    const val = obj?.[k];
    if (val != null && String(val).trim() !== '') return val;
  }
  return undefined;
}
function calcRCQ(a){
  const c = Number(a?.cintura);
  const q = Number(a?.quadril);
  return (isNum(c) && isNum(q) && q !== 0) ? (c/q) : undefined;
}
function calcRCE(a){
  const c = Number(a?.cintura);
  let h = Number(a?.altura);
  if (isNum(h) && h > 0 && h <= 3) h = h * 100; // metros -> cm
  return (isNum(c) && isNum(h) && h > 0) ? (c/h) : (isNum(a?.whtr) ? Number(a.whtr) : undefined);
}
function badgeColor(readiness){
  if (readiness === 'Pronta para subir') return '#2e7d32';
  if (readiness === 'Quase lá') return '#f9a825';
  return '#455a64';
}
function calcStatusTreino(t){
  const hoje = new Date(); hoje.setHours(12,0,0,0);
  const dIni = t?.data_inicio ? new Date(`${t.data_inicio}T12:00:00`) : null;
  const dVen = t?.data_venc   ? new Date(`${t.data_venc}T12:00:00`)   : null;
  if (dIni && dVen && dIni <= hoje && hoje <= dVen) return 'Ativo';
  return 'Vencido';
}