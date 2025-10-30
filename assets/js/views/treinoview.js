import { Store, programsByLevel, intensitiesByLevel } from '../app.js';

export const TreinoView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<div class="card"><h2>Cliente não encontrada</h2></div>`;

    const permitidos = programsByLevel(c.nivel || 'Fundação');
    const intensidades = intensitiesByLevel(c.nivel || 'Fundação') || [];
    const hoje = localISO();
    const daqui30 = addDaysISO(hoje, 30);

    return `
      <section class="card">
        <a href="#/cliente/${c.id}" class="btn btn-outline" style="margin-bottom:10px;">← Voltar</a>
        <h2>Lançar novo treino — ${escapeHTML(c.nome)}</h2>
        <p style="opacity:.8;margin-top:6px">Nível atual: <b>${c.nivel || '-'}</b></p>
      </section>

      <section class="card">
        <div class="row" style="gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div style="min-width:180px">
            <label class="label">Programa</label>
            <select id="prog" class="input">
              ${permitidos.map(p=>`<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>

          ${
            intensidades.length
            ? `<div style="min-width:220px">
                 <label class="label">Intensidade (Domínio/OverPrime)</label>
                 <select id="intens" class="input">
                   ${intensidades.map(t=>`<option value="${escapeAttr(t)}">${escapeHTML(t)}</option>`).join('')}
                 </select>
               </div>`
            : ''
          }

          <div>
            <label class="label">Início</label>
            <input id="inicio" type="date" class="input" value="${hoje}">
          </div>

          <div>
            <label class="label">Vencimento</label>
            <input id="venc" type="date" class="input" value="${daqui30}">
          </div>

          <div style="flex:1;min-width:220px">
            <label class="label">Observação (opcional)</label>
            <input id="obs" class="input" placeholder="Anotações rápidas...">
          </div>

          <div class="row" style="gap:8px">
            <button id="saveTreino" class="btn btn-primary">Salvar</button>
            <button id="genPrompt" class="btn btn-danger">⚙️ Gerar Prompt</button>
          </div>
        </div>
      </section>

      <section id="promptCard" class="card" style="display:none">
        <h3>Prompt de prescrição (copiar e colar no chat de prescrição)</h3>
        <div class="row" style="gap:8px;margin:6px 0 10px">
          <button id="copyPrompt" class="btn btn-outline">Copiar</button>
          <small style="opacity:.8">Inclui nível, divisão, intensidade (se aplicável) e restrições clínicas.</small>
        </div>
        <textarea id="promptText" class="input" style="min-height:260px;font-family:ui-monospace,Consolas,monospace"></textarea>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if (!c) return;

    // Salvar registro
    on('#saveTreino','click', () => {
      const prog  = val('#prog');
      const intens = q('#intens') ? val('#intens') : null;
      const ini   = val('#inicio');
      const venc  = val('#venc');
      const obs   = val('#obs').trim();

      if (!prog || !ini || !venc) {
        alert('Preencha programa, início e vencimento.');
        return;
      }

      const hoje = localISO();
      const status = (venc >= hoje) ? 'Ativo' : 'Vencido';

      const novo = {
        id: randId(),
        programa: prog,
        intensidade: intens || undefined,
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

    // Gerar prompt
    on('#genPrompt','click', () => {
      const prog   = val('#prog');
      const intens = q('#intens') ? val('#intens') : null;
      const ini    = val('#inicio');
      const venc   = val('#venc');

      const prompt = buildPrescriptionPrompt(c, prog, ini, venc, intens);
      showPrompt(prompt);
    });

    // Copiar
    on('#copyPrompt','click', () => {
      const ta = q('#promptText');
      ta.select();
      document.execCommand('copy');
    });
  }
};

/* =========================
   Prompt builder
   ========================= */
function buildPrescriptionPrompt(c, programa, inicioISO, vencISO, intensidadeOpt){
  const nivel = (c.nivel || 'Fundação').trim();

  // Dados recentes
  const last = (c.avaliacoes||[]).slice().reverse().find(a => a) || {};
  const peso   = isNum(last.peso) ? `${last.peso} kg` : '—';
  const altura = guessHeight(c); // busca em _answers
  const rcq    = isNum(last.rcq) ? last.rcq.toFixed(3) : '—';
  const whtr   = isNum(last.whtr) ? last.whtr.toFixed(3) : '—';

  // Restrições clínicas/físicas
  const restricoes = extractRestrictions(c._answers || {});

  const periodo = `${formatISO(inicioISO)} a ${formatISO(vencISO)}`;

  const sistema =
`Bella Prime · Evo360 Bodybuilding (v2025.03)
FCR (Karvonen): FCR = (FCmax − FCrep) × %intensidade + FCrep`;

  const diretrizNivel = levelRules(nivel, programa, intensidadeOpt);

  const perfil =
`Cliente: ${c.nome || '—'}
Nível atual: ${nivel}
Programa: ${programa}${intensidadeOpt ? ` · Intensidade: ${intensidadeOpt}` : ''}
Período: ${perfeito(periodo)}
Dados recentes — Peso: ${peso} · RCQ: ${rcq} · WHtR: ${whtr} · Altura: ${altura || '—'}
Cidade/Estado: ${c.cidade || '—'}
Contato: ${c.contato || c.email || '—'}`;

  const blocoRestr =
    restricoes.length
      ? `\nRestrição clínica/física declarada:\n- ${restricoes.join('\n- ')}`
      : '';

  const pedido =
`TAREFA — prescrever o plano do período acima, seguindo "Diretrizes do nível".
Formato:
1) Resumo em 1 frase;
2) Divisão semanal (A/B/… com objetivo de cada sessão);
3) Para cada sessão: exercício, séries, reps, %1RM ou RIR, descanso, cadência, método (se aplicável), observações;
4) Cardio por FCR (tipo, minutos, %FCR, instrução prática);
5) Progressão semanal (3–4 linhas);
6) Observações finais (segurança/técnica).`;

  return [
    '=== SISTEMA ===', sistema,
    '\n=== PERFIL ===', perfil,
    blocoRestr,
    '\n=== DIRETRIZES DO NÍVEL ===', diretrizNivel,
    '\n=== ENTREGÁVEL ===', pedido
  ].filter(Boolean).join('\n');
}

/* Regras por nível/divisão/intensidade (resumo do teu JSON) */
function levelRules(nivel, programa, intensidadeOpt){
  const BASE_FUND =
`Fundação — Base técnica, coordenação e hábito (sem periodização formal)
Parâmetros: 3 séries · 12–15 reps · 45–75s descanso · 50–65% 1RM · cadência 2:1–2:2
Métodos permitidos: pirâmide truncada (±5%), circuito leve, isometria leve (2s)
Estrutura: 1 multiarticular principal → 2 multiarticular secundário → 3 acessório composto → 4 isolador primário → 5 isolador secundário → 6 método → 7 core (opcional)
Cardio (final): LISS 25min a 60–65% FCR (opcional MISS 15min a 65–70%)`;

  const DIVS = {
    'ABC':  `Divisão ABC (3x/semana): A - Inferior (quad/glúteos) · B - Superior (peito/ombro/tríceps) · C - Inferior (post/glúteos + core)`,
    'ABCD': `Divisão ABCD (4x/semana): A - Inferior quad · B - Superior peito/ombro/tríceps · C - Inferior posteriores/glúteos · D - Superior costas/bíceps + core`,
    'ABCDE': `Divisão ABCDE (5x/semana) — distribuir grupos respeitando parâmetros do nível e manejo de fadiga`,
    'ABCDEF': `Divisão ABCDEF (6x/semana) — uso avançado com controle de volume/densidade`,
  };

  // Fundação/Ascensão: segue base + divisão
  if (nivel.startsWith('Fund') || nivel.startsWith('Asc')) {
    const divTxt = DIVS[programa] || DIVS['ABC'];
    return `${BASE_FUND}\n${divTxt}`;
  }

  // Domínio / OverPrime: mesma base, mas com seletor de intensidade
  const intensTxt = intensidadeOpt ? `\nIntensidade-alvo: ${intensidadeOpt}` : '';
  const divTxt = DIVS[programa] || DIVS['ABC'];
  return `${BASE_FUND}${intensTxt}\n${divTxt}`;
}

/* ============ helpers de UI ============ */
function q(sel){ return document.querySelector(sel); }
function on(sel,ev,fn){ const el=q(sel); if (el) el.addEventListener(ev,fn); }
function val(sel){ return q(sel).value; }
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
function isNum(v){ return typeof v === 'number' && !isNaN(v); }
function formatISO(iso){ return iso ? iso.split('-').reverse().join('/') : '—'; }
function perfeito(s){ return s || '—'; }
function escapeHTML(s){
  return String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapeAttr(s){ return String(s || '').replace(/"/g,'&quot;'); }

/* tenta achar altura em _answers; aceita "1,65 m", "165 cm", "1.65" etc. */
function guessHeight(c){
  const A = c._answers || {};
  const key = Object.keys(A).find(k => /altura|estatura/i.test(k));
  if (!key) return undefined;
  const val = String(A[key]).replace(',', '.').trim().toLowerCase();
  const mMatch = val.match(/^(\d+(?:\.\d+)?)\s*m/);
  if (mMatch) return `${mMatch[1]} m`;
  const cmMatch = val.match(/^(\d+(?:\.\d+)?)\s*cm/);
  if (cmMatch) return `${cmMatch[1]} cm`;
  const n = parseFloat(val);
  if (!isNaN(n)) return (n <= 3) ? `${n} m` : `${n} cm`;
  return undefined;
}

/* Varre _answers por restrições/lesões/patologias com resposta afirmativa */
function extractRestrictions(answers){
  const out = [];
  const NEG = /(sem|nao|não)\b/i;
  const KEYS = /(restri|patolog|les[aã]o|dores?|dor|cirurgia|problema|condi[cç][aã]o|contraindica)/i;
  for (const [k,vRaw] of Object.entries(answers || {})){
    if (!KEYS.test(k)) continue;
    const v = String(vRaw || '').trim();
    if (!v) continue;
    if (NEG.test(v) && v.length <= 12) continue; // "não", "sem", "não tenho", etc.
    out.push(`${k}: ${v}`);
  }
  return out;
}

function showPrompt(text){
  const card = q('#promptCard');
  const ta   = q('#promptText');
  ta.value = text;
  card.style.display = 'block';
  setTimeout(() => card.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
}