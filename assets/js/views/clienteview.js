import { Store, PROFESSOR_FORM_URL } from '../app.js';

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
          <td>${a.sugestaoNivel || '-'}</td>
          <td>${a.readiness || '-'}</td>
        </tr>
      `).join('');

    // respostas completas (mantido)
    let blocoRespostas = '';
    if (c._answers && Object.keys(c._answers).length > 0) {
      const lista = Object.entries(c._answers)
        .map(([k,v]) => `<li><b>${escapeHTML(k)}:</b> ${escapeHTML(v)}</li>`).join('');
      const texto = Object.entries(c._answers).map(([k,v]) => `${k}: ${v}`).join('\n');
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

    // --- Treinos registrados (mantido) ---
    const treinos = Array.isArray(c.treinos) ? c.treinos.slice().sort((a,b)=>(b.inicio||'').localeCompare(a.inicio||'')) : [];
    const linhasTreino = treinos.map(t => `
      <tr>
        <td><span class="badge">${escapeHTML(t.programa)}</span></td>
        <td>${t.inicio} → ${t.vencimento}</td>
        <td><span class="status ${t.status==='Ativo'?'st-ok':'st-bad'}">${t.status}</span></td>
        <td>${escapeHTML(t.obs || '')}</td>
      </tr>
    `).join('');

    // Badges de nível sugerido / prontidão / elegibilidade
    const sugerido = c.sugestaoNivel ? `<span class="badge" style="background:#2b6777">sugerido: ${c.sugestaoNivel}</span>` : '';
    const readyTag = c.readiness ? `<span class="badge" style="background:${badgeColor(c.readiness)}">${c.readiness}</span>` : '';
    const elegivel = c.elegivelPromocao ? `<span class="badge" style="background:#7cb342">elegível</span>` : '';
    const prontasN = c.prontaConsecutivas ? `<small style="opacity:.75">(${c.prontaConsecutivas} reavaliaç${c.prontaConsecutivas>1?'ões':'ão'} prontas seguidas)</small>` : '';

    // CTA do Professor (pré-preenchido se a URL existir)
    const linkProfessor = (PROFESSOR_FORM_URL && c.id)
      ? `${PROFESSOR_FORM_URL}?id=${encodeURIComponent(c.id)}&nome=${encodeURIComponent(c.nome||'')}`
      : '';
    const ctaProfessor = linkProfessor
      ? `<a class="btn btn-primary" href="${linkProfessor}" target="_blank" rel="noopener">📋 Abrir Formulário do Professor</a>`
      : `<button class="btn btn-outline" id="professorFormBtn" title="Defina PROFESSOR_FORM_URL no app.js">📋 Formulário do Professor</button>`;

    return `
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
          <a class="btn" href="#/treino/${c.id}/novo">➕ Lançar novo treino</a>
          ${ctaProfessor}
        </div>
      </section>

      <section class="card">
        <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
          <h3 style="margin:0">Treinos Registrados</h3>
          <a class="btn btn-primary" href="#/treino/${c.id}/novo">+ Lançar novo treino</a>
        </div>
        ${treinos.length === 0 ? `<div style="color:#aaa;margin-top:8px">Nenhum treino registrado ainda.</div>` : `
          <div style="overflow:auto;margin-top:8px">
            <table class="table">
              <thead><tr><th>Programa</th><th>Período</th><th>Status</th><th>Obs.</th></tr></thead>
              <tbody>${linhasTreino}</tbody>
            </table>
          </div>
        `}
      </section>

      ${blocoRespostas}

      <section class="card">
        <h3>Histórico de Avaliações</h3>
        <table class="table">
          <thead><tr><th>Data</th><th>Nível</th><th>Pontuação</th><th>Sugerido</th><th>Prontidão</th></tr></thead>
          <tbody>${historico || '<tr><td colspan="5">Nenhum registro ainda.</td></tr>'}</tbody>
        </table>
      </section>

      <!-- gráficos mantidos -->
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

    // aviso caso PROFESSOR_FORM_URL não esteja setado
    const profBtn = document.getElementById('professorFormBtn');
    if (profBtn){
      profBtn.addEventListener('click', ()=> {
        alert('Defina PROFESSOR_FORM_URL no app.js para abrir o Formulário do Professor com ID/nome.');
      });
    }

    // ===== Peso =====
    const pesoCtx = document.getElementById('chartPeso');
    const pesoEmpty = document.getElementById('pesoEmpty');
    const seriePeso = (c.avaliacoes || [])
      .filter(a => typeof a.peso === 'number' && !isNaN(a.peso))
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
            tension: 0.35, borderWidth: 3,
            borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.18)',
            fill: true, pointRadius: 4, pointHoverRadius: 6
          }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }
      });
      if (pesoEmpty) pesoEmpty.style.display = 'none';
    } else if (pesoEmpty) { pesoEmpty.style.display = 'block'; }

    // ===== RCQ =====
    const rcqCtx = document.getElementById('chartRCQ');
    const rcqEmpty = document.getElementById('rcqEmpty');
    const serieRCQ = (c.avaliacoes || [])
      .map(a => {
        const rcq = (typeof a.rcq === 'number' && !isNaN(a.rcq))
          ? a.rcq
          : (a.cintura && a.quadril && Number(a.quadril) !== 0 ? Number(a.cintura)/Number(a.quadril) : undefined);
        return { ...a, rcq };
      })
      .filter(a => typeof a.rcq === 'number' && !isNaN(a.rcq))
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
            tension: 0.35, borderWidth: 3,
            borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.18)',
            fill: true, pointRadius: 4, pointHoverRadius: 6
          }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:false } } }
      });
      if (rcqEmpty) rcqEmpty.style.display = 'none';
    } else if (rcqEmpty) { rcqEmpty.style.display = 'block'; }

    // ===== WHtR =====
    const whtrCtx = document.getElementById('chartWHtR');
    const whtrEmpty = document.getElementById('whtrEmpty');
    const serieWHtR = (c.avaliacoes || [])
      .map(a => {
        const cintura = toNum(a.cintura);
        let altura = toNum(a.altura);
        if (typeof altura === 'number' && altura <= 3) altura = altura*100;
        const whtr = (typeof a.whtr === 'number' && !isNaN(a.whtr))
          ? a.whtr
          : (Number.isFinite(cintura) && Number.isFinite(altura) && altura !== 0 ? cintura/altura : undefined);
        return { ...a, whtr };
      })
      .filter(a => typeof a.whtr === 'number' && !isNaN(a.whtr))
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''));
    if (whtrChart) whtrChart.destroy();
    if (whtrCtx && serieWHtR.length >= 1) {
      const labels = serieWHtR.map(a => a.data || '');
      whtrChart = new Chart(whtrCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label:'WHtR', data: serieWHtR.map(a=>Number(a.whtr)), tension:0.35, borderWidth:3,
              borderColor:'#d4af37', backgroundColor:'rgba(212,175,55,0.18)', fill:true, pointRadius:4, pointHoverRadius:6 },
            { label:'Guia 0.50', data: labels.map(()=>0.5), borderWidth:1, borderColor:'#888',
              pointRadius:0, fill:false, borderDash:[6,4], tension:0 }
          ]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } },
          scales:{ y:{ beginAtZero:false, suggestedMin:0.35, suggestedMax:0.75 } } }
      });
      if (whtrEmpty) whtrEmpty.style.display = 'none';
    } else if (whtrEmpty) { whtrEmpty.style.display = 'block'; }
  }
};

// helpers
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapePlain(s){ return String(s || '').replace(/\r?\n/g, '\n'); }
function toNum(v){ const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : undefined; }

function badgeColor(readiness){
  if (readiness === 'Pronta para subir') return '#2e7d32';
  if (readiness === 'Quase lá') return '#f9a825';
  return '#455a64';
}