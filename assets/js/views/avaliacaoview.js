import { Store } from '../app.js';
import { pontuar, classificar } from './avaliacao.js';

export const AvaliacaoView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    const formURL = prefillFormURL(c); // opcional

    return `
      <section class="card">
        <a href="#/" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>Nova Avaliação — ${escapeHTML(c.nome || '')}</h2>
        <p style="margin:8px 0 16px">
          Registre abaixo para atualizar o painel.<br>
          <small>Para enviar também à planilha oficial, use <b>“Abrir Reavaliação (Google)”</b>.</small>
        </p>

        <div class="grid-2">
          <label class="field"><span>Está treinando?</span>
            <select id="estaTreinando" class="input">
              <option value="true">Sim</option><option value="false">Não</option>
            </select>
          </label>

          <label class="field"><span>Frequência semanal</span>
            <input id="frequenciaSemanal" class="input" type="number" min="0" max="14" placeholder="ex.: 3" />
          </label>

          <label class="field"><span>Qualidade do sono (1–5)</span>
            <input id="sono" class="input" type="number" min="1" max="5" placeholder="3" />
          </label>

          <label class="field"><span>Dor/lesão (0=sem / 1=com)</span>
            <input id="dorLesao" class="input" type="number" min="0" max="3" placeholder="0" />
          </label>

          <label class="field"><span>Estresse (1–5)</span>
            <input id="estresse" class="input" type="number" min="1" max="5" placeholder="3" />
          </label>

          <label class="field"><span>Comprometimento (1–10)</span>
            <input id="comprometimento" class="input" type="number" min="1" max="10" placeholder="7" />
          </label>

          <label class="field"><span>Segue plano alimentar?</span>
            <select id="planoAlimentar" class="input">
              <option value="nao">Não</option><option value="parcial">Parcial</option><option value="sim">Sim</option>
            </select>
          </label>

          <label class="field"><span>Acompanhamento profissional?</span>
            <select id="acompanhamentoProfissional" class="input">
              <option value="false">Não</option><option value="true">Sim</option>
            </select>
          </label>
        </div>

        <div class="row" style="gap:10px;margin-top:14px;">
          <button class="btn btn-outline" id="calc">Calcular nível</button>
          <button class="btn btn-primary" id="save" disabled>Salvar avaliação (Painel)</button>
          ${formURL ? `<a class="btn" href="${formURL}" target="_blank" rel="noopener">Abrir Reavaliação (Google)</a>` : ''}
        </div>

        <div id="resultado" class="card" style="margin-top:14px; display:none;"></div>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    const $ = s => document.querySelector(s);
    const $res  = $('#resultado');
    const $save = $('#save');

    const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v||0)));

    const readForm = () => ({
      estaTreinando: $('#estaTreinando').value === 'true',
      frequenciaSemanal: clamp($('#frequenciaSemanal').value, 0, 14),
      sono: clamp($('#sono').value, 1, 5),
      dorLesao: clamp($('#dorLesao').value, 0, 3),
      estresse: clamp($('#estresse').value, 1, 5),
      comprometimento: clamp($('#comprometimento').value, 1, 10),
      planoAlimentar: $('#planoAlimentar').value,
      acompanhamentoProfissional: $('#acompanhamentoProfissional').value === 'true',
    });

    $('#calc').addEventListener('click', () => {
      const r = readForm();
      const p = pontuar(r);
      const n = classificar(p, c.avaliacoes || []);

      $res.style.display = 'block';
      $res.innerHTML = `
        <h3>Resultado</h3>
        <p><b>Pontuação:</b> ${p}</p>
        <p><b>Nível:</b> ${n}</p>
        <small>Obs.: este registro salva no <b>painel</b>. Para lançar na planilha, use o botão do Google.</small>
      `;
      $save.disabled = false;
      $save.dataset.p = String(p);
      $save.dataset.n = n;
    });

    $save.addEventListener('click', () => {
      const p = Number($save.dataset.p || 0);
      const n = $save.dataset.n || c.nivel;
      const hoje = todayISO();

      const novo = { data: hoje, pontuacao: p, nivel: n };
      const avs = [...(c.avaliacoes || []), novo].sort((a,b)=> a.data.localeCompare(b.data));

      const updated = { ...c, avaliacoes: avs, pontuacao: p, nivel: n, ultimoTreino: hoje };
      Store.upsert(updated);

      alert('Avaliação salva no painel.');
      location.hash = `#/cliente/${c.id}`;
    });
  }
};

function todayISO(){
  const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function escapeHTML(s){
  return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function prefillFormURL(c){
  // Exemplo se quiser preencher o WhatsApp/email:
  // return `https://docs.google.com/forms/d/e/FORM_ID/viewform?entry.123456=${encodeURIComponent(c.contato||c.email||'')}`;
  return '';
}