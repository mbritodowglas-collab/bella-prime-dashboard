// ================================
// VIEW: Relatório da Cliente (A4/print) + gráficos (Peso, Medidas, RCQ, WHtR)
// ================================
import { Store, RELATORIO_LOGO_PNG } from '../app.js';

export const RelatorioView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<section class="card"><h2>Cliente não encontrada</h2></section>`;

    const avalsAll = (c.avaliacoes||[])
      .slice()
      .sort((a,b)=>(a.data||'').localeCompare(b.data||''));
    const ultimaAval = avalsAll[avalsAll.length-1] || {};

    const seriePeso = avalsAll.filter(a => isNum(a.peso));
    const serieCint = avalsAll.filter(a => isNum(a.cintura));
    const serieQuad = avalsAll.filter(a => isNum(a.quadril));

    const serieAbd = avalsAll
      .map(a => ({...a, abd: pickNum(a, ['abdomen','abdome'])}))
      .filter(a => isNum(a.abd));

    const serieRCQ = avalsAll.map(a => {
      const rcq = isNum(a.rcq) ? Number(a.rcq)
        : (isNum(a.cintura) && isNum(a.quadril) && Number(a.quadril)!==0
          ? Number(a.cintura)/Number(a.quadril) : undefined);
      return {...a, rcq};
    }).filter(a => isNum(a.rcq));

    const serieWHTR = avalsAll.map(a => {
      const cintura = toNum(a.cintura);
      let altura = toNum(a.altura);
      if (isNum(altura) && Number(altura) <= 3) altura = Number(altura) * 100;
      const whtr = isNum(a.whtr) ? Number(a.whtr)
        : (isNum(cintura) && isNum(altura) && Number(altura)!==0 ? Number(cintura)/Number(altura) : undefined);
      return {...a, whtr};
    }).filter(a => isNum(a.whtr));

    const treinos = (c.treinos||[]).slice().sort((a,b)=>(b.data_inicio||'').localeCompare(a.data_inicio||''));
    const planoMaisRecente = treinos.length ? (treinos[0].plano_texto || '') : '';

    const dPeso = deltaFromSeries(seriePeso, 'peso');
    const dCint = deltaFromSeries(serieCint, 'cintura');
    const dQuad = deltaFromSeries(serieQuad, 'quadril');
    const dAbd  = deltaFromSeries(serieAbd,  'abd');
    const dRCQ  = deltaFromSeries(serieRCQ,  'rcq');
    const dWHTR = deltaFromSeries(serieWHTR, 'whtr');

    const hoje = new Date();
    const ts = `${hoje.toLocaleDateString()} ${hoje.toLocaleTimeString()}`;

    return `
      <style>
        .r-wrap{max-width:900px;margin:0 auto;padding:18px}
        .r-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px}
        .r-btn{padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:#111;color:#eee;text-decoration:none}
        .r-btn.primary{background:#c62828;border-color:#c62828;color:#fff}
        .r-header{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px}
        .r-header img{height:44px}
        .r-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media (max-width:760px){ .r-grid{grid-template-columns:1fr} }
        .r-card{border:1px solid var(--border);border-radius:12px;padding:12px;background:rgba(255,255,255,.02)}
        .mono{white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; line-height:1.4}
        .muted{opacity:.75}
        .delta{display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;font-weight:700}
        .down{color:#2e7d32;background:rgba(46,125,50,.15)}
        .up{color:#c62828;background:rgba(198,40,40,.15)}
        .flat{color:#999;background:rgba(255,255,255,.08)}
        .chart-box{padding:8px 12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.02)}
        .chart-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .legend{display:flex;flex-wrap:wrap;gap:8px}
        .legend > span{display:inline-flex;align-items:center;gap:6px;font-size:12px;opacity:.9}
        .dot{width:10px;height:10px;border-radius:999px;display:inline-block}
        canvas{width:100%;height:180px}
        @media print{
          .r-actions{display:none !important}
          body{background:white}
          .r-wrap{padding:0}
          .r-card{background:white}
          .chart-box{background:white}
        }
      </style>

      <div class="r-wrap">
        <div class="r-actions">
          <a href="#/cliente/${c.id}" class="r-btn">← Voltar</a>
          <button class="r-btn primary" id="btnPrint">🧾 Imprimir / PDF</button>
          <button class="r-btn" id="btnCopyLink">⧉ Copiar link do relatório</button>
        </div>

        <div class="r-header">
          <img src="${RELATORIO_LOGO_PNG}" alt="Logo" />
          <div>
            <h2 style="margin:0">Relatório de Avaliação — ${escapeHTML(c.nome||'')}</h2>
            <div class="muted">Gerado em ${ts}</div>
          </div>
        </div>

        <div class="r-grid">
          <div class="r-card">
            <h3>Dados da cliente</h3>
            <p><b>Nível atual:</b> ${c.nivel||'-'}</p>
            <p><b>Prontidão:</b> ${c.readiness||'-'} ${c.prontaConsecutivas?`<span class="muted">(consecutivas: ${c.prontaConsecutivas})</span>`:''}</p>
            <p><b>Sugerido (última avaliação):</b> ${c.sugestaoNivel || '-'}</p>
            ${c.email?`<p><b>E-mail:</b> ${escapeHTML(c.email)}</p>`:''}
            ${c.contato?`<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>`:''}
            ${c.cidade?`<p><b>Cidade/Estado:</b> ${escapeHTML(c.cidade)}</p>`:''}
          </div>

          <div class="r-card">
            <h3>Métricas recentes</h3>
            <p><b>Data:</b> ${ultimaAval.data || '-'}</p>
            <p><b>Peso:</b> ${num(ultimaAval.peso) ?? '-'} kg ${badge(dPeso,'kg',true)}</p>
            <p><b>Cintura:</b> ${num(ultimaAval.cintura) ?? '-'} cm ${badge(dCint,'cm',true)}</p>
            <p><b>Quadril:</b> ${num(ultimaAval.quadril) ?? '-'} cm ${badge(dQuad,'cm',true)}</p>
            <p><b>Abdômen:</b> ${num(pickNum(ultimaAval,['abdomen','abdome'])) ?? '-'} cm ${badge(dAbd,'cm',true)}</p>
            <p><b>RCQ:</b> ${num(ultimaAval.rcq,3) ?? '-'} ${badge(dRCQ,'',true)} | 
               <b>WHtR:</b> ${num(ultimaAval.whtr,3) ?? '-'} ${badge(dWHTR,'',true)}</p>
          </div>
        </div>

        ${renderChartsSection(seriePeso, serieCint, serieQuad, serieAbd, serieRCQ, serieWHTR)}

        <div class="r-card" style="margin-top:14px">
          <h3>Plano de treino mais recente</h3>
          ${planoMaisRecente ? `<div class="mono">${escapeHTML(planoMaisRecente)}</div>` : '<div class="muted">— sem plano anexado —</div>'}
        </div>

        <div class="muted" style="margin-top:16px">© Bella Prime • Documento gerado automaticamente</div>
      </div>
    `;
  },

  async init(id){
    document.getElementById('btnPrint')?.addEventListener('click', ()=> window.print());
    document.getElementById('btnCopyLink')?.addEventListener('click', ()=>{
      navigator.clipboard.writeText(location.href).then(()=> alert('Link do relatório copiado.'));
    });

    const c = Store.byId(id);
    if (!c) return;
    const avals = (c.avaliacoes||[]).slice().sort((a,b)=>(a.data||'').localeCompare(b.data||''));

    // Peso
    const sPeso = avals.filter(a=>isNum(a.peso));
    drawLineChart('#rPeso', { labels: sPeso.map(a=>a.data||''), series: [{ name:'Peso', values: sPeso.map(a=>Number(a.peso)), color:'#d4af37', fill:'rgba(212,175,55,0.18)' }], ySuffix: 'kg' });

    // Medidas
    const sC = avals.filter(a=>isNum(a.cintura));
    const sQ = avals.filter(a=>isNum(a.quadril));
    const sA = avals.map(a=>({ ...a, abd: pickNum(a,['abdomen','abdome'])})).filter(a=>isNum(a.abd));
    const labelsMed = unionLabels([sC,sQ,sA]);
    drawLineChart('#rMedidas', {
      labels: labelsMed,
      series: [
        { name:'Cintura', values: alignedValues(labelsMed, sC, 'cintura'), color:'#42a5f5', fill:'rgba(66,165,245,0.14)' },
        { name:'Quadril', values: alignedValues(labelsMed, sQ, 'quadril'), color:'#ab47bc', fill:'rgba(171,71,188,0.14)' },
        { name:'Abdômen', values: alignedValues(labelsMed, sA, 'abd'), color:'#26a69a', fill:'rgba(38,166,154,0.14)' }
      ],
      ySuffix: 'cm', showIfAtLeast: 2
    });

    // RCQ
    const sR = avals.map(a=>{
      const rcq = isNum(a.rcq) ? Number(a.rcq)
        : (isNum(a.cintura)&&isNum(a.quadril)&&Number(a.quadril)!==0 ? Number(a.cintura)/Number(a.quadril) : undefined);
      return {...a, rcq};
    }).filter(a=>isNum(a.rcq));
    drawLineChart('#rRCQ', { labels: sR.map(a=>a.data||''), series: [{ name:'RCQ', values: sR.map(a=>Number(a.rcq)), color:'#ff7043', fill:'rgba(255,112,67,0.12)' }], showIfAtLeast: 2 });

    // WHtR
    const sW = avals.map(a=>{
      const cintura = toNum(a.cintura);
      let altura = toNum(a.altura);
      if (isNum(altura) && Number(altura) <= 3) altura = Number(altura)*100;
      const whtr = isNum(a.whtr) ? Number(a.whtr)
        : (isNum(cintura)&&isNum(altura)&&Number(altura)!==0 ? Number(cintura)/Number(altura) : undefined);
      return {...a, whtr};
    }).filter(a=>isNum(a.whtr));
    drawLineChart('#rWHTR', { labels: sW.map(a=>a.data||''), series: [{ name:'WHtR', values: sW.map(a=>Number(a.whtr)), color:'#66bb6a', fill:'rgba(102,187,106,0.12)' }], guideY: 0.50, showIfAtLeast: 2 });
  }
};

// ---------------- helpers ----------------
function renderChartsSection(seriePeso, serieCint, serieQuad, serieAbd, serieRCQ, serieWHTR){
  return `
    <!-- Gráficos -->
    <div class="r-card" style="margin-top:14px">
      <div class="chart-title"><h3>Evolução do Peso</h3></div>
      <canvas id="rPeso" width="900" height="200"></canvas>
    </div>
    <div class="r-card" style="margin-top:14px">
      <div class="chart-title"><h3>Redução de Medidas</h3></div>
      <canvas id="rMedidas" width="900" height="200"></canvas>
    </div>
    <div class="r-card" style="margin-top:14px">
      <div class="chart-title"><h3>RCQ — Relação Cintura/Quadril</h3></div>
      <canvas id="rRCQ" width="900" height="200"></canvas>
    </div>
    <div class="r-card" style="margin-top:14px">
      <div class="chart-title"><h3>WHtR — Relação Cintura/Estatura</h3></div>
      <canvas id="rWHTR" width="900" height="200"></canvas>
    </div>`;
}

function isNum(v){ const n = Number(v); return Number.isFinite(n); }
function toNum(v){ const n = Number(String(v??'').replace(',', '.')); return Number.isFinite(n) ? n : undefined; }
function num(v, d=2){ const n = Number(v); return Number.isFinite(n)? n.toFixed(d): undefined; }
function escapeHTML(s){ return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function pickNum(obj, keys){ for (const k of keys){ const v = obj?.[k]; const n = toNum(v); if (isNum(n)) return n; } return undefined; }
function deltaFromSeries(series, key){ if (!Array.isArray(series)||series.length<2)return null; const first=Number(series[0][key]); const last=Number(series[series.length-1][key]); if(!isNum(first)||!isNum(last))return null; return last-first; }
function badge(delta, unit='', lowerIsBetter=false){ if (delta===null)return''; if(delta===0)return`<span class="delta flat">=0${unit}</span>`; const cls=(lowerIsBetter?delta<0:delta>0)?'down':'up'; const arrow=(cls==='down'?'▼':'▲'); const abs=Math.abs(delta).toFixed(unit?1:3); return `<span class="delta ${cls}">${arrow} ${abs}${unit?' '+unit:''}</span>`; }
function unionLabels(arr){ const set=new Set(); arr.forEach(s=>s.forEach(a=>set.add(a.data||''))); return [...set].sort(); }
function alignedValues(all, s, key){ const map=new Map(s.map(a=>[a.data||'',Number(a[key])])); return all.map(lbl=>map.has(lbl)?map.get(lbl):null); }

function drawLineChart(selector,{labels,series,ySuffix='',showIfAtLeast=2,guideY=null}){
  const cvs=document.querySelector(selector); if(!cvs)return;
  const pointsCount=(series||[]).reduce((acc,s)=>acc+(s.values||[]).filter(v=>v!==null&&v!==undefined).length,0);
  if(pointsCount<showIfAtLeast)return;
  const ctx=cvs.getContext('2d'),W=cvs.width,H=cvs.height; ctx.clearRect(0,0,W,H);
  const pad={l:48,r:16,t:10,b:26};
  const vals=[]; series.forEach(s=>(s.values||[]).forEach(v=>{if(v!==null&&v!==undefined)vals.push(Number(v));}));
  if(!vals.length)return;
  const minV=Math.min(...vals),maxV=Math.max(...vals),range=(maxV-minV)||1,yMin=minV-range*0.08,yMax=maxV+range*0.08;
  const xStep=(W-pad.l-pad.r)/Math.max(1,(labels.length-1)),yScale=(H-pad.t-pad.b)/(yMax-yMin);
  const X=i=>pad.l+i*xStep,Y=v=>H-pad.b-(v-yMin)*yScale;
  const AXIS='#888',TEXT='#bbb';
  ctx.strokeStyle=AXIS;ctx.lineWidth=1;ctx.setLineDash([4,4]);
  for(let g=0;g<=3;g++){const gy=pad.t+(H-pad.t-pad.b)*(g/3);ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(W-pad.r,