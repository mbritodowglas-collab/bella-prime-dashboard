// ================================
// VIEW: Relatório da Cliente (A4/print)
// ================================
import { Store } from '../app.js';

// Fallbacks de branding (caso app.js não exporte constantes)
// Você pode definir window.BP_BRAND_NAME e window.BP_BRAND_LOGO_PNG se preferir.
const BRAND_NAME_FALLBACK = (typeof window !== 'undefined' && window.BP_BRAND_NAME) || 'Bella Prime';
const LOGO_PNG_FALLBACK   = (typeof window !== 'undefined' && window.BP_BRAND_LOGO_PNG) || './assets/img/logo-mdpersonal.png';

export const RelatorioView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<section class="card"><h2>Cliente não encontrada</h2></section>`;

    // pega última avaliação
    const ultimaAval = (c.avaliacoes||[])
      .slice()
      .sort((a,b)=>(a.data||'').localeCompare(b.data||''))
      .pop() || {};

    // normaliza treinos p/ as 2 nomenclaturas e ordena
    const treinos = (c.treinos||[])
      .slice()
      .map(t => ({
        id: t.id,
        programa: t.programa || '-',
        data_inicio: t.data_inicio || t.inicio || '',
        data_venc:   t.data_venc   || t.vencimento || '',
        observacao:  t.observacao  || t.obs || '',
        plano_texto: t.plano_texto || t.plano || '',
        intensidades: Array.isArray(t.intensidades) ? t.intensidades
                      : (t.intensidade ? [t.intensidade] : [])
      }))
      .sort((a,b)=>(b.data_inicio||'').localeCompare(a.data_inicio||''));

    const planoMaisRecente = treinos.length ? (treinos[0].plano_texto || '') : '';
    const hoje = new Date();
    const ts   = `${hoje.toLocaleDateString('pt-BR')} ${hoje.toLocaleTimeString('pt-BR')}`;

    // tenta puxar branding do app.js (se existir) sem quebrar
    let BRAND_NAME = BRAND_NAME_FALLBACK;
    let RELATORIO_LOGO_PNG = LOGO_PNG_FALLBACK;
    try {
      // import dinâmica opcional – se app.js exporta, ótimo; se não, ignora
      const mod = await import('../app.js');
      BRAND_NAME = mod.BRAND_NAME || BRAND_NAME;
      RELATORIO_LOGO_PNG = mod.RELATORIO_LOGO_PNG || RELATORIO_LOGO_PNG;
    } catch (_) { /* segue com fallbacks */ }

    return `
      <style>
        .r-wrap{max-width:900px;margin:0 auto;padding:18px}
        .r-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px}
        .r-btn{padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:#111;color:#eee;text-decoration:none;cursor:pointer}
        .r-btn.primary{background:#c62828;border-color:#c62828;color:#fff}
        .r-header{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px}
        .r-header img{height:44px}
        .brand-text{display:none;font-weight:700}
        .r-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media (max-width:760px){ .r-grid{grid-template-columns:1fr} }
        .r-card{border:1px solid var(--border);border-radius:12px;padding:12px;background:rgba(255,255,255,.02)}
        .mono{white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; line-height:1.4}
        .muted{opacity:.75}
        .table th, .table td{padding:8px 10px}
        .avoid-break{page-break-inside:avoid}
        @media print{
          .r-actions{display:none !important}
          body{background:#fff}
          .r-wrap{padding:0}
          .r-card{background:#fff}
        }
      </style>

      <div class="r-wrap">
        <div class="r-actions">
          <a href="#/cliente/${c.id}" class="r-btn">← Voltar</a>
          <button class="r-btn primary" id="btnPrint">🧾 Imprimir / PDF</button>
          <button class="r-btn" id="btnShare">🔗 Copiar link do relatório</button>
        </div>

        <div class="r-header">
          <img id="brandLogo" src="${RELATORIO_LOGO_PNG}" alt="Logo"
               onerror="this.style.display='none';document.getElementById('brandText').style.display='block';" />
          <div>
            <div id="brandText" class="brand-text">${escapeHTML(BRAND_NAME||'')}</div>
            <h2 style="margin:2px 0 0">Relatório de Avaliação — ${escapeHTML(c.nome||'')}</h2>
            <div class="muted">Gerado em ${ts}</div>
          </div>
        </div>

        <div class="r-grid">
          <div class="r-card avoid-break">
            <h3 style="margin-top:0">Dados da cliente</h3>
            <p><b>Nível atual:</b> ${c.nivel||'-'}</p>
            <p><b>Prontidão:</b> ${c.readiness||'-'} ${c.prontaConsecutivas?`<span class="muted">(consecutivas: ${c.prontaConsecutivas})</span>`:''}</p>
            <p><b>Sugerido (última avaliação):</b> ${c.sugestaoNivel || '-'}</p>
            ${c.email  ?`<p><b>E-mail:</b> ${escapeHTML(c.email)}</p>`:''}
            ${c.contato?`<p><b>WhatsApp:</b> ${escapeHTML(c.contato)}</p>`:''}
            ${c.cidade ?`<p><b>Cidade/Estado:</b> ${escapeHTML(c.cidade)}</p>`:''}
          </div>

          <div class="r-card avoid-break">
            <h3 style="margin-top:0">Métricas recentes</h3>
            <p><b>Data:</b> ${ultimaAval.data || '-'}</p>
            <p><b>Peso:</b> ${num(ultimaAval.peso) ?? '-'} kg</p>
            <p><b>Cintura:</b> ${num(ultimaAval.cintura) ?? '-'} cm</p>
            <p><b>Quadril:</b> ${num(ultimaAval.quadril) ?? '-'} cm</p>
            <p><b>RCQ:</b> ${num(ultimaAval.rcq,3) ?? '-'} &nbsp;|&nbsp; <b>WHtR:</b> ${num(ultimaAval.whtr,3) ?? '-'}</p>
          </div>
        </div>

        <div class="r-card avoid-break" style="margin-top:14px">
          <h3 style="margin-top:0">Treinos (últimos)</h3>
          ${treinos.length===0?'<div class="muted">Nenhum treino registrado.</div>':`
            <table class="table" style="width:100%">
              <thead><tr><th>Programa</th><th>Período</th><th>Intensidades</th><th>Obs.</th></tr></thead>
              <tbody>
                ${treinos.map(t=>`
                  <tr>
                    <td>${escapeHTML(t.programa||'-')}</td>
                    <td>${t.data_inicio||'-'} → ${t.data_venc||'-'}</td>
                    <td>${t.intensidades && t.intensidades.length ? escapeHTML(t.intensidades.join(' → ')) : '-'}</td>
                    <td>${escapeHTML(t.observacao||'')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div class="r-card avoid-break" style="margin-top:14px">
          <h3 style="margin-top:0">Plano de treino mais recente (texto)</h3>
          ${planoMaisRecente ? `<div class="mono">${escapeHTML(planoMaisRecente)}</div>` : '<div class="muted">— sem plano anexado no último lançamento —</div>'}
        </div>

        <div class="muted" style="margin-top:16px">© ${escapeHTML(BRAND_NAME)} • Documento gerado automaticamente</div>
      </div>
    `;
  },

  async init(id){
    const btnPrint = document.getElementById('btnPrint');
    btnPrint?.addEventListener('click', ()=> window.print());

    const btnShare = document.getElementById('btnShare');
    btnShare?.addEventListener('click', async ()=>{
      const url = `${location.origin}${location.pathname}#/relatorio/${encodeURIComponent(id)}`;
      try{
        await navigator.clipboard.writeText(url);
        btnShare.textContent = '✅ Link copiado';
        setTimeout(()=> btnShare.textContent = '🔗 Copiar link do relatório', 1200);
      }catch{
        prompt('Copie o link do relatório:', url);
      }
    });
  }
};

function num(v, d=2){ const n = Number(v); return Number.isFinite(n)? n.toFixed(d): undefined; }
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}