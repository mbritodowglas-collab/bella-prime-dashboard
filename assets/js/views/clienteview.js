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

    // monta lista de respostas completas
    const answers = c._answers || c;
    const ignore = new Set(['id','avaliacoes','_answers','nivel','pontuacao','ultimoTreino','renovacaoDias']);
    const lines = Object.entries(answers)
      .filter(([k,v]) => !ignore.has(k) && v !== '' && v != null)
      .sort(([a],[b]) => a.localeCompare(b,'pt',{sensitivity:'base'}));

    const answersHTML = lines.length
      ? lines.map(([k,v]) => `<tr><td>${escapeHTML(k)}</td><td>${escapeHTML(String(v))}</td></tr>`).join('')
      : `<tr><td colspan="2">Sem respostas adicionais.</td></tr>`;

    return `
      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>${escapeHTML(c.nome || '')}</h2>
        <p><b>Nível atual:</b> <span class="badge">${c.nivel}</span></p>
        <p><b>Última pontuação:</b> ${c.pontuacao ?? '-'}</p>
        <p><b>Última avaliação:</b> ${c.ultimoTreino ?? '-'}</p>
        ${c.cidade ? `<p><b>Cidade/Estado:</b> ${escapeHTML(c.cidade)}</p>` : ''}
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
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
          <h3 style="margin:0">Respostas completas (Sheets)</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline" id="copyAnswers">Copiar tudo</button>
            <button class="btn btn-outline" id="downloadJSON">Baixar JSON</button>
          </div>
        </div>
        <table class="table" style="margin-top:10px">
          <thead><tr><th>Pergunta</th><th>Resposta</th></tr></thead>
          <tbody id="answersBody">${answersHTML}</tbody>
        </table>
      </section>

      <section class="card">
        <button class="btn btn-primary" id="novaAvaliacaoBtn">+ Nova Avaliação</button>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    // gráfico
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

    // copiar todas as respostas (texto plano "Pergunta: Resposta")
    const btnCopy = document.getElementById('copyAnswers');
    if (btnCopy){
      btnCopy.addEventListener('click', async () => {
        const answers = c._answers || c;
        const ignore = new Set(['id','avaliacoes','_answers','nivel','pontuacao','ultimoTreino','renovacaoDias']);
        const text = Object.entries(answers)
          .filter(([k,v]) => !ignore.has(k) && v !== '' && v != null)
          .sort(([a],[b]) => a.localeCompare(b,'pt',{sensitivity:'base'}))
          .map(([k,v]) => `${k}: ${String(v)}`)
          .join('\n');
        await navigator.clipboard.writeText(text || 'Sem respostas.');
        btnCopy.textContent = 'Copiado!';
        setTimeout(()=> btnCopy.textContent = 'Copiar tudo', 1500);
      });
    }

    // baixar JSON da cliente
    const btnJSON = document.getElementById('downloadJSON');
    if (btnJSON){
      btnJSON.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(c._answers || c, null, 2)], { type:'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cliente-${(c.nome||c.id||'sem-nome')}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    // botão de nova avaliação
    const btn = document.getElementById('novaAvaliacaoBtn');
    if (btn) btn.addEventListener('click', () => { location.hash = `#/avaliacao/${id}`; });
  }
};

function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}