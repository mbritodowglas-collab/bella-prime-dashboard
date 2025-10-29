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

    // ----- monta pares pergunta → resposta com TUDO que veio do Sheets -----
    const { pares, linhasTexto, jsonStr } = buildAnswerBlocks(c);

    const respostasHTML = pares.length
      ? `<dl class="kv">${pares.map(([k,v])=>(
          `<div class="kv-row"><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`
        )).join('')}</dl>`
      : '<p style="color:#aaa">Sem respostas adicionais encontradas.</p>';

    return `
      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>${escapeHTML(c.nome || '')}</h2>
        <p><b>Nível atual:</b> <span class="badge">${c.nivel || '-'}</span></p>
        <p><b>Última pontuação:</b> ${c.pontuacao ?? '-'}</p>
        <p><b>Última avaliação:</b> ${c.ultimoTreino ?? '-'}</p>
        ${c.objetivo ? `<p><b>Objetivo:</b> ${escapeHTML(c.objetivo)}</p>` : ''}
        ${c.email ? `<p><b>E-mail:</b> ${escapeHTML(c.email)}</p>` : ''}
        ${c.contato ? `<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>` : ''}
        ${c.cidade ? `<p><b>Cidade/Estado:</b> ${escapeHTML(c.cidade)}</p>` : ''}
      </section>

      <section class="card">
        <h3>Respostas da Avaliação (todas as colunas do Sheets)</h3>
        <div class="row" style="gap:10px;margin:8px 0 14px">
          <button class="btn btn-outline" id="copyListaBtn">Copiar lista</button>
          <button class="btn btn-outline" id="copyJsonBtn">Copiar JSON</button>
        </div>
        ${respostasHTML}
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

      <!-- dados pré-formatados para os botões de copiar -->
      <textarea id="__copy_lista__" style="position:absolute;left:-9999px;top:-9999px">${linhasTexto}</textarea>
      <textarea id="__copy_json__"  style="position:absolute;left:-9999px;top:-9999px">${jsonStr}</textarea>
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

    // copiar lista / JSON
    const copy = (id) => {
      const ta = document.getElementById(id);
      ta.select(); ta.setSelectionRange(0, ta.value.length);
      document.execCommand('copy');
    };
    const btnL = document.getElementById('copyListaBtn');
    const btnJ = document.getElementById('copyJsonBtn');
    if (btnL) btnL.addEventListener('click', ()=> copy('__copy_lista__'));
    if (btnJ) btnJ.addEventListener('click', ()=> copy('__copy_json__'));

    // nova avaliação
    const btn = document.getElementById('novaAvaliacaoBtn');
    if (btn) btn.addEventListener('click', () => { location.hash = `#/avaliacao/${id}`; });
  }
};

// ================= helpers =================

function buildAnswerBlocks(c){
  // Campos “internos” que não queremos repetir na lista longa
  const internos = new Set([
    'id','nome','contato','email','cidade','nivel','pontuacao','ultimoTreino',
    'objetivo','avaliacoes','renovacaoDias'
  ]);

  const pares = [];
  for (const [k, v] of Object.entries(c)){
    if (internos.has(k)) continue;
    if (v === '' || v === null || v === undefined) continue;
    // arrays/objetos diferentes de string/number/boolean viram JSON compacto
    const isPrim = (x) => ['string','number','boolean'].includes(typeof x);
    const val = isPrim(v) ? v : JSON.stringify(v);
    pares.push([k, String(val)]);
  }

  // também mostrar os principais, lá no topo já saem, mas incluímos aqui se desejar
  // (deixe comentado; a seção superior já mostra)
  // pares.unshift(['nome', c.nome||'']);

  const linhasTexto = pares.map(([k,v])=> `${k}: ${v}`).join('\n');
  const jsonStr     = JSON.stringify(c, null, 2);

  return { pares, linhasTexto, jsonStr };
}

function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}