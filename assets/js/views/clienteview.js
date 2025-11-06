// ================================
// VIEW: Perfil da Cliente (atualizado com RCE, %G e respostas de múltiplas abas)
// ================================
import { Store, PROFESSOR_FORM_URL, SHEETS_API as SHEETS_API_EXPORT } from '../app.js';

let pesoChart = null;
let rcqChart  = null;
let rceChart  = null;
let bfChart   = null; // gráfico de %G

// fallback para SHEETS_API se não houver export
const SHEETS_API = (typeof SHEETS_API_EXPORT === 'string' && SHEETS_API_EXPORT)
  || (typeof window !== 'undefined' && window.BP_SHEETS_API)
  || '';

export const ClienteView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    // --- última avaliação (para métricas recentes) ---
    const ultimaAval = (c.avaliacoes || [])
      .slice()
      .sort((a,b)=>(a.data||'').localeCompare(b.data||''))
      .pop() || {};

    // Leituras robustas (aceita chaves alternativas do Sheets)
    const pesoVal     = pick(ultimaAval, ["peso", "Peso (kg)", "peso_kg"]);
    const cinturaVal  = pick(ultimaAval, ["cintura", "Cintura (cm)", "cintura_cm"]);
    const quadrilVal  = pick(ultimaAval, ["quadril", "Quadril (cm)", "quadril_cm"]);
    const alturaVal   = pick(ultimaAval, ["altura","estatura","altura_cm","altura (cm)","height"]);
    const pescocoVal  = pick(ultimaAval, ["pescoco","pescoço","pescoco_cm","pescoço (cm)","circunferencia do pescoco","circunferência do pescoço"]);

    // Abdome — variações comuns
    const abdomeVal   = pick(ultimaAval, [
      "abdomen","abdome","abdomem","abdominal",
      "abdomen_cm","abdome_cm",
      "Abdomen (cm)","Abdome (cm)","Abdome",
      "perimetro_abdominal","circunferencia_abdominal",
      "Perímetro Abdominal","Circunferência Abdominal",
      "perimetro abdominal","circunferencia abdominal"
    ]);

    // %G salvo (se já veio do Store/planilha)
    const bodyfatSaved = pick(ultimaAval, ["bodyfat","body_fat","bf","%g","gordura_percentual","bf_marinha","bf_navy"]);

    // formatações
    const pesoFmt     = nOrDash(pesoVal, 2);
    const cinturaFmt  = nOrDash(cinturaVal, 0);
    const quadrilFmt  = nOrDash(quadrilVal, 0);
    const abdomeFmt   = nOrDash(abdomeVal, 0);

    // RCQ/RCE
    const rcqFmt      = nOrDash(calcRCQ(ultimaAval), 3);
    const rceFmt      = nOrDash(calcRCE(ultimaAval), 3);

    // %G (fallback local se não vier salvo)
    const sexoInferido = inferSexo(c) || 'F'; // padrão feminino
    const bfLocal = navyBodyFat(
      sexoInferido,
      toNum(cinturaVal),
      toNum(quadrilVal),
      toNum(pescocoVal),
      toNum(alturaVal)
    );
    const bodyfatFmt = nOrDash((bodyfatSaved ?? bfLocal), 1);

    // --- normalização dos treinos ---
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

    // Bloco: respostas (todas as abas) para GPT
    const respostasMultiAbas = `
      <section class="card">
        <h3 style="margin-top:0">Respostas completas (todas as abas)</h3>
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" id="btnFetchAllAnswers">Baixar respostas (todas as abas)</button>
          <button class="btn btn-outline" id="btnCopyAllAnswers" disabled>Copiar para GPT</button>
        </div>
        <textarea id="allAnswersText" style="position:absolute;left:-9999px;top:-9999px;"></textarea>
        <div id="allAnswersStatus" style="margin-top:8px;opacity:.8"></div>
      </section>
    `;

    // Modal de mensagens rápidas (inalterado)
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
          <table class="table" style="min-width:760px">
            <thead>
              <tr>
                <th>Data</th>
                <th>Peso (kg)</th>
                <th>Cintura (cm)</th>
                <th>Quadril (cm)</th>
                <th>Abdome (cm)</th>
                <th>RCQ</th>
                <th>RCE</th>
                <th>%G</th>
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
                <td>${bodyfatFmt}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <small style="opacity:.75">Valores lidos das avaliações registradas.</small>
      </section>

      <!-- Respostas (todas as abas) para GPT -->
      ${SHEETS_API ? respostasMultiAbas : ''}

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

      <!-- Gráficos -->
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

      <section class="card chart-card">
        <div class="row" style="justify-content:space-between;align-items:flex-end;">
          <h3 style="margin:0">%G (Protocolo Marinha EUA)</h3>
          <small style="opacity:.85">Se vier salvo, usamos; senão, mostramos o estimado.</small>
        </div>
        <div id="bfEmpty" style="display:none;color:#aaa">Sem dados de %G suficientes.</div>
        <canvas id="chartBF" height="160"></canvas>
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

    // aviso caso PROFESSOR_FORM_URL não esteja setado
    const profBtn = document.getElementById('professorFormBtn');
    if (profBtn){
      profBtn.addEventListener('click', ()=> {
        alert('Defina PROFESSOR_FORM_URL no app.js para abrir o Formulário do Professor com ID/nome.');
      });
    }

    // ===== Respostas (todas as abas) para GPT =====
    const btnFetchAll = document.getElementById('btnFetchAllAnswers');
    const btnCopyAll  = document.getElementById('btnCopyAllAnswers');
    const taAll       = document.getElementById('allAnswersText');
    const statusEl    = document.getElementById('allAnswersStatus');

    if (btnFetchAll && SHEETS_API){
      btnFetchAll.addEventListener('click', async ()=>{
        btnFetchAll.disabled = true;
        setStatus('Baixando respostas das abas…');

        try{
          const names = [
            'Form Responses 1','Form Responses 2','Form Responses 3',
            'Respostas ao formulário 1','Respostas do formulário 1',
            'Respostas','Responses'
          ];
          const all = [];
          for (const name of names){
            const url = `${SHEETS_API}?sheet=${encodeURIComponent(name)}`;
            const r = await fetch(url);
            if (!r.ok) continue;
            const arr = await r.json();
            if (!Array.isArray(arr)) continue;

            // filtra as linhas desta cliente (por id/email/contato)
            const idKey   = String(c?.id||'').trim().toLowerCase();
            const email   = String(c?.email||'').trim().toLowerCase();
            const wppLast = onlyDigits(c?.contato);

            const hits = arr.filter(o=>{
              const oid   = (String(o.id||o.ID||'').trim().toLowerCase());
              const oem   = (String(o.email||o['E-mail']||o.Email||'').trim().toLowerCase());
              const ocont = onlyDigits(o.contato || o.WhatsApp || o.whatsapp || '');
              return (idKey && oid && oid===idKey)
                  || (email && oem && oem===email)
                  || (wppLast && ocont && ocont.endsWith(wppLast));
            });

            hits.forEach(row=>{
              all.push({ _sheet:name, ...row });
            });
          }

          if (all.length === 0){
            setStatus('Nenhuma resposta encontrada para esta cliente nas abas verificadas.');
            btnFetchAll.disabled = false;
            return;
          }

          // monta texto “legível para GPT”
          const blob = all.map((o,i)=>{
            const entries = Object.entries(o)
              .filter(([k]) => k !== '_sheet' && k !== 'avaliacoes') // limpa campos internos
              .map(([k,v]) => `${k}: ${v}`)
              .join('\n');
            return [
              `=== ABA: ${o._sheet} (registro #${i+1}) ===`,
              entries,
              ''
            ].join('\n');
          }).join('\n');

          taAll.value = blob;
          btnCopyAll.disabled = false;
          setStatus(`Pronto! ${all.length} registro(s) reunido(s). Clique em "Copiar para GPT".`);
        }catch(err){
          setStatus('Erro ao baixar respostas. Verifique o SHEETS_API no app.js e o deployment do Apps Script.');
          btnFetchAll.disabled = false;
        }
      });

      btnCopyAll?.addEventListener('click', ()=>{
        taAll.select();
        document.execCommand('copy');
        btnCopyAll.textContent = 'Copiado!';
        setTimeout(()=> btnCopyAll.textContent = 'Copiar para GPT', 1200);
      });
    }

    function setStatus(msg){
      if (statusEl) statusEl.textContent = msg || '';
    }
    function onlyDigits(s){ return String(s||'').replace(/\D+/g,''); }

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
      if (rcqEmpty) pesoEmpty.style.display = 'none';
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

    // %G (Body Fat)
    const bfCtx = document.getElementById('chartBF');
    const bfEmpty = document.getElementById('bfEmpty');
    const serieBF = (c.avaliacoes || [])
      .map(a => {
        if (typeof a.bodyfat === 'number' && !isNaN(a.bodyfat)) return a;
        // tenta estimar se não veio salvo na linha
        const est = navyBodyFat(
          inferSexo(c) || 'F',
          toNum(a.cintura),
          toNum(a.quadril),
          toNum(a.pescoco || a['pescoço']),
          toNum(a.altura)
        );
        return (typeof est === 'number') ? { ...a, bodyfat: est } : a;
      })
      .filter(a => typeof a.bodyfat === 'number' && !isNaN(a.bodyfat))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (bfChart) bfChart.destroy();
    if (bfCtx && serieBF.length >= 1) {
      const labels = serieBF.map(a => a.data || '');
      bfChart = new Chart(bfCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label:'%G', data: serieBF.map(a=>Number(a.bodyfat)), tension:0.35, borderWidth:3,
              borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.18)', fill:true, pointRadius:4, pointHoverRadius:6 }
          ]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } },
          scales:{ y:{ beginAtZero:false } } }
      });
      if (bfEmpty) bfEmpty.style.display = 'none';
    } else if (bfEmpty) { bfEmpty.style.display = 'block'; }
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

