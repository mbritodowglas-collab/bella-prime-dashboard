// ================================
// VIEW: Templates (mensagens prontas IG/WhatsApp)
// ================================
export const TemplatesView = {
  async template(){
    const ts = new Date().toLocaleString('pt-BR');

    return `
      <style>
        .tpl-wrap{max-width:980px;margin:0 auto;padding:18px}
        .tpl-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .tpl-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media (max-width:860px){ .tpl-grid{grid-template-columns:1fr} }
        .tpl-card{border:1px solid var(--border, #2a2a2a);border-radius:14px;background:rgba(255,255,255,.02);padding:14px}
        .tpl-title{margin:0 0 6px;font-weight:700}
        .tpl-meta{opacity:.7;font-size:.9rem;margin-bottom:10px}
        .tpl-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
        .btn{padding:8px 12px;border:1px solid var(--border,#2a2a2a);border-radius:10px;background:#111;color:#eee;text-decoration:none;cursor:pointer}
        .btn.primary{background:#c62828;border-color:#c62828;color:#fff}
        .tpl-text{white-space:pre-wrap;line-height:1.5;font-size:0.98rem}
        .tip{font-size:.85rem;opacity:.8;margin-top:6px}
        .search{display:flex;gap:8px;margin:8px 0 16px}
        .search input{flex:1;padding:10px;border-radius:10px;border:1px solid var(--border,#2a2a2a);background:#0f0f0f;color:#eee}
        .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#222;border:1px solid var(--border,#2a2a2a);font-size:.8rem;margin-right:6px}
      </style>

      <div class="tpl-wrap">
        <div class="tpl-head">
          <h2 style="margin:0">Mensagens Prontas</h2>
          <div class="tpl-meta">Atualizado em ${ts}</div>
        </div>

        <div class="search">
          <input id="tplSearch" type="search" placeholder="Buscar por 'instagram', 'whatsapp', 'fotos', 'primeiro contato'...">
          <button class="btn" id="btnLimpar">Limpar</button>
        </div>

        <div style="margin-bottom:8px">
          <span class="badge">Placeholders: {NOME}, {MEU_NOME}, {LINK_AVALIACAO}, {MEU_WHATS}</span>
        </div>

        <div id="tplGrid" class="tpl-grid"></div>
      </div>
    `;
  },

  async init(){
    // Base de templates
    const templates = [
      {
        id:'ig_boasvindas_novo_seguidor',
        canal:'instagram',
        titulo:'Instagram · Boas-vindas a novo seguidor (DM)',
        texto:
`Oi, {NOME}! Que bom te ver por aqui 👋
Eu sou o {MEU_NOME}. No meu perfil eu ajudo mulheres a treinarem com estratégia pra ter resultado de verdade – sem loucuras.

Se quiser, posso te mandar uma avaliação gratuita pra entender teu momento e te dar um norte claro (sem compromisso).
É rapidinha e já vem com orientações de treino/alimentação baseadas no teu caso.

Link: {LINK_AVALIACAO}

Qualquer dúvida me chama!`,
      },
      {
        id:'wpp_resposta_cliente_chamou',
        canal:'whatsapp',
        titulo:'WhatsApp · Quando a cliente chamou primeiro',
        texto:
`Oi, {NOME}! Tudo bem? Fico feliz com teu contato 😊
Pra eu te orientar com precisão, te envio uma avaliação gratuita agora. Com ela eu entendo tua rotina, histórico e objetivo, e já te passo um mini-plano inicial.

Pode preencher aqui: {LINK_AVALIACAO}

Depois me avisa que eu já analiso e te dou as primeiras diretrizes (treino + ajustes de alimentação).`,
      },
      {
        id:'wpp_primeiro_contato_proativo',
        canal:'whatsapp',
        titulo:'WhatsApp · Primeiro contato (proativo, educado e humano)',
        texto:
`Oi, {NOME}! Aqui é o {MEU_NOME}. Vi teu perfil e achei legal te enviar uma mensagem rápida.

Trabalho com treino guiado para mulheres e foco em resultado com rotina real. Se fizer sentido pra ti, posso te oferecer uma avaliação gratuita pra entender teu momento e te passar orientações iniciais sem custo.

Posso te enviar o link? Fica à vontade pra me dizer “sim” ou “prefiro não”. Sem pressão, tá?`,
      },
      {
        id:'wpp_pedido_fotos_educado',
        canal:'whatsapp',
        titulo:'WhatsApp · Pedir fotos (educado, humano e seguro)',
        texto:
`{NOME}, pra eu ajustar melhor tuas medidas e montar a estratégia, te peço 3 fotos simples: frente, lado e costas.

• Roupa: short/leg e top/camiseta (o que for confortável).
• Ambiente: luz natural se possível, fundo neutro.
• Postura: relaxada, pés paralelos, braços soltos.
• Privacidade: essas imagens ficam só comigo e são usadas apenas para avaliação de evolução (sem postagem/compartilhamento).

Se não te sentires à vontade com fotos, me avisa – consigo alternativas (medidas + questionário). Tudo bem?`,
      },
      {
        id:'ig_followup_dm',
        canal:'instagram',
        titulo:'Instagram · Follow-up depois de 24–48h',
        texto:
`Oi, {NOME}! Passando pra ver se o link da avaliação chegou certinho. 
Quando preencher, me avisa que eu analiso no mesmo dia e já te mando um direcionamento prático pra começar.

Se preferir conversar por WhatsApp, esse é o meu número: {MEU_WHATS}`,
      }
    ];

    // Render
    const grid = document.getElementById('tplGrid');
    const search = document.getElementById('tplSearch');
    const btnLimpar = document.getElementById('btnLimpar');

    const renderList = (query='')=>{
      const q = (query||'').toLowerCase().trim();
      const list = !q ? templates :
        templates.filter(t =>
          t.titulo.toLowerCase().includes(q) ||
          t.canal.toLowerCase().includes(q) ||
          t.texto.toLowerCase().includes(q)
        );

      grid.innerHTML = list.map(t => card(t)).join('');
      // bind copia
      list.forEach(t => {
        const btn = document.getElementById('copy_'+t.id);
        if (btn) btn.addEventListener('click', () => copyTemplate(t.id));
      });
    };

    const card = (t) => `
      <div class="tpl-card" data-id="${t.id}">
        <h3 class="tpl-title">${escapeHTML(t.titulo)}</h3>
        <div class="tpl-meta">Canal: <b>${t.canal}</b></div>
        <div class="tpl-text" id="text_${t.id}">${escapeHTML(t.texto)}</div>
        <div class="tip">Dica: edite os placeholders antes de copiar (&nbsp;{NOME}, {MEU_NOME}, {LINK_AVALIACAO}, {MEU_WHATS}&nbsp;).</div>
        <div class="tpl-actions">
          <button class="btn primary" id="copy_${t.id}">Copiar mensagem</button>
        </div>
      </div>
    `;

    function copyTemplate(id){
      const el = document.getElementById('text_'+id);
      if (!el) return;
      const raw = unescapeHTML(el.innerHTML);
      navigator.clipboard.writeText(raw)
        .then(()=> toast('Mensagem copiada ✅'))
        .catch(()=> toast('Não foi possível copiar 😕'));
    }

    function toast(msg){
      const x = document.createElement('div');
      x.textContent = msg;
      Object.assign(x.style, {
        position:'fixed', left:'50%', bottom:'18px', transform:'translateX(-50%)',
        background:'#111', color:'#fff', padding:'10px 14px', borderRadius:'10px',
        border:'1px solid #333', boxShadow:'0 8px 24px rgba(0,0,0,.35)', zIndex:9999
      });
      document.body.appendChild(x);
      setTimeout(()=> x.remove(), 1800);
    }

    function escapeHTML(s){
      return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
    }
    function unescapeHTML(s){
      return String(s||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"');
    }

    // eventos
    renderList();
    search.addEventListener('input', e => renderList(e.target.value));
    btnLimpar.addEventListener('click', () => { search.value=''; renderList(''); });
  }
};
