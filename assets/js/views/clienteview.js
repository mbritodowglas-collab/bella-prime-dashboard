// Cliente (perfil + histórico + gráfico)
import { Store, statusCalc } from '../app.js';

let chartRef = null;

export const ClienteView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    // ordena histórico por data (asc)
    const avs = [...(c.avaliacoes || [])].sort((a,b)=> a.data.localeCompare(b.data));

    const historico = avs.map(a=> `
      <tr>
        <td>${a.data}</td>
        <td>${escapeHTML(a.nivel || '-')}</td>
        <td>${a.pontuacao ?? '-'}</td>
      </tr>
    `).join('');

    // badge por nível
    const levelClass = {
      'Fundação': 'level-fundacao',
      'Ascensão': 'level-ascensao',
      'Domínio': 'level-dominio',
      'OverPrime': 'level-overprime'
    }[c.nivel] || 'level-fundacao';

    // status do plano
    const st = statusCalc(c);

    return `
      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>${escapeHTML(c.nome || '')}</h2>

        <p><b>Nível atual:</b> <span class="badge ${levelClass}">${c.nivel || '-'}</span></p>
        <p><b>Última pontuação:</b> ${c.pontuacao ?? '-'}</p>
        <p><b>Última avaliação:</b> ${c.ultimoTreino || '-'}</p>
        <p><b>Status do plano:</b> <span class="status ${st.klass}">${st.label}</span></p>

        ${c.objetivo ? `<p><b>Objetivo:</b> ${escapeHTML(c.objetivo)}</p>` : ''}
        ${c.cidade ? `<p><b>Cidade:</b> ${escapeHTML(c.cidade)}</p>` : ''}
        ${c.email ? `<p><b>E-mail:</b> ${escapeHTML(c.email)}</p>` : ''}
        ${c.contato ? `<p><b>WhatsApp/Contato:</b> ${escapeHTML(c.contato)}</p>` : ''}
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
        <canvas id="chartEvolucao" height="160" aria-label="Evolução de Pontuação"></canvas>
        ${avs.length ? '' : '<p style="color:#888;margin-top:8px">Sem dados suficientes para o gráfico.</p>'}
      </section>

      <section class="card">
        <button class="btn btn-primary" id="novaAvaliacaoBtn">+ Nova Avaliação</button>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    const avs = [...(c.avaliacoes || [])].sort((a,b)=> a.data.localeCompare(b.data));
    const labels = avs.map(a => a.data);
    const pontos = avs.map(a => a.pontuacao);

    // gráfico (com fallback se Chart.js não carregou)
    const ctx = document.getElementById('chartEvolucao');
    if (chartRef) { try { chartRef.destroy(); } catch {} chartRef = null; }

    if (ctx && labels.length){
      try{
        // eslint-disable-next-line no-undef
        chartRef = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Pontuação',
              data: pontos,
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
            scales: { y: { beginAtZero: true, ticks: { stepSize: 2 } } }
          }
        });
      }catch(e){
        console.warn('Chart.js não carregado, pulando gráfico.', e);
        ctx.insertAdjacentHTML('afterend', `<p style="color:#888;margin-top:8px">Gráfico indisponível (Chart.js não carregado).</p>`);
      }
    }

    // botão de nova avaliação
    const btn = document.getElementById('novaAvaliacaoBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        location.hash = `#/avaliacao/${id}`;
      });
    }
  }
};

// === helpers ===
function escapeHTML(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}