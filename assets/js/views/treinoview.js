// ================================
// VIEW: Lançar novo treino
// ================================
import { Store, programsByLevel } from '../app.js';

// ---------- Datas ----------
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

// ---------- Parâmetros por nível (com cardio) ----------
const PARAMS = {
  'Fundação': {
    series: '3',
    reps: '12–15',
    descanso: '45–75s',
    intensidade1RM: '50–65%',
    cadencia: '2:1–2:2',
    metodos: 'pirâmide truncada (±5%), circuito leve, isometria leve (2s)',
    cardio: [
      { tipo: 'LISS', duracao_min: 25, FCR: '60–65%', instrucao: 'Ritmo contínuo, conversa possível.' },
      { tipo: 'MISS (opcional)', duracao_min: 15, FCR: '65–70%', instrucao: 'Ritmo sustentado, fala entrecortada.' }
    ],
    intensidades: ['≈50–65% (nível de base)']
  },
  'Ascensão': {
    series: '3',
    reps: '10–14 (ajuste progressivo)',
    descanso: '60–90s',
    intensidade1RM: '65–75% (conforme mesociclo)',
    cadencia: '2:1–2:2',
    metodos: 'pirâmide, bi-set leve, drop simples, isometria (conforme meso)',
    cardio: [
      { tipo: 'LISS', duracao_min: 30, FCR: '60–65%', instrucao: 'Ritmo contínuo.' },
      { tipo: 'MISS', duracao_min: 20, FCR: '65–75%', instrucao: 'Ritmo sustentado.' }
    ],
    intensidades: [
      'Base Intermediária (≈65%)',
      'Densidade e Força Relativa (≈70%)',
      'Lapidação Intermediária (≈75%)'
    ]
  },
  'Domínio': {
    series: '4–5',
    reps: '8–12 (conforme foco)',
    descanso: '60–120s',
    intensidade1RM: '70–85% (por mesociclo)',
    cadencia: '2:1–2:2 / 3:1 em tensional',
    metodos: 'pirâmide crescente, bi-set/supersérie, drop, rest-pause, isometria (conforme meso)',
    cardio: [
      { tipo: 'MISS', duracao_min: 20, FCR: '65–75%', instrucao: 'Ritmo sustentado.' }
    ],
    intensidades: [
      'M1 · Volume Técnico (≈70%)',
      'M2 · Densidade Tensional (≈75%)',
      'M3 · Potência Controlada (≈80–85%)',
      'M4 · Densidade Avançada (≈75%)',
      'M5 · Lapidação Estética (≈80%)',
      'M6 · Resistência sob Fadiga (≈80–85%)'
    ]
  },
  'OverPrime': {
    series: '4–6',
    reps: '6–12 (conforme foco)',
    descanso: '60–150s',
    intensidade1RM: '75–90% (por mesociclo)',
    cadencia: 'variável (inclui cluster/pausas)',
    metodos: 'pirâmide inversa, rest-pause duplo, cluster, tri/giant set, parciais (conforme meso)',
    cardio: [
      { tipo: 'MISS', duracao_min: 20, FCR: '70–80%', instrucao: 'Ritmo desafiador.' }
    ],
    intensidades: [
      'O1 · Força Base Avançada (≈80%)',
      'O2 · Densidade de Força (≈85%)',
      'O3 · Potência & Tensão (≈85–90%)',
      'O4 · Lapidação & Condicionamento (≈75–80%)',
      'O5 · Pico Estético/Força Relativa (≈80–85%)',
      'O6 · Densidade Final (≈80–90%)'
    ]
  }
};

// ---------- Intensidades (UI) ----------
function intensidadesParaNivel_UI(nivel) {
  const n = String(nivel||'').trim();
  const p = PARAMS[n];
  if (!p) return null;
  return p.intensidades || null;
}

function renderIntensidades(nivel){
  const lista = intensidadesParaNivel_UI(nivel) || [];
  if (nivel === 'Domínio' || nivel === 'OverPrime'){
    return `
      <div class="field" id="intWrap">
        <label>Intensidades (escolha a sequência)</label>
        <div id="intChecks" style="display:grid;gap:6px">
          ${lista.map((i,idx)=>`
            <label style="display:flex;gap:8px;align-items:center">
              <input type="checkbox" class="intItem" value="${escapeHTML(i)}" ${idx<3?'checked':''}/>
              <span>${escapeHTML(i)}</span>
            </label>`).join('')}
        </div>
        <small style="opacity:.75">A sequência marcada define a ordem dos focos ao longo do período.</small>
      </div>`;
  }
  return `
    <div class="field">
      <label>Intensidade</label>
      <select id="intSel" class="input">
        ${lista.map(i=>`<option value="${escapeHTML(i)}">${escapeHTML(i)}</option>`).join('')}
      </select>
    </div>`;
}

