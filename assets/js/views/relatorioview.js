// ================================
// VIEW: Relatório da Cliente (A4/print)
// ================================
import { Store, BRAND_LOGO_PNG } from '../app.js';

export const RelatorioView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<section class="card"><h2>Cliente não encontrada</h2></section>`;

    const ultimaAval = (c.avaliacoes||[]).slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')).pop() || {};
    const treinos = (c.treinos||[]).slice().sort((a,b)=>(b.data_inicio||'').localeCompare(a.data_inicio||''));

    const planoMaisRecente = treinos.length ? (treinos[0].plano_texto || '') : '';
    const hoje = new Date(); const ts = `${hoje.toLocaleDateString()} ${hoje.toLocaleTimeString()}`;

    return `
      <style>
        .r-wrap{max-width:900px;margin:0 auto;padding:18px}
        .r-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px}
        .r-btn{padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:#111;color:#eee;text-decoration:none}
        .r-btn.primary{background:#c62828;border-color:#c62828;color:#fff}
        .r-header{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px}
        .r-header img{height:44px}
        .r-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media (max-width:760px){ .r-grid{grid-template-columns:1fr} }
        .r-card{border:1px solid var(--border);border-radius:12px;padding:12px;background:rgba(255,255,255,.02)}
        .mono{white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; line-height:1.4}
        .muted{opacity:.75}
        /* Print */
        @media print{
          .r-actions{display:none !important}
          body{background:white}
          .r-wrap{padding:0}
          .r-card{background:white}
        }
      </style>

      <div class="r-wrap">
        <div class="r-actions">
          <a href="#/cliente/${c.id}" class="r-btn">← Voltar</a>
          <button class="r-btn primary" id="btnPrint">🧾 Imprimir / PDF</button>
        </div>

        <div class="r-header">
          <img src="${BRAND_LOGO_PNG}" alt="Logo" />
          <div>
            <h2 style="margin:0">Relatório de Avaliação — ${escapeHTML(c.nome||'')}</h2>
            <div class="muted">Gerado em ${ts}</div>
          </div>
        </div>

        <div class="r-grid">
          <div class="r-card">
            <h3 style="margin-top:0">Dados da cliente</h3>
            <p><b>Nível atual:</b> ${c.nivel||'-'}</p>
            <p><b>Prontidão:</b> ${c.readiness||'-'} ${c.prontaConsecutivas?`<span class="muted">(consecutivas: ${c.prontaConsecutivas})</span>`:''}</p>
            <p><b>Sugerido (última avaliação):</b> ${c.sugestaoNivel || '-'}</p>
            ${c.email?`<p><b>E-mail:</b> ${escapeHTML(c.email)}</p>`:''}
            ${c.contato?`<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>`:''}
            ${c.cidade?`<p><b>Cidade/Estado:</b> ${escapeHTML(c.cidade)}</p>`:''}
          </div>

          <div class="r-card">
            <h3 style="margin-top:0">Métricas recentes</h3>
            <p><b>Data:</b> ${ultimaAval.data || '-'}</p>
            <p><b>Peso:</b> ${num(ultimaAval.peso) ?? '-'} kg</p>
            <p><b>Cintura:</b> ${num(ultimaAval.cintura) ?? '-'} cm</p>
            <p><b>Quadril:</b> ${num(ultimaAval.quadril) ?? '-'} cm</p>
            <p><b>RCQ:</b> ${num(ultimaAval.rcq,3) ?? '-'} | <b>WHtR:</b> ${num(ultimaAval.whtr,3) ?? '-'}</p>
          </div>
        </div>

        <div class="r-card" style="margin-top:14px">
          <h3 style="margin-top:0">Treinos (últimos)</h3>
          ${treinos.length===0?'<div class="muted">Nenhum treino registrado.</div>':`
            <table class="table" style="width:100%">
              <thead><tr><th>Programa</th><th>Período</th><th>Intensidades</th><th>Obs.</th></tr></thead>
              <tbody>
                ${treinos.map(t=>`
                  <tr>
                    <td>${escapeHTML(t.programa||'-')}</td>
                    <td>${t.data_inicio||'-'} → ${t.data_venc||'-'}</td>
                    <td>${Array.isArray(t.intensidades)? escapeHTML(t.intensidades.join(' → ')) : '-'}</td>
                    <td>${escapeHTML(t.observacao||'')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div class="r-card" style="margin-top:14px">
          <h3 style="margin-top:0">Plano de treino mais recente (texto)</h3>
          ${planoMaisRecente ? `<div class="mono">${escapeHTML(planoMaisRecente)}</div>` : '<div class="muted">— sem plano anexado no último lançamento —</div>'}
        </div>

        <div class="muted" style="margin-top:16px">© Bella Prime • Documento gerado automaticamente</div>
      </div>
    `;
  },

  async init(id){
    const btn = document.getElementById('btnPrint');
    btn?.addEventListener('click', ()=> window.print());
  }
};

function num(v, d=2){ const n = Number(v); return Number.isFinite(n)? n.toFixed(d): undefined; }
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}