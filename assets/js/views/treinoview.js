// ================================
// VIEW: Lançar novo treino
// ================================
import { Store, programsByLevel } from '../app.js';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const addDays = (iso, days=28) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};

// Intensidades locais (evita import quebrado)
function intensidadesParaNivel(nivel) {
  const n = String(nivel||'').toLowerCase();
  if (n.startsWith('dom') || n.startsWith('over')) {
    return [
      'Base Intermediária (≈65–70%)',
      'Densidade / Hipertrofia (≈70–75%)',
      'Força Relativa (≈75–85%)',
      'Lapidação / Refinamento (≈75–80%)'
    ];
  }
  return null;
}

export const TreinoView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<section class="card"><h2>Cliente não encontrada</h2></section>`;

    const programas = programsByLevel(c.nivel || 'Fundação');
    const intensidades = intensidadesParaNivel(c.nivel);

    const hoje = todayISO();
    const venc = addDays(hoje, 28);

    return `
      <section class="card">
        <a href="#/cliente/${c.id}" class="btn btn-outline" style="margin-bottom:10px">← Voltar</a>
        <h2>Lançar novo treino — ${escapeHTML(c.nome || '')}</h2>
        <p>Nível atual: <span class="badge">${c.nivel || '-'}</span></p>
      </section>

      <section class="card">
        <div class="row" style="gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="field">
            <label>Programa</label>
            <select id="progSel" class="input">
              ${programas.map(p=>`<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>

          ${intensidades ? `
          <div class="field">
            <label>Intensidade</label>
            <select id="intSel" class="input">
              ${intensidades.map(i=>`<option value="${escapeHTML(i)}">${escapeHTML(i)}</option>`).join('')}
            </select>
          </div>` : ''}

          <div class="field">
            <label>Início</label>
            <input id="ini" type="date" class="input" value="${hoje}">
          </div>

          <div class="field">
            <label>Vencimento</label>
            <input id="ven" type="date" class="input" value="${venc}">
          </div>

          <div class="field" style="flex:1 1 260px">
            <label>Observação (opcional)</label>
            <input id="obs" type="text" class="input" placeholder="Anotações rápidas…">
          </div>
        </div>

        <div class="row" style="gap:10px;margin-top:14px">
          <button class="btn btn-primary" id="salvarBtn">Salvar</button>
          <button class="btn btn-danger"  id="promptBtn">⚙️ Gerar Prompt</button>
        </div>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    const salvarBtn = document.getElementById('salvarBtn');
    const promptBtn = document.getElementById('promptBtn');

    salvarBtn?.addEventListener('click', () => {
      const rec = lerFormulario(c);
      if (!Array.isArray(c.treinos)) c.treinos = [];
      c.treinos.push(rec);
      Store.upsert(c);
      location.hash = `#/cliente/${c.id}`;
    });

    promptBtn?.addEventListener('click', () => {
      const rec = lerFormulario(c);
      const texto = montarPrompt(c, rec);
      copiar(texto);
      promptBtn.textContent = 'Prompt copiado!';
      setTimeout(()=> promptBtn.textContent = '⚙️ Gerar Prompt', 1200);
    });
  }
};

// -------- helpers --------
function lerFormulario(c){
  const programa = document.getElementById('progSel')?.value || 'ABC';
  const intensidade = document.getElementById('intSel')?.value || null;
  const inicio = document.getElementById('ini')?.value || todayISO();
  const venc = document.getElementById('ven')?.value || addDays(inicio, 28);
  const obs = document.getElementById('obs')?.value || '';

  return {
    id: `t_${Date.now()}`,
    data_inicio: inicio,
    data_venc: venc,
    programa,
    intensidade,
    observacao: obs
  };
}

function montarPrompt(cliente, treino){
  const answers = cliente._answers || {};
  const txtRestricoes = extrairRestricoes(answers);

  const linhas = [
    "Você é prescritor do sistema Bella Prime · Evo360.",
    "Gere um PROGRAMA DE TREINO estruturado seguindo as regras do nível.",
    "",
    `Cliente: ${cliente.nome} | Nível: ${cliente.nivel || '-'}`,
    `Programa: ${treino.programa}${treino.intensidade ? ` | Intensidade: ${treino.intensidade}` : ''}`,
    `Período: ${treino.data_inicio} → ${treino.data_venc}`,
    cliente.objetivo ? `Objetivo declarado: ${cliente.objetivo}` : null,
    txtRestricoes ? `Restrições/atenções: ${txtRestricoes}` : null,
    treino.observacao ? `Observações do coach: ${treino.observacao}` : null,
    "",
    "Formato de saída:",
    "- Sessions (A, B, C...), com Mobilidade (3 itens), Principais (6–8 exercícios), parâmetros (séries, reps, descanso, cadência).",
    "- Cardio ao final por FCR (Karvonen): tipo, duração, %FCR e instrução prática.",
    "- Aplicar observações do método (pirâmide truncada ±5%, isometria leve 2s, circuito leve) quando couber."
  ];
  return linhas.filter(Boolean).join('\n');
}

/**
 * Extrai restrições olhando **apenas os valores** das respostas.
 * Remove exemplos em parênteses e deduplica.
 * Resultado típico: "atenção a: asma"
 */
function extrairRestricoes(ans){
  // pega apenas os VALORES das respostas
  const valores = Object.values(ans)
    .map(v => String(v || '').toLowerCase())
    // remove qualquer coisa entre parênteses: (lesão, dor, asma...)
    .map(s => s.replace(/\([^)]*\)/g, ' '))
    // normaliza múltiplos espaços
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!valores.length) return '';

  const keywords = [
    'asma','lesão','lesao','dor','hérnia','hernia','lombar','joelho','ombro',
    'tendinite','condromalácia','condromalacia','hipertensão','pressão',
    'diabetes','gestação','gravidez'
  ];

  const achados = new Set();
  for (const v of valores){
    for (const k of keywords){
      // procura a palavra como token (evita falsos positivos dentro de outras)
      const rx = new RegExp(`\\b${k}\\b`, 'i');
      if (rx.test(v)) achados.add(k);
    }
  }

  const lista = [...achados];
  return lista.length ? `atenção a: ${lista.join(', ')}` : '';
}

function copiar(s){
  const ta = document.createElement('textarea');
  ta.value = s;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}