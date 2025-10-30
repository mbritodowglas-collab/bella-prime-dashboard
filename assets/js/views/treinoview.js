import { Store, programsByLevel } from '../app.js';

export const TreinoView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    const permitidos = programsByLevel(c.nivel || 'Fundação');
    const hoje = localISO();
    const daqui30 = addDaysISO(hoje, 30);

    return `
      <section class="card">
        <a href="#/cliente/${c.id}" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>Lançar novo treino — ${escapeHTML(c.nome)}</h2>
        <p style="opacity:.8;margin-top:6px">Nível atual: <b>${c.nivel || '-'}</b></p>
      </section>

      <section class="card">
        <div class="row" style="gap:12px;align-items:flex-end">
          <div style="flex:1;min-width:180px">
            <label class="label">Programa</label>
            <select id="prog" class="input">
              ${permitidos.map(p=>`<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="label">Início</label>
            <input id="inicio" type="date" class="input" value="${hoje}">
          </div>

          <div>
            <label class="label">Vencimento</label>
            <input id="venc" type="date" class="input" value="${daqui30}">
          </div>

          <div style="flex:1">
            <label class="label">Observação (opcional)</label>
            <input id="obs" class="input" placeholder="Anotações rápidas...">
          </div>

          <div>
            <button id="saveTreino" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    document.getElementById('saveTreino').addEventListener('click', () => {
      const prog  = document.getElementById('prog').value;
      const ini   = document.getElementById('inicio').value;
      const venc  = document.getElementById('venc').value;
      const obs   = document.getElementById('obs').value.trim();

      if (!prog || !ini || !venc) {
        alert('Preencha programa, início e vencimento.');
        return;
      }

      const hoje = localISO();
      const status = (venc >= hoje) ? 'Ativo' : 'Vencido';

      const novo = {
        id: randId(),
        programa: prog,
        inicio: ini,
        vencimento: venc,
        status,
        obs
      };

      if (!Array.isArray(c.treinos)) c.treinos = [];
      c.treinos.push(novo);
      Store.upsert(c);

      location.hash = `#/cliente/${c.id}`;
    });
  }
};

// ---- helpers locais ----
function randId(){ return Math.random().toString(36).slice(2,10); }
function localISO(d = new Date()){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function addDaysISO(iso, n){
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate()+n);
  return localISO(d);
}
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}