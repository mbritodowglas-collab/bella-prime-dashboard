// ================================
// VIEW: Relatório da Cliente (A4/print) — com gráficos e explicações
// ================================
import { Store } from '../app.js';

const BRAND_NAME_FALLBACK = (typeof window !== 'undefined' && window.BP_BRAND_NAME) || 'Márcio Dowglas Treinador';
const LOGO_PNG_FALLBACK   = (typeof window !== 'undefined' && window.BP_BRAND_LOGO_PNG) || './assets/img/logo-mdpersonal.png';

let pesoChart = null;
let rcqChart  = null;
let rceChart  = null;
let bfChart   = null;

// ---------- helpers genéricos ----------
function esc(s){ return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function nOrDash(v, d=0){ if (v == null || v === '') return '-'; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n.toFixed(d) : '-'; }
function isNum(v){ const n = Number(String(v)); return Number.isFinite(n); }
function pick(obj, keys){ for (const k of keys){ const val = obj?.[k]; if (val != null && String(val).trim() !== '') return val; } return undefined; }
function baseLineOptions(){ return { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }; }

// ---------- extra: pegar altura/pescoço de avaliação OU respostas ----------
function toNum(v){ if (v==null || v==='') return undefined; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n)? n : undefined; }
function getAlturaFrom(cliente, aval){ // cm
  const direct = toNum(aval?.altura);
  if (Number.isFinite(direct)) return direct <= 3 ? direct*100 : direct;
  const ans = cliente?._answers || {};
  const cand = pick(ans, [
    'altura','Altura','Altura (cm)','altura_cm','Altura (m)','altura_m','estatura','Estatura (cm)'
  ]);
  let h = toNum(cand);
  if (!Number.isFinite(h)) return undefined;
  return h <= 3 ? h*100 : h;
}
function getPescocoFrom(cliente, aval){ // cm
  const direct = toNum(aval?.pescoco);
  if (Number.isFinite(direct)) return direct;
  const ans = cliente?._answers || {};
  const cand = pick(ans, [
    'pescoco','Pescoço','Pescoço (cm)','pescoco_cm','circ_pescoco','Circunferência do Pescoço'
  ]);
  return toNum(cand);
}

// RCQ direto da avaliação
function calcRCQ(a){
  const c = toNum(a?.cintura);
  const q = toNum(a?.quadril);
  return (Number.isFinite(c) && Number.isFinite(q) && q!==0) ? (c/q) : undefined;
}

// RCE usando altura da avaliação OU respostas
function calcRCEWithFallback(cliente, a){
  const c = toNum(a?.cintura);
  const h = getAlturaFrom(cliente, a); // cm
  return (Number.isFinite(c) && Number.isFinite(h) && h>0) ? (c/h) : (isNum(a?.whtr) ? Number(a.whtr) : undefined);
}

// %G estimado (Marinha) — versão feminina
// Fórmula oficial usa polegadas; convertemos cm -> in dividindo por 2.54.
// %BF = 163.205*log10(waist + hip - neck) - 97.684*log10(height) - 78.387
function navyBodyFatFemaleFromCm({ cintura_cm, quadril_cm, pescoco_cm, altura_cm }){
  const w = toNum(cintura_cm), h = toNum(quadril_cm), n = toNum(pescoco_cm), ht = toNum(altura_cm);
  if (![w,h,n,ht].every(Number.isFinite)) return undefined;
  const wi = w/2.54, hi = h/2.54, ni = n/2.54, hti = ht/2.54;
  if (wi + hi - ni <= 0 || hti <= 0) return undefined;
  const bf = 163.205*Math.log10(wi + hi - ni) - 97.684*Math.log10(hti) - 78.387;
  return Number.isFinite(bf) ? bf : undefined;
}