// ---------- Heurística de restrições a partir das respostas ----------
function extrairRestricoes(ans){
  const linhas = Object.entries(ans||{});
  const picks = [];

  // palavras-chave de locais/condições + mapeamento para frase amigável
  const KW = [
    'quadril','lombar','costas','coluna','joelho','ombro','cervical','tornozelo','cotovelo','punho',
    'tendinite','condromalácia','hernia','hérnia','asma','hipertensão','pressão alta','diabetes','gestação','gravidez','cardíaco','cardiaco','rigidez','dor'
  ];
  const LABEL = {
    quadril: 'dor no quadril',
    lombar: 'dor lombar',
    costas: 'dor nas costas',
    coluna: 'dor na coluna',
    joelho: 'dor no joelho',
    ombro: 'dor no ombro',
    cervical: 'dor cervical',
    tornozelo: 'dor no tornozelo',
    cotovelo: 'dor no cotovelo',
    punho: 'dor no punho',
    rigidez: 'rigidez articular'
  };

  for (const [k,vRaw] of linhas){
    const kL = String(k||'').toLowerCase();
    const v  = String(vRaw||'').toLowerCase();

    // perguntas do tipo "Qual lesão?/Onde dói?/Local da dor?"
    const qLocal = /qual les[aã]o|onde d[óo]i|local da dor|regi[aã]o/.test(kL);
    if (qLocal && v.trim()){
      const kw = KW.find(w => v.includes(w));
      picks.push(kw ? (LABEL[kw] || kw) : v.trim());
      continue;
    }

    const marcouSim  = /(^|\b)(sim|tenho|possuo|diagnosticada|asma)(\b|$)/.test(v);
    const matchKW    = KW.find(w => v.includes(w) || kL.includes(w));
    const exemploTxt = /(exemplo|ex:|ex\.|por exemplo)/.test(v);
    if ((marcouSim || matchKW) && !exemploTxt){
      if (matchKW) picks.push(LABEL[matchKW] || matchKW);
    }
  }

  const uniq = [...new Set(picks.map(s => s.replace(/\s+/g,' ').trim()))];
  return uniq.length ? `atenção a: ${uniq.join(', ')}` : '';
}

// ---------- View ----------
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
            <textarea id="planoTxt" class="tw-textarea" placeholder="Ex.:
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
    const iniInput  = document.getElementById('ini');
    const venInput  = document.getElementById('ven');
    const planoTxt  = document.getElementById('planoTxt');

    // auto-ajusta vencimento quando muda o início
    iniInput?.addEventListener('change', ()=>{
      venInput.value = addDays(iniInput.value || todayISO(), 28);
    });

    // auto-grow no textarea
    const autoGrow = el => { el.style.height='auto'; el.style.height=(el.scrollHeight+4)+'px'; };
    planoTxt?.addEventListener('input', ()=> autoGrow(planoTxt));

    salvarBtn?.addEventListener('click', () => {
      const rec = lerFormulario(c);
      if (!Array.isArray(c.treinos)) c.treinos = [];
      c.treinos.push(rec);
      // mantém status fresco no dashboard
      c.ultimoTreino = rec.inicio;
      Store.upsert(c);
      location.hash = `#/cliente/${c.id}`;
    });

    promptBtn?.addEventListener('click', async () => {
      const rec = lerFormulario(c);
      const texto = montarPrompt(c, rec);
      await copiar(texto);
      promptBtn.textContent = 'Prompt copiado!';
      setTimeout(()=> promptBtn.textContent = '⚙️ Gerar Prompt', 1200);
    });
  }
};

