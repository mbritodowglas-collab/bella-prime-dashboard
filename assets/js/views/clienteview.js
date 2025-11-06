// ================================
// VIEW: Perfil da Cliente (com %G, RCE e fallbacks FR1/FR2 + scan profundo)
// ================================
import { Store, PROFESSOR_FORM_URL } from '../app.js';

let pesoChart = null;
let rcqChart  = null;
let rceChart  = null;
let bfChart   = null; // gráfico de %G (reportado ou estimado)

// ---------- helpers básicos ----------
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapePlain(s){ return String(s || '').replace(/\r?\n/g, '\n'); }

function parseNumber(raw){
  if (raw == null) return undefined;
  const s = String(raw).replace(',', '.');
  const m = s.match(/-?\d*\.?\d+/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}
function isNum(v){ return Number.isFinite(parseNumber(v)); }

function nOrDash(v, d=0){
  const n = parseNumber(v);
  return Number.isFinite(n) ? n.toFixed(d) : '-';
}
function pick(obj, keys){
  for (const k of keys){
    const val = obj?.[k];
    if (val != null && String(val).trim() !== '') return val;
  }
  return undefined;
}

// ---------- normalização para fuzzy ----------
function norm(s){
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim();
}

// varredura profunda: coleta pares "chave -> valor" com cara de respostas
function collectAnswerLikePairs(root, maxDepth=4){
  const bag = {};
  const seen = new WeakSet();
  function walk(obj, depth){
    if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > maxDepth) return;
    seen.add(obj);
    for (const [k,v] of Object.entries(obj)){
      if (/^(__|id$|nome$|treinos$|avaliacoes$|email$|contato$|cidade$)/i.test(k)) continue;
      if (v != null && (typeof v === 'string' || typeof v === 'number')){
        if (/[a-zA-Z]/.test(k)) {
          if (!(k in bag)) bag[k] = v;
        }
      } else if (v && typeof v === 'object'){
        walk(v, depth+1);
      }
    }
  }
  walk(root, 0);
  return bag;
}

// ---------- unificar respostas (FR1/FR2 + scan profundo) ----------
function mergedAnswers(cliente){
  const pools = [];
  if (cliente?._answers)  pools.push(cliente._answers);   // FR1
  if (cliente?._answers2) pools.push(cliente._answers2);  // FR2 (se houver)
  if (cliente?.answers2)  pools.push(cliente.answers2);   // variações
  if (cliente?.forms && typeof cliente.forms === 'object'){
    for (const [k,v] of Object.entries(cliente.forms)){
      if (v && typeof v === 'object' && /(form|responses|fr)\s*2/i.test(k)) pools.push(v);
    }
  }
  // fallback: varredura profunda em todo o objeto do cliente
  pools.push(collectAnswerLikePairs(cliente));
  return Object.assign({}, ...pools);
}

function pickFromAny(cliente, aval, keys){
  const m = mergedAnswers(cliente);
  for (const k of keys){
    if (m?.[k] != null && String(m[k]).trim() !== '') return m[k];
    if (aval?.[k] != null && String(aval[k]).trim() !== '') return aval[k];
  }
  return undefined;
}

// fuzzy nas chaves combinadas
function pickFuzzyFromAnswers(cliente, regexList){
  const pool = mergedAnswers(cliente);
  for (const [k,v] of Object.entries(pool)){
    const nk = norm(k);
    for (const rx of regexList){
      if (rx.test(nk) && v != null && String(v).trim() !== '') return v;
    }
  }
  return undefined;
}

// ---------- parsing de medidas ----------
function parseLengthCm(raw){
  if (raw == null) return undefined;
  let s = String(raw).trim().toLowerCase().replace(',', '.');
  const m = s.match(/(-?\d*\.?\d+)\s*(mm|cm|m|centimetros|centímetros)?/i);
  if (!m) return undefined;
  let val = Number(m[1]);
  const unit = (m[2] ? m[2].toLowerCase() : '');
  if (!Number.isFinite(val)) return undefined;
  if (unit === 'm')  return val * 100;
  if (unit === 'mm') return val / 10;
  if (unit && unit !== 'm' && unit !== 'mm') return val; // cm
  return val <= 3 ? val * 100 : val; // sem unidade: ≤3 supõe metros
}