// --- %G (Marinha EUA) helpers ---
function cmToIn(cm){ return Number.isFinite(cm) ? (cm / 2.54) : undefined; }
function log10(x){ return Math.log(x) / Math.LN10; }
function navyBodyFat(sexo, cinturaCm, quadrilCm, pescocoCm, alturaCm){
  const C = cmToIn(cinturaCm);
  const H = cmToIn(alturaCm);
  const N = cmToIn(pescocoCm);
  const Q = cmToIn(quadrilCm);
  if (!Number.isFinite(C) || !Number.isFinite(H) || !Number.isFinite(N)) return undefined;

  if (sexo === 'M'){
    const diff = C - N;
    if (diff <= 0) return undefined;
    const bf = 86.010 * log10(diff) - 70.041 * log10(H) + 36.76;
    return Number.isFinite(bf) ? Number(Math.max(0, bf).toFixed(1)) : undefined;
  } else {
    if (!Number.isFinite(Q)) return undefined;
    const sum = C + Q - N;
    if (sum <= 0) return undefined;
    const bf = 163.205 * log10(sum) - 97.684 * log10(H) - 78.387;
    return Number.isFinite(bf) ? Number(Math.max(0, bf).toFixed(1)) : undefined;
  }
}
function inferSexo(c){
  const txt = Object.values(c?._answers||{}).join(' ').toLowerCase();
  if (!txt) return undefined;
  if (/\bmasc|masculino|homem|male\b/.test(txt)) return 'M';
  if (/\bfem|feminino|mulher|female\b/.test(txt)) return 'F';
  return undefined;
}