export const RelatorioView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<section class="card"><h2>Cliente não encontrada</h2></section>`;

    const ultimaAval = (c.avaliacoes||[])
      .slice()
      .sort((a,b)=>(a.data||'').localeCompare(b.data||''))
      .pop() || {};

    // normalização de treinos
    const treinos = (c.treinos||[])
      .slice()
      .map(t => ({
        id: t.id,
        programa: t.programa || '-',
        data_inicio: t.data_inicio || t.inicio || '',
        data_venc:   t.data_venc   || t.vencimento || '',
        observacao:  t.observacao  || t.obs || '',
        plano_texto: t.plano_texto || t.plano || '',
        intensidades: Array.isArray(t.intensidades) ? t.intensidades
                      : (t.intensidade ? [t.intensidade] : [])
      }))
      .sort((a,b)=>(b.data_inicio||'').localeCompare(a.data_inicio||''));

    const planoMaisRecente = treinos.length ? (treinos[0].plano_texto || '') : '';
    const hoje = new Date();
    const ts   = `${hoje.toLocaleDateString('pt-BR')} ${hoje.toLocaleTimeString('pt-BR')}`;

    // Branding com fallback
    let BRAND_NAME = BRAND_NAME_FALLBACK;
    let RELATORIO_LOGO_PNG = LOGO_PNG_FALLBACK;
    try {
      const mod = await import('../app.js');
      BRAND_NAME = mod.BRAND_NAME || BRAND_NAME;
      RELATORIO_LOGO_PNG = mod.RELATORIO_LOGO_PNG || RELATORIO_LOGO_PNG;
    } catch(_) {}

    // métricas
    const pesoVal    = pick(ultimaAval, ["peso", "Peso (kg)", "peso_kg"]);
    const cinturaVal = pick(ultimaAval, ["cintura", "Cintura (cm)", "cintura_cm"]);
    const quadrilVal = pick(ultimaAval, ["quadril", "Quadril (cm)", "quadril_cm"]);

    const abdomeVal  = pick(ultimaAval, [
      "abdomen","abdome","abdomem","abdominal","abdomen_cm","abdome_cm",
      "Abdomen (cm)","Abdome (cm)","Abdome","perimetro_abdominal","circunferencia_abdominal",
      "Perímetro Abdominal","Circunferência Abdominal","perimetro abdominal","circunferencia abdominal"
    ]);

    const bodyfatVal = pick(ultimaAval, [
      "bodyfat","body_fat","bf","%g","g","percentual_gordura","gordura_percentual",
      "gordura corporal","gordura corporal (%)","gordura corporal %","bf_marinha","bf_navy","body fat"
    ]);

    const alturaCm   = getAlturaFrom(c, ultimaAval);
    const pescocoCm  = getPescocoFrom(c, ultimaAval);

    // RCE com fallback p/ altura das respostas
    const rceCalc = calcRCEWithFallback(c, ultimaAval);

    // %G: usa reportado; se não houver, estima
    let bodyfatNumber = toNum(bodyfatVal);
    if (!Number.isFinite(bodyfatNumber)){
      const est = navyBodyFatFemaleFromCm({
        cintura_cm: toNum(cinturaVal) ?? toNum(abdomeVal),
        quadril_cm: toNum(quadrilVal),
        pescoco_cm: pescocoCm,
        altura_cm : alturaCm
      });
      if (Number.isFinite(est)) bodyfatNumber = est;
    }

    const peso    = nOrDash(pesoVal, 2);
    const cintura = nOrDash(cinturaVal, 0);
    const quadril = nOrDash(quadrilVal, 0);
    const abdome  = nOrDash(abdomeVal, 0);
    const rcq     = nOrDash(calcRCQ(ultimaAval), 3);
    const rce     = nOrDash(rceCalc, 3);
    const bodyfat = (Number.isFinite(bodyfatNumber) ? bodyfatNumber.toFixed(1) : '-');

    return `
      <style>
        .r-wrap{max-width:900px;margin:0 auto;padding:18px}
        .r-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px}
        .r-btn{padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:#111;color:#eee;text-decoration:none;cursor:pointer}
        .r-btn.primary{background:#c62828;border-color:#c62828;color:#fff}
        .r-header{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px}
        .r-header img{height:44px}
        .brand-text{display:none;font-weight:700}
        .r-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media (max-width:760px){ .r-grid{grid-template-columns:1fr} }
        .r-card{border:1px solid var(--border);border-radius:12px;padding:12px;background:rgba(255,255,255,.02)}
        .mono{white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,"Liberation Mono","Courier New",monospace; line-height:1.4}
        .muted{opacity:.75}
        .table th, .table td{padding:8px 10px}
        .avoid-break{page-break-inside:avoid}
        .explain{opacity:.85;font-size:.92rem}
        .chart-card canvas{max-height:220px}
        @media print{ .r-actions{display:none !important} body{background:#fff} .r-wrap{padding:0} .r-card{background:#fff} }
        .row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
      </style>

      <div class="r-wrap">
        <div class="r-actions">
          <a href="#/cliente/${c.id}" class="r-btn">← Voltar</a>
          <button class="r-btn primary" id="btnPrint">🧾 Imprimir / PDF</button>
          <button class="r-btn" id="btnShare">🔗 Copiar link do relatório</button>
        </div>

        <div class="r-header">
          <img id="brandLogo" src="${RELATORIO_LOGO_PNG}" alt="Logo"
               onerror="this.style.display='none';document.getElementById('brandText').style.display='block';" />
          <div>
            <div id="brandText" class="brand-text">${esc(BRAND_NAME||'')}</div>
            <h2 style="margin:2px 0 0">Relatório de Avaliação — ${esc(c.nome||'')}</h2>
            <div class="muted">Gerado em ${ts}</div>
          </div>
        </div>

        <div class="r-grid">
          <div class="r-card avoid-break">
            <h3 style="margin-top:0">Dados da cliente</h3>
            <p><b>Nível atual:</b> ${c.nivel||'-'}</p>
            <p><b>Prontidão:</b> ${c.readiness||'-'} ${c.prontaConsecutivas?`<span class="muted">(consecutivas: ${c.prontaConsecutivas})</span>`:''}</p>
            <p><b>Sugerido (última avaliação):</b> ${c.sugestaoNivel || '-'}</p>
            ${c.email  ?`<p><b>E-mail:</b> ${esc(c.email)}</p>`:''}
            ${c.contato?`<p><b>WhatsApp:</b> ${esc(c.contato)}</p>`:''}
            ${c.cidade ?`<p><b>Cidade/Estado:</b> ${esc(c.cidade)}</p>`:''}
            ${c.__tab  ?`<p class="muted" style="font-size:.9rem"><b>Origem dos dados:</b> ${esc(c.__tab)}</p>`:''}
          </div>

          <div class="r-card avoid-break">
            <h3 style="margin-top:0">Métricas recentes</h3>
            <div class="table-wrap">
              <table class="table" style="width:100%">
                <thead>
                  <tr>
                    <th>Data</th><th>Peso (kg)</th><th>Cintura (cm)</th><th>Quadril (cm)</th>
                    <th>Abdome (cm)</th><th>RCQ</th><th>RCE</th><th>%G (Marinha)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${ultimaAval.data || '-'}</td>
                    <td>${peso}</td>
                    <td>${cintura}</td>
                    <td>${quadril}</td>
                    <td>${abdome}</td>
                    <td>${rcq}</td>
                    <td>${rce}</td>
                    <td>${bodyfat==='-' ? '-' : `${bodyfat}%`}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="r-card chart-card avoid-break" style="margin-top:14px">
          <h3 style="margin-top:0">Evolução do Peso</h3>
          <div id="pesoEmpty" class="muted" style="display:none">Sem dados de peso suficientes.</div>
          <canvas id="chartPeso" height="180"></canvas>
        </div>

        <div class="r-card chart-card avoid-break" style="margin-top:14px">
          <div class="row">
            <h3 style="margin:0">RCQ (Relação Cintura/Quadril)</h3>
            <div class="explain"><b>O que é:</b> cintura ÷ quadril. <b>Alvo (mulheres):</b> ~&lt; 0,85.</div>
          </div>
          <div id="rcqEmpty" class="muted" style="display:none">Sem dados de RCQ suficientes.</div>
          <canvas id="chartRCQ" height="180"></canvas>
        </div>

        <div class="r-card chart-card avoid-break" style="margin-top:14px">
          <div class="row">
            <h3 style="margin:0">RCE (Relação Cintura/Estatura)</h3>
            <div class="explain"><b>O que é:</b> cintura ÷ estatura. <b>Regra de bolso:</b> manter &lt; 0,50.</div>
          </div>
          <div id="rceNote" class="muted" style="display:none;margin-bottom:6px"></div>
          <div id="rceEmpty" class="muted" style="display:none">Sem dados de RCE suficientes.</div>
          <canvas id="chartRCE" height="180"></canvas>
        </div>

        <div class="r-card chart-card avoid-break" style="margin-top:14px">
          <div class="row">
            <h3 style="margin:0">% Gordura Corporal (Marinha)</h3>
            <div class="explain">Se não houver valor reportado no Forms, mostramos o estimado (altura, pescoço, cintura e quadril).</div>
          </div>
          <div id="bfEmpty" class="muted" style="display:none">Sem dados de %G suficientes.</div>
          <canvas id="chartBF" height="180"></canvas>
        </div>

        <div class="r-card avoid-break" style="margin-top:14px">
          <h3 style="margin-top:0">Treinos (últimos)</h3>
          ${treinos.length===0?'<div class="muted">Nenhum treino registrado.</div>':`
            <div class="table-wrap">
              <table class="table" style="width:100%">
                <thead><tr><th>Programa</th><th>Período</th><th>Intensidades</th><th>Obs.</th></tr></thead>
                <tbody>
                  ${treinos.map(t=>`
                    <tr>
                      <td>${esc(t.programa||'-')}</td>
                      <td>${t.data_inicio||'-'} → ${t.data_venc||'-'}</td>
                      <td>${t.intensidades && t.intensidades.length ? esc(t.intensidades.join(' → ')) : '-'}</td>
                      <td>${esc(t.observacao||'')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <div class="r-card avoid-break" style="margin-top:14px">
          <h3 style="margin-top:0">Plano de treino mais recente (texto)</h3>
          ${planoMaisRecente ? `<div class="mono">${esc(planoMaisRecente)}</div>` : '<div class="muted">— sem plano anexado no último lançamento —</div>'}
        </div>

        <div class="muted" style="margin-top:16px">© ${esc(BRAND_NAME)} • Documento gerado automaticamente</div>
      </div>
    `;
  },

  async init(id){
    document.getElementById('btnPrint')?.addEventListener('click', ()=> window.print());

    const btnShare = document.getElementById('btnShare');
    btnShare?.addEventListener('click', async ()=>{
      let originSafe = '';
      try { originSafe = (location.origin && !location.origin.startsWith('file')) ? location.origin : ''; } catch {}
      const url = `${originSafe}${location.pathname}#/relatorio/${encodeURIComponent(id)}`;
      try{ await navigator.clipboard.writeText(url); btnShare.textContent = '✅ Link copiado'; setTimeout(()=> btnShare.textContent = '🔗 Copiar link do relatório', 1200); }
      catch{ prompt('Copie o link do relatório:', url); }
    });

    if (typeof window.Chart !== 'function') return;
    const c = Store.byId(id);
    if (!c) return;

    // PESO
    const seriePeso = (c.avaliacoes || [])
      .filter(a => isNum(a.peso))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    const pesoCtx = document.getElementById('chartPeso');
    const pesoEmpty = document.getElementById('pesoEmpty');
    if (pesoChart) pesoChart.destroy();
    if (pesoCtx && seriePeso.length >= 1){
      pesoChart = new Chart(pesoCtx, {
        type:'line',
        data:{ labels: seriePeso.map(a=>a.data||''), datasets:[{ label:'Peso (kg)', data: seriePeso.map(a=>Number(a.peso)), tension:.35, borderWidth:3, borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.18)', fill:true, pointRadius:4, pointHoverRadius:6 }]},
        options: baseLineOptions()
      });
      pesoEmpty.style.display='none';
    } else if (pesoEmpty){ pesoEmpty.style.display='block'; }

    // RCQ
    const serieRCQ = (c.avaliacoes || [])
      .map(a => ({ ...a, rcq: calcRCQ(a) }))
      .filter(a => isNum(a.rcq))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    const rcqCtx = document.getElementById('chartRCQ');
    const rcqEmpty = document.getElementById('rcqEmpty');
    if (rcqChart) rcqChart.destroy();
    if (rcqCtx && serieRCQ.length >= 1){
      const labels = serieRCQ.map(a=>a.data || '');
      rcqChart = new Chart(rcqCtx, {
        type:'line',
        data:{ labels, datasets:[
          { label:'RCQ', data: serieRCQ.map(a=>Number(a.rcq)), tension:.35, borderWidth:3, borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,.18)', fill:true, pointRadius:4, pointHoverRadius:6 },
          { label:'Guia ~0,85 (mulheres)', data: labels.map(()=>0.85), borderWidth:1, borderColor:'#888', pointRadius:0, fill:false, borderDash:[6,4], tension:0 }
        ]},
        options: baseLineOptions()
      });
      rcqEmpty.style.display='none';
    } else if (rcqEmpty){ rcqEmpty.style.display='block'; }

    // RCE (usa altura por fallback das respostas)
    const serieRCE = (c.avaliacoes || [])
      .map(a => ({ ...a, rce: calcRCEWithFallback(c, a) }))
      .filter(a => isNum(a.rce))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    const rceCtx = document.getElementById('chartRCE');
    const rceEmpty = document.getElementById('rceEmpty');
    const rceNote = document.getElementById('rceNote');
    if (rceChart) rceChart.destroy();
    if (rceCtx && serieRCE.length >= 1){
      const labels = serieRCE.map(a=>a.data || '');
      rceChart = new Chart(rceCtx, {
        type:'line',
        data:{ labels, datasets:[
          { label:'RCE', data: serieRCE.map(a=>Number(a.rce)), tension:.35, borderWidth:3, borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,.18)', fill:true, pointRadius:4, pointHoverRadius:6 },
          { label:'Guia 0,50', data: labels.map(()=>0.50), borderWidth:1, borderColor:'#888', pointRadius:0, fill:false, borderDash:[6,4], tension:0 }
        ]},
        options: { ...baseLineOptions(), scales:{ y:{ beginAtZero:false, suggestedMin:0.35, suggestedMax:0.8 } } }
      });
      rceEmpty.style.display='none';
    } else {
      if (rceEmpty) rceEmpty.style.display='block';
      if (rceNote){ rceNote.style.display='block'; rceNote.textContent = 'Para plotar o RCE precisamos de “altura” (cm) na avaliação ou nas respostas.'; }
    }

    // %G — reportado ou estimado
    const alturaGlobal = getAlturaFrom(c, {});  // caso não haja nas entradas
    const pescocoGlobal = getPescocoFrom(c, {});
    const serieBF = (c.avaliacoes || [])
      .map(a => {
        if (isNum(a.bodyfat)) return { ...a, bodyfat: Number(a.bodyfat) };
        const cintura = toNum(a.cintura) ?? toNum(a.abdome);
        const quadril = toNum(a.quadril);
        const h = getAlturaFrom(c, a) ?? alturaGlobal;
        const n = getPescocoFrom(c, a) ?? pescocoGlobal;
        const est = navyBodyFatFemaleFromCm({ cintura_cm:cintura, quadril_cm:quadril, pescoco_cm:n, altura_cm:h });
        return (Number.isFinite(est)) ? { ...a, bodyfat: est } : a;
      })
      .filter(a => isNum(a.bodyfat))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    const bfCtx = document.getElementById('chartBF');
    const bfEmpty = document.getElementById('bfEmpty');
    if (bfChart) bfChart.destroy();
    if (bfCtx && serieBF.length >= 1){
      const labels = serieBF.map(a=>a.data || '');
      bfChart = new Chart(bfCtx, {
        type:'line',
        data:{ labels, datasets:[{ label:'%G', data: serieBF.map(a=>Number(a.bodyfat)), tension:.35, borderWidth:3, borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,.18)', fill:true, pointRadius:4, pointHoverRadius:6 }]},
        options: baseLineOptions()
      });
      bfEmpty.style.display='none';
    } else if (bfEmpty){ bfEmpty.style.display='block'; }
  }
};

export default RelatorioView;