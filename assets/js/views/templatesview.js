// ================================
// VIEW: Templates de Mensagens (Instagram / WhatsApp)
// ================================
export const TemplatesView = {
  async template(){
    return `
      <style>
        .tpl-wrap{max-width:900px;margin:0 auto;padding:18px}
        .tpl-head{display:flex;gap:10px;align-items:center;margin-bottom:12px}
        .tpl-head .btn{padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:#111;color:#eee;text-decoration:none}
        .tpl-grid{display:grid;grid-template-columns:1fr;gap:14px}
        .tpl-card{border:1px solid var(--border);border-radius:12px;padding:12px;background:rgba(255,255,255,.02)}
        .tpl-title{margin:0 0 6px}
        .tpl-text{white-space:pre-wrap;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;line-height:1.4}
        .tpl-ctrl{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
        .tpl-input{background:#0f1115;border:1px solid var(--border);border-radius:8px;color:#eee;padding:8px 10px}
        .tpl-btn{padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:#1a1d24;color:#eee;cursor:pointer}
        .tpl-btn.primary{background:#c62828;border-color:#c62828}
        .muted{opacity:.75}
        @media (min-width:860px){ .tpl-grid{grid-template-columns:1fr 1fr} }
      </style>

      <div class="tpl-wrap">
        <div class="tpl-head">
          <a class="btn" href="#/">← Voltar</a>
          <div class="muted">Mensagens prontas para Instagram e WhatsApp (copiar com 1 clique).</div>
        </div>

        <div class="tpl-card">
          <div class="tpl-ctrl">
            <label>Nome do(a) cliente:</label>
            <input id="tplNome" class="tpl-input" placeholder="Ex.: Patrícia" />
            <button id="tplApply" class="tpl-btn">Aplicar nome</button>
          </div>
          <div class="muted">Use {NOME} dentro dos textos para personalizar automaticamente.</div>
        </div>

        <div class="tpl-grid">
          ${cards().map(renderCard).join('')}
        </div>
      </div>
    `;
  },

  async init(){
    const nome = document.getElementById('tplNome');
    const apply = document.getElementById('tplApply');
    apply?.addEventListener('click', () => {
      document.querySelectorAll('[data-template]').forEach(el => {
        const base = el.getAttribute('data-template');
        el.textContent = fill(base, nome.value);
      });
    });

    // botões copiar
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-copy');
        const box = document.getElementById(id);
        if (!box) return;
        navigator.clipboard.writeText(box.textContent || '').then(()=>{
          btn.textContent = 'Copiado!';
          setTimeout(()=> btn.textContent = 'Copiar', 900);
        });
      });
    });

    // preencher com vazio (remove {NOME} pendente)
    apply?.click();
  }
};

// ---------------- helpers ----------------
function fill(text, nome){
  const n = (nome || '').trim();
  return text.replaceAll('{NOME}', n || 'você');
}

function renderCard(c){
  const id = `tpl_${c.key}`;
  return `
    <div class="tpl-card">
      <h3 class="tpl-title">${c.title}</h3>
      <div class="tpl-ctrl">
        <button class="tpl-btn primary" data-copy="${id}">Copiar</button>
      </div>
      <div id="${id}" class="tpl-text" data-template="${escapeHTML(c.text)}"></div>
      ${c.note ? `<div class="muted" style="margin-top:8px">${c.note}</div>` : ''}
    </div>
  `;
}

function cards(){
  return [
    {
      key:'ig_boas_vindas',
      title:'Instagram • Boas-vindas a seguidor(a) novo(a)',
      text:
`Oi {NOME}! Que bom te ver por aqui 👊
Eu sou o Márcio, personal trainer focado em saúde mental + treino inteligente.
Se precisar de orientação pra começar (ou recomeçar), me chama.
Tenho um checklist simples pra destravar o primeiro mês. Quer receber?`
    },
    {
      key:'zap_inbound',
      title:'WhatsApp • Cliente chamou primeiro (primeiro contato)',
      text:
`Oi {NOME}! Aqui é o Márcio, personal trainer 😊
Vi sua mensagem e quero te ajudar a organizar treino e rotina de um jeito real.
Pra te orientar certinho, posso te mandar uma avaliação rápida (gratuita) com 6 perguntas?
Com base nela, te digo por onde começar e como ajustar treino/ritmo. Pode ser?`
    },
    {
      key:'zap_outbound',
      title:'WhatsApp • Você iniciou o contato (abordagem humana)',
      text:
`Oi {NOME}, tudo bem? Aqui é o Márcio, personal trainer.
Vi que você curte conteúdos de treino e saúde — trabalho com um plano simples que integra treino + ajustes de rotina.
Se fizer sentido, posso te enviar uma avaliação rápida (gratuita) e um guia de primeiros passos. Te envio agora?`
    },
    {
      key:'zap_fotos',
      title:'WhatsApp • Pedido de fotos (educado e humano)',
      note:'Orientação: sempre reforce consentimento e explique a utilidade técnica.',
      text:
`{NOME}, pra eu montar as medidas-base do plano e acompanhar sua evolução com precisão, te peço 3 fotos opcionais (frente, lado e costas).
– Roupas: short/legging e top/camiseta ajustada
– Luz natural, sem filtros
– Distância: corpo inteiro
Importante: as fotos ficam privadas, usadas só pra análise de postura e medidas. Se não quiser, sem problema — a gente segue por medidas de fita e peso. Posso te mandar um exemplo de referência?`
    }
  ];
}

function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}