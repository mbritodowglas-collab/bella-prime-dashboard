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

// ---------- Presets/Intensidades (seu bloco atual) ----------
/* ... mantenha aqui exatamente seu bloco PARAMS, intensidadesParaNivel_UI,
   extrairRestricoes e renderIntensidades ... */

// ---------- UI ----------
export const TreinoView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<section class="card"><h2>Cliente não encontrada</h2></section>`;
    const programas = programsByLevel(c.nivel || 'Fundação');
    const hoje = todayISO();
    const venc = addDays(hoje, 28);

    const css = `
      <style>
        .tw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        @media (max-width:760px){.tw-grid{grid-template-columns:1fr}}
        .tw-textarea{width:100%;min-height:220px;resize:vertical;padding:12px;border-radius:10px;border:1px solid var(--border);
          background:rgba(255,255,255,.03);color:#eee;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace}
        .tw-help{opacity:.75;margin-top:6px;display:block}
      </style>
    `;

    return `
      ${css}
      <section class="card">
        <a href="#/cliente/${c.id}" class="btn btn-outline" style="margin-bottom:10px">← Voltar</a>
        <h2>Lançar novo treino — ${escapeHTML(c.nome || '')}</h2>
        <p>Nível atual: <span class="badge">${c.nivel || '-'}</span></p>
      </section>

      <section class="card">
        <div class="tw-grid">
          <div class="field">
            <label>Programa</label>
            <select id="progSel" class="input">
              ${programas.map(p=>`<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>

          <div class="field">
            ${renderIntensidades(c.nivel || 'Fundação')}
          </div>

          <div class="field">
            <label>Início</label>
            <input id="ini" type="date" class="input" value="${hoje}">
          </div>

          <div class="field">
            <label>Vencimento</label>
            <input id="ven" type="date" class="input" value="${venc}">
          </div>

          <div class="field" style="grid-column:1/-1">
            <label>Observação (opcional)</label>
            <input id="obs" type="text" class="input" placeholder="Anotações rápidas…">
          </div>

          <div class="field" style="grid-column:1/-1">
            <label>Plano de treino (cole o que criou/usou no MFIT)</label>
            <textarea id="planoTexto" class="tw-textarea" placeholder="Ex.:
DIA A — Inferior (ênfase em quadríceps)
1) Agachamento hack — 4×8–10 (RPE 8)
2) Leg press — 4×10–12
3) Cadeira extensora — 3×12–15 (drop set na última)

Cardio: LISS 25 min · 60–65% FCR"></textarea>
            <small class="tw-help">Será salvo junto com o lançamento.</small>
          </div>
        </div>

        <div class="row" style="gap:10px;margin-top:14px;flex-wrap:wrap">
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
  const inicio = document.getElementById('ini')?.value || todayISO();
  const venc = document.getElementById('ven')?.value || addDays(inicio, 28);
  const obs = document.getElementById('obs')?.value || '';
  const plano_texto = document.getElementById('planoTexto')?.value || '';

  let intensidades = null;
  if (c.nivel === 'Domínio' || c.nivel === 'OverPrime'){
    intensidades = Array.from(document.querySelectorAll('.intItem'))
      .filter(ch => ch.checked).map(ch => ch.value);
  } else {
    intensidades = [ document.getElementById('intSel')?.value ].filter(Boolean);
  }

  return {
    id: `t_${Date.now()}`,
    data_inicio: inicio,
    data_venc: venc,
    programa,
    intensidades,
    observacao: obs,
    plano_texto
  };
}

/* manter montarPrompt, copiar, escapeHTML do seu arquivo atual */
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}