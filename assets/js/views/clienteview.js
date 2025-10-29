import { Store } from '../app.js';

let pesoChart = null;
let rcqChart  = null;
let whtrChart = null;

export const ClienteView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    const historico = (c.avaliacoes || [])
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''))
      .map(a=> `
        <tr>
          <td>${a.data || '-'}</td>
          <td>${a.nivel || '-'}</td>
          <td>${a.pontuacao ?? '-'}</td>
        </tr>
      `).join('');

    // Bloco de respostas completas (Sheets) — opcional
    let blocoRespostas = '';
    if (c._answers && Object.keys(c._answers).length > 0) {
      const lista = Object.entries(c._answers)
        .map(([k,v]) => `<li><b>${escapeHTML(k)}:</b> ${escapeHTML(v)}</li>`)
        .join('');
      const texto = Object.entries(c._answers)
        .map(([k,v]) => `${k}: ${v}`)
        .join('\n');
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

    // Resumo antropométrico mais recente
    const last = (c.avaliacoes||[]).slice().reverse().find(a => a.peso || a.cintura || a.quadril || a.rcq || a.whtr) || {};
    const resumoAntropo = (last.peso || last.rcq || last.whtr)
      ? `<p style="margin-top:6px">
           ${last.peso ? `<b>Peso atual:</b> ${fmtNum(last.peso)} kg` : ''}
           ${last.rcq  ? ` · <b>RCQ:</b> ${fmtNum(last.rcq, 3)}` : ''}
           ${last.whtr ? ` · <b>WHtR:</b> ${fmtNum(last.whtr, 3)}` : ''}
         </p>`
      : '';

    return `
      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>${escapeHTML(c.nome || '')}</h2>
        <p><b>Nível atual:</b> <span class="badge">${c.nivel || '-'}</span></p>
        <p><b>Última pontuação:</b> ${c.pontuacao ?? '-'}</p>
        <p><b>Última avaliação:</b> ${c.ultimoTreino ?? '-'}</p>
        ${c.objetivo ? `<p><b>Objetivo:</b> ${escapeHTML(c.objetivo)}</p>` : ''}
        ${c.cidade  ? `<p><b>Cidade/Estado:</b> ${escapeHTML(c.cidade)}</p>` : ''}
        ${c.email   ? `<p><b>E-mail:</b> ${escapeHTML(c.email)}</p>` : ''}
        ${c.contato ? `<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>` : ''}
        ${resumoAntropo}
      </section>

      ${blocoRespostas}

      <section class="card">
        <h3>Histórico de Avaliações</h3>
        <table class="table">
          <thead><tr><th>Data</th><th>Nível</th><th>Pontuação</th></tr></thead>
          <tbody>${historico || '<tr><td colspan="3">Nenhum registro ainda.</td></tr>'}</tbody>
        </table>
      </section>

      <section class="card chart-card">
        <h3>Evolução do Peso (kg)</h3>
        <div id="pesoEmpty" style="display:none;color:#aaa">Sem dados de peso suficientes.</div>
        <canvas id="chartPeso" height="160"></canvas>
      </section>

      <section class="card chart-card">
        <h3>Evolução da Relação Cintura/Quadril (RCQ)</h3>
        <div id="rcqEmpty" style="display:none;color:#aaa">Sem dados de cintura/quadril suficientes.</div>
        <canvas id="chartRCQ" height="160"></canvas>
      </section>

      <section class="card chart-card">
        <h3>Relação Cintura/Estatura (WHtR)</h3>
        <div id="whtrEmpty" style="display:none;color:#aaa">Sem dados de cintura/estatura suficientes.</div>
        <canvas id="chartWHtR" height="160"></canvas>
        <small style="opacity:.75">Linha guia 0,50 = meta de saúde (cintura &lt; 50% da estatura).</small>
      </section>

      <section class="card">
        <button class="btn btn-primary" id="novaAvaliacaoBtn">+ Nova Avaliação</button>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    // copiar respostas (Sheets)
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

    // ===== Peso =====
    const pesoCtx = document.getElementById('chartPeso');
    const pesoEmpty = document.getElementById('pesoEmpty');
    const seriePeso = (c.avaliacoes || [])
      .filter(a => isNum(a.peso))
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
            tension: 0.35,
            borderWidth: 3,
            borderColor: '#d4af37',
            backgroundColor: 'rgba(212,175,55,0.18)',
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }
      });
      if (pesoEmpty) pesoEmpty.style.display = 'none';
    } else if (pesoEmpty) { pesoEmpty.style.display = 'block'; }

    // ===== RCQ (cintura/quadril) =====
    const rcqCtx = document.getElementById('chartRCQ');
    const rcqEmpty = document.getElementById('rcqEmpty');
    const serieRCQ = (c.avaliacoes || [])
      .map(a => {
        const rcq = isNum(a.rcq)
          ? Number(a.rcq)
          : (isNum(a.cintura) && isNum(a.quadril) && Number(a.quadril) !== 0
              ? Number(a.cintura) / Number(a.quadril)
              : undefined);
        return { ...a, rcq };
      })
      .filter(a => isNum(a.rcq))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));

    if (rcqChart) rcqChart.destroy();
    if (rcqCtx && serieRCQ.length >= 1) {
      rcqChart = new Chart(rcqCtx, {
        type: 'line',
        data: {
          labels: serieRCQ.map(a => a.data || ''),
          datasets: [{
            label: 'RCQ',
            data: serieRCQ.map(a => Number(a.rcq)),
            tension: 0.35,
            borderWidth: 3,
            borderColor: '#d4af37',
            backgroundColor: 'rgba(212,175,55,0.18)',
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }
      });
      if (rcqEmpty) rcqEmpty.style.display = 'none';
    } else if (rcqEmpty) { rcqEmpty.style.display = 'block'; }

    // ===== WHtR (cintura/estatura) =====
    const whtrCtx = document.getElementById('chartWHtR');
    const whtrEmpty = document.getElementById('whtrEmpty');

    const serieWHtR = (c.avaliacoes || [])
      .map(a => {
        const cintura = toNum(a.cintura);
        let altura = toNum(a.altura); // aceita cm ou m
        if (isNum(altura) && altura <= 3) altura = altura * 100; // metros -> cm
        const whtr = isNum(a.whtr)
          ? Number(a.whtr)
          : (isNum(cintura) && isNum(altura) && altura !== 0 ? Number(cintura) / Number(altura) : undefined);
        return { ...a, whtr };
      })
      .filter(a => isNum(a.whtr))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));

    if (whtrChart) whtrChart.destroy();
    if (whtrCtx && serieWHtR.length >= 1) {
      const labels = serieWHtR.map(a => a.data || '');
      whtrChart = new Chart(whtrCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'WHtR',
              data: serieWHtR.map(a => Number(a.whtr)),
              tension: 0.35,
              borderWidth: 3,
              borderColor: '#d4af37',
              backgroundColor: 'rgba(212,175,55,0.18)',
              fill: true,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            // Linha guia em 0.50
            {
              label: 'Guia 0.50',
              data: labels.map(() => 0.5),
              borderWidth: 1,
              borderColor: '#888',
              pointRadius: 0,
              fill: false,
              borderDash: [6,4],
              tension: 0
            }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: false, suggestedMin: 0.35, suggestedMax: 0.75 } }
        }
      });
      if (whtrEmpty) whtrEmpty.style.display = 'none';
    } else if (whtrEmpty) { whtrEmpty.style.display = 'block'; }

    // Nova avaliação
    const btn = document.getElementById('novaAvaliacaoBtn');
    if (btn) btn.addEventListener('click', () => { location.hash = `#/avaliacao/${id}`; });
  }
};

// ===== helpers =====
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapePlain(s){ return String(s || '').replace(/\r?\n/g, '\n'); }
function fmtNum(v, digits=1){
  return (typeof v === 'number' && !isNaN(v)) ? Number(v).toFixed(digits) : '-';
}
function isNum(v){ return typeof v === 'number' && !isNaN(v); }
function toNum(v){
  const n = Number(v);
  return (typeof n === 'number' && !isNaN(n)) ? n : undefined;
}