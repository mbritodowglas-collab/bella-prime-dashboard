import { Store } from '../app.js';

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

    // Treinos registrados
    const treinos = Array.isArray(c.treinos) ? c.treinos.slice().sort((a,b)=> (a.inicio||'').localeCompare(b.inicio||'')) : [];
    const blocoTreinos = `
      <section class="card">
        <div class="row" style="justify-content:space-between;align-items:center;">
          <h3>Treinos Registrados</h3>
          <div class="row" style="gap:10px;">
            <button class="btn btn-outline" id="novoTreinoBtn">+ Registrar Treino</button>
            <button class="btn btn-primary" id="gerarPromptBtn">⚙️ Gerar Prompt</button>
          </div>
        </div>
        ${treinos.length === 0 ? `
          <div style="color:#aaa;margin-top:8px;">Nenhum treino registrado ainda.</div>
        ` : `
          <table class="table" style="margin-top:10px;">
            <thead><tr><th>Início</th><th>Vencimento</th><th>Programa</th><th>Observações</th></tr></thead>
            <tbody>
              ${treinos.map(t => `
                <tr>
                  <td>${t.inicio || '-'}</td>
                  <td>${t.vencimento || '-'}</td>
                  <td>${t.programa || '-'}</td>
                  <td>${t.notas || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </section>
    `;

    return `
      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>${escapeHTML(c.nome || '')}</h2>
        <p><b>Nível:</b> <span class="badge">${c.nivel || '-'}</span></p>
        ${c.objetivo ? `<p><b>Objetivo:</b> ${escapeHTML(c.objetivo)}</p>` : ''}
        ${c.cidade  ? `<p><b>Cidade/Estado:</b> ${escapeHTML(c.cidade)}</p>` : ''}
        ${c.contato ? `<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>` : ''}
      </section>

      ${blocoTreinos}

      <section class="card">
        <h3>Histórico de Avaliações</h3>
        <table class="table">
          <thead><tr><th>Data</th><th>Nível</th><th>Pontuação</th></tr></thead>
          <tbody>${historico || '<tr><td colspan="3">Nenhum registro ainda.</td></tr>'}</tbody>
        </table>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    // Registrar novo treino
    const novoBtn = document.getElementById('novoTreinoBtn');
    if (novoBtn){
      novoBtn.addEventListener('click', () => {
        const inicio = prompt('Data de início (AAAA-MM-DD):', todayISO());
        if (!inicio) return;
        const vencimento = prompt('Data de vencimento (AAAA-MM-DD):', '');
        const programa = prompt('Programa aplicado (ex.: ABC, ABCD):', '');
        const notas = prompt('Observações adicionais:', '');

        const treinos = Array.isArray(c.treinos) ? c.treinos.slice() : [];
        treinos.push({ inicio, vencimento, programa, notas });

        const updated = { ...c, treinos: treinos.sort((a,b)=> (a.inicio||'').localeCompare(b.inicio||'')) };
        Store.upsert(updated);

        alert('Treino registrado.');
        location.hash = `#/cliente/${c.id}`;
      });
    }

    // Gerar prompt de prescrição
    const gerarBtn = document.getElementById('gerarPromptBtn');
    if (gerarBtn){
      gerarBtn.addEventListener('click', () => {
        const nivel = (c.nivel || '').toLowerCase();
        const restricao = (c._answers?.["restrição física"] || c._answers?.["patologia"] || '').trim();
        let prompt = '';

        if (nivel.includes('fund')) {
          prompt = `
Gere um plano de treino para uma aluna do nível **Fundação** do programa *Bella Prime · Evo360 Bodybuilding*.
Escolha entre divisões **ABC** ou **ABCD** (sem outras variações).
Considere os princípios:
- Coordenação, base técnica e hábito.
- Sem periodização formal.
- Repetições 12–15, intensidade leve (50–65% 1RM).
- Métodos: pirâmide truncada leve, circuito leve, isometria de 2s.
Inclua prescrição de cardio final (LISS ou MISS) conforme o modelo Karvonen.

Restrições clínicas ou físicas: ${restricao || 'nenhuma informada'}.
        `.trim();
        }
        else if (nivel.includes('asc')) {
          prompt = `
Gere um plano de treino para uma aluna do nível **Ascensão** do programa *Bella Prime · Evo360 Bodybuilding*.
Use divisão ABCD ou ABCDE conforme necessidade.
Inclua breve descrição dos mesociclos (Base, Densidade, Lapidação) e ajuste de intensidade progressiva (65–75% 1RM).
Prescreva cardio complementar por FCR (Karvonen).
Restrições clínicas ou físicas: ${restricao || 'nenhuma informada'}.
        `.trim();
        }
        else {
          prompt = `
Gere um plano de treino para uma aluna de nível ${c.nivel || 'Domínio'}.
Inclua foco de performance, variação de métodos e ajuste fino de recuperação.
Restrições clínicas ou físicas: ${restricao || 'nenhuma informada'}.
        `.trim();
        }

        navigator.clipboard.writeText(prompt);
        alert('Prompt copiado para a área de transferência!');
      });
    }
  }
};

// helpers
function escapeHTML(s){ return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function todayISO(){ const d=new Date(); const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),da=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${da}`; }