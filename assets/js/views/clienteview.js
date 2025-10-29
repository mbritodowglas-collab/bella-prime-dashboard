import { Store } from '../app.js';

let pesoChart = null;
let rcqChart  = null;

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

    // Bloco de respostas completas (só se existir e tiver algo)
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

    // Info antropométrica mais recente (se houver)
    const last = (c.avaliacoes||[]).slice().reverse().find(a => a.peso || a.cintura || a.quadril || a.rcq) || {};
    const resumoAntropo = (last.peso || last.rcq)
      ? `<p style="margin-top:6px"><b>Peso atual:</b> ${fmtNum(last.peso)} kg
         ${last.rcq ? ` · <b>RCQ:</b> ${fmtNum(last.rcq, 3)}` : ''}</p>`
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

      <section class="card">
        <button class="btn btn-primary" id="novaAvaliacaoBtn">+ Nova Avaliação</button>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    // botão copiar (respostas do Sheets)
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

    // ====== Gráfico de Peso ======
    const pesoCtx = document.getElementById('chartPeso');
    const pesoEmpty = document.getElementById('pesoEmpty');
    const seriePeso = (c.avaliacoes || [])
      .filter(a => typeof a.peso === 'number' && !isNaN(a.peso))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));

    if (pesoChart) pesoChart.destroy();
    if (seriePeso.length >= 1 && pesoCtx) {
      pesoChart = new Chart(pesoCtx, {
        type: 'line',
        data: {
          labels: seriePeso.map(a => a.data || ''),
          datasets: [{
            label: 'Peso (kg)',
            data: seriePeso.map(a => a.peso),
            tension: 0.35,
            borderWidth: 3,
            borderColor: '#d4af37',
            backgroundColor: 'rgba(212,175,55,0.18)',
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: false }
          }
        }
      });
      if (pesoEmpty) pesoEmpty.style.display = 'none';
    } else {
      if (pesoEmpty) pesoEmpty.style.display = 'block';
    }

    // ====== Gráfico de RCQ ======
    const rcqCtx = document.getElementById('chartRCQ');
    const rcqEmpty = document.getElementById('rcqEmpty');
    const serieRCQ = (c.avaliacoes || [])
      .map(a => ({ ...a, rcq: (typeof a.rcq === 'number' && !isNaN(a.rcq))
        ? a.rcq
        : (a.cintura && a.quadril && a.quadril !== 0 ? a.cintura / a.quadril : undefined) }))
      .filter(a => typeof a.rcq === 'number' && !isNaN(a.rcq))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));

    if (rcqChart) rcqChart.destroy();
    if (serieRCQ.length >= 1 && rcqCtx) {
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
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: false }
          }
        }
      });
      if (rcqEmpty) rcqEmpty.style.display = 'none';
    } else {
      if (rcqEmpty) rcqEmpty.style.display = 'block';
    }

    const btn = document.getElementById('novaAvaliacaoBtn');
    if (btn) btn.addEventListener('click', () => { location.hash = `#/avaliacao/${id}`; });
  }
};

// helpers
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapePlain(s){ return String(s || '').replace(/\r?\n/g, '\n'); }
function fmtNum(v, digits=1){
  return (typeof v === 'number' && !isNaN(v)) ? Number(v).toFixed(digits) : '-';
}