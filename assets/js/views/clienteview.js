import { Store } from '../app.js';

let chartRef = null;

export const ClienteView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    const historico = (c.avaliacoes || [])
      .sort((a,b)=> a.data.localeCompare(b.data))
      .map(a=> `
        <tr>
          <td>${a.data}</td>
          <td>${a.nivel}</td>
          <td>${a.pontuacao}</td>
        </tr>
      `).join('');

    return `
      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>${escapeHTML(c.nome || '')}</h2>
        <p><b>Nível atual:</b> <span class="badge">${c.nivel}</span></p>
        <p><b>Última pontuação:</b> ${c.pontuacao ?? '-'}</p>
        <p><b>Última avaliação:</b> ${c.ultimoTreino ?? '-'}</p>
        ${c.objetivo ? `<p><b>Objetivo:</b> ${escapeHTML(c.objetivo)}</p>` : ''}
        ${c.email ? `<p><b>E-mail:</b> ${escapeHTML(c.email)}</p>` : ''}
        ${c.contato ? `<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>` : ''}
      </section>

      <section class="card">
        <h3>Histórico de Avaliações</h3>
        <table class="table">
          <thead><tr><th>Data</th><th>Nível</th><th>Pontuação</th></tr></thead>
          <tbody>${historico || '<tr><td colspan="3">Nenhum registro ainda.</td></tr>'}</tbody>
        </table>
      </section>

      <section class="card chart-card">
        <h3>Evolução de Pontuação</h3>
        <canvas id="chartEvolucao" height="160"></canvas>
      </section>

      <section class="card">
        <button class="btn btn-primary" id="novaAvaliacaoBtn">+ Nova Avaliação</button>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    const ctx = document.getElementById('chartEvolucao');
    if (chartRef) chartRef.destroy();

    const labels = (c.avaliacoes || []).map(a => a.data);
    const pontos = (c.avaliacoes || []).map(a => a.pontuacao);

    chartRef = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Pontuação',
          data: pontos,
          tension: 0.4,
          borderWidth: 3,
          borderColor: '#d4af37',
          backgroundColor: 'rgba(212,175,55,0.2)',
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 2 } } }
      }
    });

    const btn = document.getElementById('novaAvaliacaoBtn');
    if (btn) btn.addEventListener('click', () => { location.hash = `#/avaliacao/${id}`; });
  }
};

function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}