// altura/pescoço com fallback FR1/FR2 + fuzzy
function getAlturaFrom(cliente, aval){
  const v = pickFromAny(cliente, aval,
    ['altura','Altura','Altura (cm)','altura_cm','Altura (m)','altura_m','estatura','Estatura (cm)'])
    ?? pickFuzzyFromAnswers(cliente, [/^altura(\s|\(|$)/, /estatura/, /altura.*(cm|m)/]);
  return parseLengthCm(v);
}
function getPescocoFrom(cliente, aval){
  const v = pickFromAny(cliente, aval,
    ['pescoco','pescoço','Pescoço','Pescoço (cm)','pescoco_cm','circ_pescoco','Circunferência do Pescoço'])
    ?? pickFuzzyFromAnswers(cliente, [/pescoc/, /circ.*pescoc/]); // "pescoço" sem acento vira "pescoc"
  return parseLengthCm(v);
}

// RCQ direto a partir da avaliação
function calcRCQ(a){
  const c = parseNumber(a?.cintura);
  const q = parseNumber(a?.quadril);
  return (Number.isFinite(c) && Number.isFinite(q) && q !== 0) ? (c/q) : undefined;
}
// RCE usando altura via fallback
function calcRCEWithFallback(cliente, a){
  const c = parseNumber(a?.cintura);
  const h = getAlturaFrom(cliente, a);
  return (Number.isFinite(c) && Number.isFinite(h) && h > 0) ? (c/h)
       : (isNum(a?.whtr) ? parseNumber(a.whtr) : undefined);
}

// %G (Marinha) — feminina — entradas em cm
function navyBodyFatFemaleFromCm({ cintura_cm, quadril_cm, pescoco_cm, altura_cm }){
  const w = parseNumber(cintura_cm), h = parseNumber(quadril_cm), n = parseNumber(pescoco_cm), ht = parseNumber(altura_cm);
  if (![w,h,n,ht].every(Number.isFinite)) return undefined;
  const wi = w/2.54, hi = h/2.54, ni = n/2.54, hti = ht/2.54;
  if (wi + hi - ni <= 0 || hti <= 0) return undefined;
  const bf = 163.205*Math.log10(wi + hi - ni) - 97.684*Math.log10(hti) - 78.387;
  return Number.isFinite(bf) ? bf : undefined;
}

function badgeColor(readiness){
  if (readiness === 'Pronta para subir') return '#2e7d32';
  if (readiness === 'Quase lá')        return '#f9a825';
  return '#455a64';
}
function calcStatusTreino(t){
  const hoje = new Date(); hoje.setHours(12,0,0,0);
  const dIni = t?.data_inicio ? new Date(`${t.data_inicio}T12:00:00`) : null;
  const dVen = t?.data_venc   ? new Date(`${t.data_venc}T12:00:00`)   : null;
  if (dIni && dVen && dIni <= hoje && hoje <= dVen) return 'Ativo';
  return 'Vencido';
}

// ============== VIEW ==============
export const ClienteView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    // histórico rápido
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

    // última avaliação
    const ultimaAval = (c.avaliacoes || [])
      .slice()
      .sort((a,b)=>(a.data||'').localeCompare(b.data||''))
      .pop() || {};

    // ---- MÉTRICAS COM FALLBACK (peso/altura/pescoço) ----
    const pesoRaw     = pickFromAny(c, ultimaAval,
      ['peso','Peso','Peso (kg)','peso (kg)','peso_kg','Qual é o seu peso?'])
      ?? pickFuzzyFromAnswers(c, [/^peso(\s|\(|$)/, /peso.*kg/]);

    const cinturaRaw  = pick(ultimaAval, ["cintura","Cintura (cm)","cintura_cm"]);
    const quadrilRaw  = pick(ultimaAval, ["quadril","Quadril (cm)","quadril_cm"]);
    const abdomeRaw   = pick(ultimaAval, [
      "abdomen","abdome","abdomem","abdominal","abdomen_cm","abdome_cm","Abdome (cm)","Abdomen (cm)"
    ]);

    const alturaCm    = getAlturaFrom(c, ultimaAval);
    const pescocoCm   = getPescocoFrom(c, ultimaAval);

    const rcqVal      = calcRCQ(ultimaAval);
    const rceVal      = calcRCEWithFallback(c, ultimaAval);

    // %G reportado na avaliação?
    let bfNum = parseNumber(pick(ultimaAval, [
      "bodyfat","body_fat","bf","%g","g","percentual_gordura","gordura_percentual",
      "gordura corporal","gordura corporal (%)","gordura corporal %","bf_marinha","bf_navy","body fat"
    ]));
    if (!Number.isFinite(bfNum)){
      // estima via Marinha
      const est = navyBodyFatFemaleFromCm({
        cintura_cm: parseNumber(cinturaRaw) ?? parseNumber(abdomeRaw),
        quadril_cm: parseNumber(quadrilRaw),
        pescoco_cm: pescocoCm,
        altura_cm : alturaCm
      });
      if (Number.isFinite(est)) bfNum = est;
    }

    // formatos
    const pesoFmt     = nOrDash(pesoRaw, 2);
    const cinturaFmt  = nOrDash(cinturaRaw, 0);
    const quadrilFmt  = nOrDash(quadrilRaw, 0);
    const abdomeFmt   = nOrDash(abdomeRaw, 0);
    const alturaFmt   = Number.isFinite(alturaCm)  ? alturaCm.toFixed(0)   : '-';
    const pescocoFmt  = Number.isFinite(pescocoCm) ? pescocoCm.toFixed(0)  : '-';
    const rcqFmt      = nOrDash(rcqVal, 3);
    const rceFmt      = nOrDash(rceVal, 3);
    const bfFmt       = Number.isFinite(bfNum) ? bfNum.toFixed(1) : '-';

    // --- respostas completas (para copiar) ---
    let blocoRespostas = '';
    const _ans = mergedAnswers(c);
    if (_ans && Object.keys(_ans).length > 0) {
      const lista = Object.entries(_ans)
        .map(([k,v]) => `<li><b>${escapeHTML(k)}:</b> ${escapeHTML(v)}</li>`).join('');
      const texto = Object.entries(_ans).map(([k,v]) => `${k}: ${v}`).join('\n');
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

    // normalização dos treinos
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
      const status = calcStatusTreino(t);
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

    // badges/CTA
    const sugerido = c.sugestaoNivel ? `<span class="badge" style="background:#2b6777">sugerido: ${c.sugestaoNivel}</span>` : '';
    const readyTag = c.readiness ? `<span class="badge" style="background:${badgeColor(c.readiness)}">${c.readiness}</span>` : '';
    const elegivel = c.elegivelPromocao ? `<span class="badge" style="background:#7cb342">elegível</span>` : '';
    const prontasN = c.prontaConsecutivas ? `<small style="opacity:.75">(${c.prontaConsecutivas} reavaliaç${c.prontaConsecutivas>1?'ões':'ão'} prontas seguidas)</small>` : '';

    const linkProfessor = (PROFESSOR_FORM_URL && c.id)
      ? `${PROFESSOR_FORM_URL}?id=${encodeURIComponent(c.id)}&nome=${encodeURIComponent(c.nome||'')}`
      : '';
    const ctaProfessor = linkProfessor
      ? `<a class="btn btn-primary" href="${linkProfessor}" target="_blank" rel="noopener">📋 Formulário do Professor</a>`
      : `<button class="btn btn-outline" id="professorFormBtn" title="Defina PROFESSOR_FORM_URL no app.js">📋 Formulário do Professor</button>`;

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

      <!-- Métricas recentes -->
      <section class="card">
        <h3 style="margin-top:0">Métricas recentes</h3>
        <div class="table-wrap" style="overflow:auto">
          <table class="table" style="min-width:920px">
            <thead>
              <tr>
                <th>Data</th>
                <th>Peso (kg)</th>
                <th>Cintura (cm)</th>
                <th>Quadril (cm)</th>
                <th>Abdome (cm)</th>
                <th>Altura (cm)</th>
                <th>Pescoço (cm)</th>
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
                <td>${alturaFmt}</td>
                <td>${pescocoFmt}</td>
                <td>${rcqFmt}</td>
                <td>${rceFmt}</td>
                <td>${bfFmt}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <small style="opacity:.75">Circunferências vêm das avaliações; peso/altura/pescoço podem vir das respostas (FR1/FR2) para estimar RCE e %G.</small>
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

      <!-- GRÁFICOS -->
      <section class="card chart-card">
        <h3>Evolução do Peso (kg)</h3>
        <div id="pesoEmpty" style="display:none;color:#aaa">Sem dados de peso suficientes.</div>
        <canvas id="chartPeso" height="160"></canvas>
      </section>

      <section class="card chart-card">
        <div class="row" style="justify-content:space-between;align-items:flex-end;">
          <h3 style="margin:0">Relação Cintura/Quadril (RCQ)</h3>
          <small style="opacity:.85">alvo (mulheres): ≲ 0,85</small>
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
          <small style="opacity:.85">Usa valor do Forms ou estimativa (altura, pescoço, cintura, quadril).</small>
        </div>
        <div id="bfEmpty" style="display:none;color:#aaa">Sem dados de %G suficientes.</div>
        <canvas id="chartBF" height="160"></canvas>
      </section>

      <!-- Modal de Mensagens Rápidas (conteúdo igual ao seu atual) -->
      <div class="modal-backdrop" id="msgBackdrop"></div>
      <div class="modal" id="msgModal" aria-hidden="true">
        <!-- ... -->
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

    // aviso do form do professor
    const profBtn = document.getElementById('professorFormBtn');
    if (profBtn){
      profBtn.addEventListener('click', ()=> {
        alert('Defina PROFESSOR_FORM_URL no app.js para abrir o Formulário do Professor com ID/nome.');
      });
    }

    // ========== Gráficos ==========
    if (typeof window.Chart !== 'function') return;

    // Peso — aceita fallback + fuzzy do FR1/FR2 para cada avaliação
    const pesoCtx = document.getElementById('chartPeso');
    const pesoEmpty = document.getElementById('pesoEmpty');
    const seriePeso = (c.avaliacoes || [])
      .map(a => {
        const p = pickFromAny(c, a, ['peso','Peso','Peso (kg)','peso (kg)','peso_kg','Qual é o seu peso?'])
              ?? pickFuzzyFromAnswers(c, [/^peso(\s|\(|$)/, /peso.*kg/]);
        const pn = parseNumber(p);
        return { ...a, pesoNum: Number.isFinite(pn) ? pn : undefined };
      })
      .filter(a => Number.isFinite(a.pesoNum))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (pesoChart) pesoChart.destroy();
    if (pesoCtx && seriePeso.length >= 1) {
      pesoChart = new Chart(pesoCtx, {
        type: 'line',
        data: {
          labels: seriePeso.map(a => a.data || ''),
          datasets: [{
            label: 'Peso (kg)',
            data: seriePeso.map(a => a.pesoNum),
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
      .map(a => ({ ...a, rcq: calcRCQ(a) }))
      .filter(a => Number.isFinite(a.rcq))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (rcqChart) rcqChart.destroy();
    if (rcqCtx && serieRCQ.length >= 1) {
      const labels = serieRCQ.map(a => a.data || '');
      rcqChart = new Chart(rcqCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'RCQ', data: serieRCQ.map(a => a.rcq), tension: 0.35, borderWidth: 3,
              borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.18)', fill: true, pointRadius: 4, pointHoverRadius: 6 }
          ]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }
      });
      if (rcqEmpty) rcqEmpty.style.display = 'none';
    } else if (rcqEmpty) { rcqEmpty.style.display = 'block'; }

    // RCE (usa fallback de altura das respostas)
    const rceCtx = document.getElementById('chartRCE');
    const rceEmpty = document.getElementById('rceEmpty');
    const serieRCE = (c.avaliacoes || [])
      .map(a => ({ ...a, rce: calcRCEWithFallback(c, a) }))
      .filter(a => Number.isFinite(a.rce))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (rceChart) rceChart.destroy();
    if (rceCtx && serieRCE.length >= 1) {
      const labels = serieRCE.map(a => a.data || '');
      rceChart = new Chart(rceCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label:'RCE', data: serieRCE.map(a=>a.rce), tension:0.35, borderWidth:3,
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

    // %G (reportado OU estimado)
    const alturaGlobal = getAlturaFrom(c, {});
    const pescocoGlobal = getPescocoFrom(c, {});
    const bfCtx = document.getElementById('chartBF');
    const bfEmpty = document.getElementById('bfEmpty');
    const serieBF = (c.avaliacoes || [])
      .map(a => {
        if (isNum(a.bodyfat)) return { ...a, bfNum: parseNumber(a.bodyfat) };
        const cintura = parseNumber(a.cintura) ?? parseNumber(a.abdome);
        const quadril = parseNumber(a.quadril);
        const h = getAlturaFrom(c, a) ?? alturaGlobal;
        const n = getPescocoFrom(c, a) ?? pescocoGlobal;
        const est = navyBodyFatFemaleFromCm({ cintura_cm:cintura, quadril_cm:quadril, pescoco_cm:n, altura_cm:h });
        return Number.isFinite(est) ? { ...a, bfNum: est } : a;
      })
      .filter(a => Number.isFinite(a.bfNum))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (bfChart) bfChart.destroy();
    if (bfCtx && serieBF.length >= 1) {
      const labels = serieBF.map(a => a.data || '');
      bfChart = new Chart(bfCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label:'%G', data: serieBF.map(a=>a.bfNum), tension:0.35, borderWidth:3,
              borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.18)', fill:true, pointRadius:4, pointHoverRadius:6 }
          ]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }
      });
      if (bfEmpty) bfEmpty.style.display = 'none';
    } else if (bfEmpty) { bfEmpty.style.display = 'block'; }

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
  }
};

export default ClienteView;