// ---------- Helpers de formulário / prompt / util ----------
function lerFormulario(c){
  const programa = document.getElementById('progSel')?.value || 'ABC';
  const inicio   = document.getElementById('ini')?.value || todayISO();
  const venc     = document.getElementById('ven')?.value || addDays(inicio, 28);
  const obs      = document.getElementById('obs')?.value || '';
  const plano    = document.getElementById('planoTxt')?.value?.trim() || '';

  let intensidadesArr = null;
  let intensidadeTxt  = '';

  if (c.nivel === 'Domínio' || c.nivel === 'OverPrime'){
    intensidadesArr = Array.from(document.querySelectorAll('.intItem'))
      .filter(ch => ch.checked)
      .map(ch => ch.value);
    intensidadeTxt = intensidadesArr.join(' → ');
  } else {
    const unica = document.getElementById('intSel')?.value;
    intensidadesArr = unica ? [unica] : [];
    intensidadeTxt = unica || '';
  }

  // chaves compatíveis com ClienteView
  return {
    id: `t_${Date.now()}`,
    programa,
    intensidade: intensidadeTxt,   // string (compat)
    intensidades: intensidadesArr, // array (quando houver)
    inicio,
    vencimento: venc,
    status: 'Ativo',
    obs,
    plano
  };
}

function montarPrompt(cliente, treino){
  const nivel = cliente.nivel || '-';
  const params = PARAMS[nivel] || PARAMS['Fundação'];
  const answers = cliente._answers || {};

  const restr = extrairRestricoes(answers);
  const cardioLines = (params.cardio||[]).map(c =>
    `• ${c.tipo} — ${c.duracao_min}min · ${c.FCR} · ${c.instrucao}`
  ).join('\n');

  let txtInt = '';
  if (treino.intensidades && treino.intensidades.length){
    if (nivel === 'Domínio' || nivel === 'OverPrime'){
      txtInt = `Intensidades por sequência: ${treino.intensidades.join(' → ')}`;
    } else {
      txtInt = `Intensidade alvo: ${treino.intensidades[0]}`;
    }
  }

  const linhas = [
    'Você é prescritor do sistema Bella Prime · Evo360.',
    'Gere um PROGRAMA DE TREINO estruturado seguindo as regras do nível.',
    '',
    `Cliente: ${cliente.nome} | Nível: ${nivel}`,
    `Programa: ${treino.programa}`,
    `Período: ${treino.inicio} → ${treino.vencimento}`,
    txtInt || null,
    cliente.objetivo ? `Objetivo declarado: ${cliente.objetivo}` : null,
    restr ? `Restrições/atenções: ${restr}` : null,
    treino.obs ? `Observações do coach: ${treino.obs}` : null,
    '',
    'Parâmetros do nível:',
    `- Séries: ${params.series}`,
    `- Repetições: ${params.reps}`,
    `- Descanso: ${params.descanso}`,
    `- %1RM: ${params.intensidade1RM}`,
    `- Cadência: ${params.cadencia}`,
    `- Métodos aplicáveis: ${params.metodos}`,
    '',
    'Estrutura obrigatória por sessão:',
    '- Mobilidade (3 itens do grupo do dia).',
    '- Principais (6–8 exercícios, ordem sugerida: 1 multiarticular principal, 2 secundário, 3 acessório composto, 4 isolador primário, 5 isolador secundário, 6 método aplicado, 7 core técnico opcional).',
    '',
    'Cardio (Karvonen — FCR = (FCmax − FCrep) × %intensidade + FCrep). Modelos:',
    cardioLines,
    '',
    'Formato de saída:',
    '- Sessões A, B, C... com listas de exercícios e parâmetros (séries, reps, descanso, cadência).',
    '- Cardio no final conforme FCR, indicando tipo, duração, %FCR e instrução prática.',
    '- Incluir observações do método quando aplicável (NUNCA explicar o gesto motor).'
  ];

  if (nivel === 'Domínio' || nivel === 'OverPrime'){
    linhas.push(
      '',
      'Distribuição temporal (respeite a sequência de intensidades selecionadas):',
      '- Quebre o período em blocos semanais coerentes (ex.: 4–5 semanas por foco).',
      '- Indique no topo de cada sessão a qual foco/mesociclo aquela semana pertence.'
    );
  }

  return linhas.filter(Boolean).join('\n');
}

async function copiar(texto) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(String(texto));
      return true;
    }
  } catch {}
  const ta = document.createElement('textarea');
  ta.value = String(texto);
  ta.setAttribute('readonly','');
  ta.style.position='fixed'; ta.style.left='-9999px';
  document.body.appendChild(ta);
  ta.select(); ta.setSelectionRange(0, ta.value.length);
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

function escapeHTML(s=''){
  return String(s).replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
}