// assets/js/views/clienteview.js
import { Store } from '../app.js';

let pesoChart = null;
let rcqChart  = null;

export const ClienteView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    // ------- Histórico de avaliações (tabela) -------
    const historico = (c.avaliacoes || [])
      .slice()
      .sort((a,b)=> (a.data||'').localeCompare(b.data||''))
      .map(a=> `
        <tr>
          <td>${a.data || '-'}</td>
          <td>${a.nivel || '-'}</td>
          <td>${a.pontuacao ?? '-'}</td>
        </tr>
      `).join('');

    // ------- Resumo antropométrico (último registro com peso/RCQ) -------
    const lastAnt = (c.avaliacoes||[])
      .slice().reverse()
      .find(a => a.peso || a.cintura || a.quadril || a.rcq) || {};
    const resumoAntropo = (lastAnt.peso || lastAnt.rcq)
      ? `<p style="margin-top:6px">
           <b>Peso atual:</b> ${fmtNum(lastAnt.peso)} kg
           ${lastAnt.rcq ? ` · <b>RCQ:</b> ${fmtNum(lastAnt.rcq,3)}` : ''}
         </p>`
      : '';

    // ------- Respostas completas do Sheets -------
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

    // ------- Treinos registrados -------
    const treinos = (c.treinos || []).slice().sort((a,b)=> (b.inicio||'').localeCompare(a.inicio||''));
    const listaTreinos = treinos.length
      ? `<ul style="margin:8px 0 0 18px">
           ${treinos.map(t => `
             <li>
               <b>${escapeHTML(t.titulo || (t.divisao || '').toUpperCase())}</b>
               — ${escapeHTML(t.divisao || '-')} ·
               <i>${t.inicio || '?'}</i> → <i>${t.fim || '?'}</i>
             </li>`).join('')}
         </ul>`
      : `<div style="color:#aaa">Nenhum treino registrado ainda.</div>`;

    return `
      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>${escapeHTML(c.nome || '')}</h2>
        <p><b>Nível:</b> <span class="badge">${c.nivel || '-'}</span></p>
        ${c.contato ? `<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>` : ''}
        ${resumoAntropo}
      </section>

      <section class="card">
        <div class="row" style="align-items:center;gap:12px;justify-content:space-between">
          <h3 style="margin:0">Treinos Registrados</h3>
          <div class="row" style="gap:8px">
            <button class="btn" id="registrarTreinoBtn">+ Registrar Treino</button>
            <button class="btn btn-danger" id="gerarPromptBtn">⚙️ Gerar Prompt</button>
          </div>
        </div>
        ${listaTreinos}
      </section>

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

      ${blocoRespostas}
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    // ------ Copiar respostas completas ------
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

    // ------ Registrar Treino (apenas registra período e divisão) ------
    const regBtn = document.getElementById('registrarTreinoBtn');
    if (regBtn){
      regBtn.addEventListener('click', async () => {
        const inicio = prompt('Data de início (YYYY-MM-DD):', hojeISO());
        if (!inicio) return;
        const fim    = prompt('Data de vencimento (YYYY-MM-DD):', addDiasISO(inicio, 30));
        if (!fim) return;

        // divisões permitidas por nível
        const nivel = (c.nivel || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        const permitidas = nivel.startsWith('fund') ? ['ABC','ABCD']
                        :  nivel.startsWith('asc')  ? ['ABCD','ABCDE']
                        :  nivel.startsWith('dom')  ? ['ABCDE']
                        :  ['ABC','ABCD'];
        const divisao = prompt(`Divisão (permitidas: ${permitidas.join(', ')}):`, permitidas[0]);
        if (!divisao) return;

        const treino = {
          titulo: `Programa ${divisao}`,
          divisao,
          inicio,
          fim
        };
        c.treinos = Array.isArray(c.treinos) ? c.treinos : [];
        c.treinos.push(treino);
        Store.upsert(c);
        alert('Treino registrado!');
        location.reload();
      });
    }

    // ------ Gerar Prompt (com restrições de saúde se existirem) ------
    const promptBtn = document.getElementById('gerarPromptBtn');
    if (promptBtn){
      promptBtn.addEventListener('click', () => {
        const nivel = (c.nivel || 'Fundação');
        const nivelKey = normalizaNivelKey(nivel); // Fundacao/Ascensao/Dominio/OverPrime

        // tenta extrair “restrições” das respostas completas
        const restr = pickRestricoes(c._answers || {});
        const temRestricao = restr && restr.length > 0;

        // monta JSON mínimo de contexto do aluno
        const contexto = {
          aluno: {
            nome: c.nome || '',
            nivel,
            contato: c.contato || '',
            cidade: c.cidade || '',
            objetivo: c.objetivo || '',
          },
          antropometria: resumoAntropometria(c),
          treinos_atuais: (c.treinos || []),
          restricoes: temRestricao ? restr : []
        };

        // divisões liberadas por nível
        const divisaoLiberada = (nivelKey === 'Fundacao') ? ['ABC','ABCD']
                              : (nivelKey === 'Ascensao') ? ['ABCD','ABCDE']
                              : (nivelKey === 'Dominio')  ? ['ABCDE']
                              : ['ABC','ABCD'];

        const prompt = [
`Você é o sistema "Bella Prime · Evo360 Bodybuilding" (versão 2025.03).`,
`Gere uma PRESCRIÇÃO DE TREINO clara e executável para a aluna abaixo.`,
`Formato de saída:`,
`1) TÍTULO DO PROGRAMA (divisão, frequência/semana, duração do bloco).`,
`2) PLANEJAMENTO SEMANAL (A, B, C, ... com grupos-alvo).`,
`3) SESSÕES detalhadas (ordem sugerida, exercícios 6–8, séries, reps, descanso, cadência, método permitido).`,
`4) CARDIO por FCR (Karvonen) ao final – descreva tipo, duração e %FCR.`,
`5) OBSERVAÇÕES operacionais (execução, progressão, forma de ajuste).`,
`${temRestricao ? '6) ALERTAS DE SEGURANÇA específicos às restrições.' : ''}`,
`REGRAS: limite-se às divisões liberadas para o nível atual.`,
`Nível: ${nivel} | Divisões liberadas: ${divisaoLiberada.join(', ')}`,
`Contexto do aluno (JSON compacto):`,
"```json",
JSON.stringify(contexto, null, 2),
"```",
`Se houver restrições, incluir seção “Alertas de Segurança” com adaptações objetivas.`
].join('\n');

        // abre modal simples com textarea para copiar
        abreModalPrompt(prompt);
      });
    }

    // ------ Gráfico de Peso ------
    const pesoCtx   = document.getElementById('chartPeso');
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
        options: { responsive:true, plugins:{ legend:{ display:false }}, scales:{ y:{ beginAtZero:false } } }
      });
      if (pesoEmpty) pesoEmpty.style.display = 'none';
    } else {
      if (pesoEmpty) pesoEmpty.style.display = 'block';
    }

    // ------ Gráfico de RCQ ------
    const rcqCtx   = document.getElementById('chartRCQ');
    const rcqEmpty = document.getElementById('rcqEmpty');
    const serieRCQ = (c.avaliacoes || [])
      .map(a => ({ ...a, rcq: (typeof a.rcq === 'number' && !isNaN(a.rcq))
        ? a.rcq
        : (a.cintura && a.quadril && a.quadril !== 0 ? a.cintura / a.quadril : undefined) }))
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
            tension: 0.35,
            borderWidth: 3,
            borderColor: '#d4af37',
            backgroundColor: 'rgba(212,175,55,0.18)',
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false }}, scales:{ y:{ beginAtZero:false } } }
      });
      if (rcqEmpty) rcqEmpty.style.display = 'none';
    } else {
      if (rcqEmpty) rcqEmpty.style.display = 'block';
    }
  }
};

