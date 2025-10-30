// ================================
// VIEW: Relatório imprimível (A4/PDF)
// ================================
import { Store } from '../app.js';

// ajuste o caminho da tua logo aqui:
const LOGO_URL = 'assets/img/logo-bella-prime.svg'; // troque se estiver em outro lugar

let pesoChart = null;
let rcqChart  = null;
let whtrChart = null;

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

function toNum(v){ const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : undefined; }
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

export const RelatorioView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<section class="card"><h2>Cliente não encontrada</h2></section>`;

    // última avaliação para “resumo”
    const avals = (c.avaliacoes || []).slice().sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    const last  = avals[avals.length-1] || {};
    const peso    = (typeof last.peso === 'number') ? last.peso : undefined;
    const cintura = toNum(last.cintura);
    const quadril = toNum(last.quadril);
    let   altura  = toNum(last.altura);
    if (typeof altura === 'number' && altura <= 3) altura = altura * 100; // metros -> cm
    const rcq = (Number.isFinite(cintura) && Number.isFinite(quadril) && quadril!==0) ? (cintura / quadril) : last.rcq;
    const whtr = (Number.isFinite(cintura) && Number.isFinite(altura) && altura!==0) ? (cintura / altura) : last.whtr;

    // pega algumas respostas úteis
    const ans = c._answers || {};
    const objetivo = ans['Qual o seu objetivo?'] || ans['objetivo'] || c.objetivo || '';

    return `
      <style>
        /* layout A4 limpo para impressão */
        .report-wrap{ background:#0b0d10; color:#eaeff4; padding:18px; }
        @media print{ body{ background:#fff!important } .no-print{ display:none!important } .report-wrap{ padding:0; } }
        .sheet{ max-width:900px; margin:0 auto; background:#111417; border:1px solid #222831; border-radius:14px; overflow:hidden; }
        .r-header{ display:flex; align-items:center; gap:16px; padding:18px 20px; background:#0f1317; border-bottom:1px solid #222831; }
        .r-header img{ height:40px; }
        .r-title h1{ font-size:20px; margin:0 0 4px 0; }
        .r-title small{ color:#9fb0c0 }
        .grid{ display:grid; grid-template-columns: 1fr 1fr; gap:16px; padding:16px 20px; }
        .card{ background:#0f1317; border:1px solid #222831; border-radius:12px; padding:14px; }
        .card h3{ margin:0 0 10px 0; font-size:16px; }
        .row{ display:flex; gap:10px; align-items:center; }
        .badge{ background:#263442; padding:4px 8px; border-radius:999px; font-size:12px; color:#d6e3f0; }
        .b-ok{ background:#1b4d2f } .b-warn{ background:#5c4a1a } .b-info{ background:#243b55 }
        table.clean{ width:100%; border-collapse:collapse; }
        table.clean td{ padding:6px 0; border-bottom:1px dashed #2a3440; vertical-align:top; }
        .muted{ color:#96a7b8; font-size:12px }
        .footer{ padding:16px 20px 24px; border-top:1px solid #222831; display:flex; justify-content:space-between; align-items:center; }
        .btn{ padding:10px 14px; border-radius:10px; border:1px solid #384453; background:#16202b; color:#eaf2ff; text-decoration:none; }
        .btn-primary{ background:#b71c1c; border-color:#b71c1c; }
        .chart-card{ padding:14px; }
        .sig{ height:64px; border-bottom:1px solid #2a3440; margin-bottom:6px }
        .sigtxt{ font-size:12px; color:#9fb0c0 }
        @media print{
          .sheet{ border:none; border-radius:0 }
          .footer{ display:none }
          .card{ break-inside:avoid-page; page-break-inside:avoid; }
        }
      </style>

      <div class="report-wrap">
        <div class="sheet">
          <header class="r-header">
            <img src="${LOGO_URL}" alt="Logo">
            <div class="r-title">
              <h1>Relatório de Avaliação — ${escapeHTML(c.nome || '')}</h1>
              <small>Gerado em ${todayISO()} · Última avaliação: ${last.data || '-'} · ID: ${escapeHTML(c.id)}</small>
            </div>
          </header>

          <div class="grid">
            <section class="card">
              <h3>Resumo</h3>
              <div class="row" style="flex-wrap:wrap; gap:6px 8px">
                <span class="badge b-info">Nível atual: ${escapeHTML(c.nivel || '-')}</span>
                ${c.sugestaoNivel ? `<span class="badge b-info">Sugerido: ${escapeHTML(c.sugestaoNivel)}</span>` : ''}
                ${c.readiness ? `<span class="badge ${c.readiness==='Pronta para subir'?'b-ok':(c.readiness==='Quase lá'?'b-warn':'b-info')}">${escapeHTML(c.readiness)}</span>` : ''}
                ${c.elegivelPromocao ? `<span class="badge b-ok">Elegível para promoção</span>` : ''}
              </div>
              <table class="clean" style="margin-top:10px">
                <tr><td><b>Pontuação (última)</b></td><td>${last.pontuacao ?? '-'}</td></tr>
                <tr><td><b>Objetivo</b></td><td>${escapeHTML(objetivo || '-')}</td></tr>
                <tr><td><b>Contato</b></td><td>${escapeHTML(c.contato || c.email || '-')}</td></tr>
              </table>
            </section>

            <section class="card">
              <h3>Métricas Antropométricas</h3>
              <table class="clean">
                <tr><td><b>Peso</b></td><td>${peso ?? '-'} kg</td></tr>
                <tr><td><b>Cintura</b></td><td>${Number.isFinite(cintura)? cintura+' cm':'-'}</td></tr>
                <tr><td><b>Quadril</b></td><td>${Number.isFinite(quadril)? quadril+' cm':'-'}</td></tr>
                <tr><td><b>Altura</b></td><td>${Number.isFinite(altura)? altura+' cm':'-'}</td></tr>
                <tr><td><b>RCQ</b></td><td>${(typeof rcq==='number' && !isNaN(rcq)) ? rcq.toFixed(2) : '-'}</td></tr>
                <tr><td><b>WHtR</b></td><td>${(typeof whtr==='number' && !isNaN(whtr)) ? whtr.toFixed(2) : '-'} <span class="muted">meta &lt; 0,50</span></td></tr>
              </table>
            </section>

            <section class="card chart-card" style="grid-column:1 / -1">
              <h3>Evolução do Peso (kg)</h3>
              <div id="pesoEmpty" class="muted" style="display:none">Sem dados suficientes.</div>
              <canvas id="chartPeso" height="140"></canvas>
            </section>

            <section class="card chart-card">
              <h3>Relação Cintura/Quadril (RCQ)</h3>
              <div id="rcqEmpty" class="muted" style="display:none">Sem dados suficientes.</div>
              <canvas id="chartRCQ" height="140"></canvas>
            </section>

            <section class="card chart-card">
              <h3>Relação Cintura/Estatura (WHtR)</h3>
              <div id="whtrEmpty" class="muted" style="display:none">Sem dados suficientes.</div>
              <canvas id="chartWHtR" height="140"></canvas>
              <div class="muted" style="margin-top:6px">Linha guia 0,50 = cintura &lt; 50% da estatura.</div>
            </section>

            <section class="card" style="grid-column:1 / -1">
              <h3>Observações</h3>
              <div class="sig"></div>
              <div class="sigtxt">Assinatura do profissional</div>
            </section>
          </div>

          <div class="footer no-print">
            <a href="#/cliente/${c.id}" class="btn">← Voltar</a>
            <div class="row">
              <button class="btn" id="btnPrint">Imprimir / Salvar PDF</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    // botão imprimir
    document.getElementById('btnPrint')?.addEventListener('click', ()=> window.print());

    // ==== séries para gráficos ====
    // Peso
    const seriePeso = (c.avaliacoes || [])
      .filter(a => typeof a.peso === 'number' && !isNaN(a.peso))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));

    // RCQ (recalcula se faltar)
    const serieRCQ = (c.avaliacoes || [])
      .map(a => {
        const rcq = (typeof a.rcq === 'number' && !isNaN(a.rcq))
          ? a.rcq
          : (a.cintura && a.quadril && Number(a.quadril)!==0 ? Number(a.cintura)/Number(a.quadril) : undefined);
        return { ...a, rcq };
      })
      .filter(a => typeof a.rcq === 'number' && !isNaN(a.rcq))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));

    // WHtR
    const serieWHtR = (c.avaliacoes || [])
      .map(a => {
        const cintura = toNum(a.cintura);
        let altura = toNum(a.altura);
        if (typeof altura === 'number' && altura <= 3) altura = altura*100;
        const whtr = (typeof a.whtr === 'number' && !isNaN(a.whtr))
          ? a.whtr
          : (Number.isFinite(cintura) && Number.isFinite(altura) && altura!==0 ? cintura/altura : undefined);
        return { ...a, whtr };
      })
      .filter(a => typeof a.whtr === 'number' && !isNaN(a.whtr))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));

    // Render dos gráficos (usa Chart.js já carregado no index)
    // Peso
    const pesoCtx = document.getElementById('chartPeso');
    const pesoEmpty = document.getElementById('pesoEmpty');
    if (pesoChart) pesoChart.destroy();
    if (pesoCtx && seriePeso.length){
      pesoChart = new Chart(pesoCtx, {
        type:'line',
        data:{ labels: seriePeso.map(a=>a.data||''), datasets:[{
          label:'Peso (kg)', data: seriePeso.map(a=>Number(a.peso)),
          tension:0.35, borderWidth:3, borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.18)', fill:true,
          pointRadius:3, pointHoverRadius:5
        }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:false}} }
      });
      pesoEmpty.style.display='none';
    } else if (pesoEmpty) pesoEmpty.style.display='block';

    // RCQ
    const rcqCtx = document.getElementById('chartRCQ');
    const rcqEmpty = document.getElementById('rcqEmpty');
    if (rcqChart) rcqChart.destroy();
    if (rcqCtx && serieRCQ.length){
      rcqChart = new Chart(rcqCtx, {
        type:'line',
        data:{ labels: serieRCQ.map(a=>a.data||''), datasets:[{
          label:'RCQ', data: serieRCQ.map(a=>Number(a.rcq)),
          tension:0.35, borderWidth:3, borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.18)', fill:true,
          pointRadius:3, pointHoverRadius:5
        }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:false}} }
      });
      rcqEmpty.style.display='none';
    } else if (rcqEmpty) rcqEmpty.style.display='block';

    // WHtR
    const whtrCtx = document.getElementById('chartWHtR');
    const whtrEmpty = document.getElementById('whtrEmpty');
    if (whtrChart) whtrChart.destroy();
    if (whtrCtx && serieWHtR.length){
      const labels = serieWHtR.map(a=>a.data||'');
      whtrChart = new Chart(whtrCtx, {
        type:'line',
        data:{ labels,
          datasets:[
            { label:'WHtR', data: serieWHtR.map(a=>Number(a.whtr)),
              tension:0.35, borderWidth:3, borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.18)', fill:true,
              pointRadius:3, pointHoverRadius:5 },
            { label:'Guia 0.50', data: labels.map(()=>0.5),
              borderWidth:1, borderColor:'#888', pointRadius:0, fill:false, borderDash:[6,4], tension:0 }
          ]},
        options:{ responsive:true, plugins:{legend:{display:false}},
          scales:{ y:{ beginAtZero:false, suggestedMin:0.35, suggestedMax:0.75 } } }
      });
      whtrEmpty.style.display='none';
    } else if (whtrEmpty) whtrEmpty.style.display='block';
  }
};