// ================== helpers ==================
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapePlain(s){ return String(s || '').replace(/\r?\n/g, '\n'); }
function fmtNum(v, digits=1){ return (typeof v === 'number' && !isNaN(v)) ? Number(v).toFixed(digits) : '-'; }
function hojeISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function addDiasISO(iso, n=30){ const d=new Date(`${iso}T12:00:00`); d.setDate(d.getDate()+n); return hojeDeDate(d); }
function hojeDeDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function normalizaNivelKey(n){
  const s = String(n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (s.startsWith('fund')) return 'Fundacao';
  if (s.startsWith('asc'))  return 'Ascensao';
  if (s.startsWith('dom'))  return 'Dominio';
  if (s.startsWith('over')) return 'OverPrime';
  return 'Fundacao';
}

// tenta achar “restrições” nas respostas abertas do formulário
function pickRestricoes(ans){
  const keys = Object.keys(ans || {});
  const hit = [];
  for (const k of keys){
    const v = String(ans[k] ?? '').trim();
    const keyL = k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if (!v) continue;
    if (keyL.includes('restricao') || keyL.includes('lesao') || keyL.includes('patologia') || keyL.includes('condicao') || keyL.includes('saude')){
      hit.push(`${k}: ${v}`);
    }
  }
  return hit;
}

function resumoAntropometria(c){
  const last = (c.avaliacoes||[]).slice().reverse()[0] || {};
  return {
    peso: (typeof last.peso==='number' && !isNaN(last.peso)) ? last.peso : undefined,
    cintura: last.cintura ?? undefined,
    quadril: last.quadril ?? undefined,
    rcq: (typeof last.rcq==='number' && !isNaN(last.rcq)) ? last.rcq : undefined
  };
}

// Modal simples pra copiar prompt
function abreModalPrompt(texto){
  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;
  `;
  wrap.innerHTML = `
    <div style="width:min(900px,92vw);background:#111;border:1px solid #333;border-radius:12px;padding:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <h3 style="margin:0">Prompt de Prescrição</h3>
        <div>
          <button id="copyPrompt" class="btn btn-outline" style="margin-right:8px">Copiar</button>
          <button id="closePrompt" class="btn btn-danger">Fechar</button>
        </div>
      </div>
      <textarea id="promptBox" style="width:100%;height:60vh;background:#0b0b0b;color:#eee;border:1px solid #333;border-radius:8px;padding:10px">${escapePlain(texto)}</textarea>
    </div>
  `;
  document.body.appendChild(wrap);

  const ta = wrap.querySelector('#promptBox');
  wrap.querySelector('#copyPrompt').onclick = () => { ta.select(); document.execCommand('copy'); };
  wrap.querySelector('#closePrompt').onclick = () => { document.body.removeChild(wrap); };
}