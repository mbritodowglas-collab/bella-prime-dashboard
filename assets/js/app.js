// =====================================
// BELLA PRIME · APP PRINCIPAL (com respostas completas + métricas antropométricas)
// =====================================

import { DashboardView } from './views/dashboardview.js';
import { ClienteView }   from './views/clienteview.js';
import { AvaliacaoView } from './views/avaliacaoview.js';
import { TreinoView }    from './views/treinoview.js'; // <<< NOVO

const SHEETS_API = 'https://script.google.com/macros/s/AKfycbyAafbpJDWr4RF9hdTkzmnLLv1Ge258hk6jlnDo7ng2kk88GoWyJzp63rHZPMDJA-wy/exec';

// ---------- Datas ----------
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const parseISO = (s) => new Date(`${s}T12:00:00`);
const diffDays  = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));

// ---------- Utils ----------
function cryptoId(){
  try { return crypto.randomUUID(); }
  catch { return 'id_' + Math.random().toString(36).slice(2,9); }
}
const strip = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pick = (obj, keys) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== '') return obj[k];
  return undefined;
};
function normNivel(n){
  const s = strip(n||'');
  if (s.startsWith('fund')) return 'Fundação';
  if (s.startsWith('asc'))  return 'Ascensão';
  if (s.startsWith('dom'))  return 'Domínio';
  if (s.startsWith('over')) return 'OverPrime';
  return undefined;
}

// Coleta todas as respostas do Sheets (para consulta completa no perfil)
function collectAnswersFromRaw(raw){
  if (!raw) return {};
  const ignore = new Set([
    'id','identificador','uid','usuario',
    'nome','nome completo','seu nome','qual e o seu nome','qual seu nome','aluna','cliente','paciente',
    'contato','whatsapp','whats','telefone',
    'email','e-mail','mail',
    'cidade-estado','cidade - estado','cidade/estado','cidade_estado','cidade-uf','cidade uf','cidadeuf','cidade',
    'nivel','nível','nivelatual','fase','faixa',
    'pontuacao','pontuação','score','pontos','nota',
    'ultimotreino','ultimaavaliacao','dataavaliacao','data',
    'renovacaodias','renovacao','ciclodias',
    // métricas que já extraímos separadamente
    'peso','peso (kg)','peso kg',
    'cintura','cintura (cm)','cintura cm',
    'quadril','quadril (cm)','quadril cm',
    // campos de promoção
    'acao','ação','novo_nivel','novonivel','nivel_destino','nível_destino','professor','data_decisao','datadecisao'
  ]);
  const norm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const out = {};
  for (const [label, val] of Object.entries(raw)){
    if (val === null || val === undefined || String(val).trim()==='') continue;
    if (ignore.has(norm(label))) continue;
    out[label] = String(val);
  }
  return out;
}

// ---------- Dados (Sheets -> seed.json) ----------
async function loadSeed(){
  try{
    const r = await fetch(SHEETS_API, { cache:'no-store' });
    if(!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
    const data = await r.json();
    if(!Array.isArray(data)) throw new Error('Sheets retornou formato inválido');
    console.log('Sheets OK:', data.length);
    return data;
  }catch(e){
    console.warn('Sheets falhou, usando seed.json:', e);
    const r2 = await fetch('./assets/data/seed.json', { cache:'no-store' });
    const data = await r2.json();
    console.log('seed.json:', Array.isArray(data) ? data.length : 0);
    return data;
  }
}

// ---------- Store ----------
const KEY = 'bp_clientes_v1';

export const Store = {
  state: {
    clientes: [],
    filters: { q:'', nivel:'', status:'' },
    scroll: { '/': 0 }
  },

  async init(){
    try{
      const brutos = await loadSeed();

      // normaliza chaves (sem acentos)
      const normRow = (raw) => {
        const o = {};
        for (const [k, v] of Object.entries(raw || {})) o[strip(k)] = v;
        return o;
      };

      const registros = (brutos || []).map(raw => {
        const o = normRow(raw);

        // Identificação
        const nome = pick(o, ['nome','nome completo','seu nome','qual e o seu nome','qual seu nome','aluna','cliente']);
        const contato = pick(o, ['contato','whatsapp','telefone']);
        const email   = pick(o, ['email','e-mail','mail']);
        const id      = String(pick(o, ['id','uid','usuario']) || contato || email || cryptoId());

        // Cidade/Estado
        const cidade = pick(o, [
          'cidade-estado','cidade - estado','cidade/estado','cidade uf','cidadeuf','cidade'
        ]) || '';

        // Campos de ação (ex.: promoção pelo professor)
        const acaoRaw = pick(o, ['acao','ação','action']);
        const acao = strip(acaoRaw||''); // 'promover' quando for o caso
        const novoNivelRaw = pick(o, ['novo_nivel','novonivel','nivel_destino','nível_destino']);
        const novoNivel = normNivel(novoNivelRaw);
        const dataDecisao = pick(o, ['data_decisao','datadecisao','data']) || todayISO();
        const professor = pick(o, ['professor','coach','avaliador']);

        // Avaliação base (data/nivel/pontuacao)
        const dataAval = pick(o, ['data','dataavaliacao','ultimotreino']);
        const pontForm = Number(pick(o, ['pontuacao','pontuação','score','nota']) || 0);
        const nivelIn  = pick(o, ['nivel','nível','fase','faixa']);

        // ---- MÉTRICAS ANTROPOMÉTRICAS ----
        const pesoRaw    = pick(o, ['peso','peso (kg)','peso kg']);
        const cinturaRaw = pick(o, ['cintura','cintura (cm)','cintura cm']);
        const quadrilRaw = pick(o, ['quadril','quadril (cm)','quadril cm']);

        const peso    = (pesoRaw    !== undefined && pesoRaw !== '')    ? Number(String(pesoRaw).replace(',', '.'))    : undefined;
        const cintura = (cinturaRaw !== undefined && cinturaRaw !== '') ? Number(String(cinturaRaw).replace(',', '.')) : undefined;
        const quadril = (quadrilRaw !== undefined && quadrilRaw !== '') ? Number(String(quadrilRaw).replace(',', '.')) : undefined;
        const rcq = (cintura && quadril && quadril !== 0) ? (cintura / quadril) : undefined;

        // nível default (mantém tua lógica base) — NÃO sobrescrevemos por reavaliações
        const nivelDefault = (() => {
          const n = normNivel(nivelIn);
          if (n) return n;
          if (pontForm <= 2)  return 'Fundação';
          if (pontForm <= 6)  return 'Ascensão';
          return 'Domínio';
        })();

        // Registro base
        const base = {
          id,
          nome: nome || '(Sem nome)',
          contato: contato || '',
          email: email || '',
          cidade,
          nivel: nivelDefault,
          pontuacao: isNaN(pontForm) ? 0 : pontForm,
          ultimoTreino: dataAval || undefined,
          renovacaoDias: Number(pick(o,['renovacaodias','renovacao','ciclodias'])) || 30,
          avaliacoes: [],
          treinos: [],     // histórico de treinos lançados
          promocoes: [],   // histórico de promoções oficiais (professor)
          _answers: collectAnswersFromRaw(raw)
        };

        // --- Se for linha de PROMOÇÃO do professor, só registra a promoção ---
        if (acao === 'promover' && novoNivel) {
          base.promocoes.push({
            para: novoNivel,
            data: /^\d{4}-\d{2}-\d{2}$/.test(String(dataDecisao)) ? String(dataDecisao) : todayISO(),
            professor: professor || ''
          });
          // não criar avaliação a partir dessa linha
          return base;
        }

        // --- Pontuação automática por respostas (só se não houver nota explícita no form) ---
        if ((!pontForm || isNaN(pontForm)) && base._answers && Object.keys(base._answers).length){
          const auto = calcularPontuacao(base._answers);
          base.pontuacao = auto;
          // Importante: reavaliações NÃO mudam nível; este cálculo serve para sugestão
          // (nível real só muda por promoção do professor).
        }

        // adiciona avaliação com métricas, se houver algo
        if (dataAval || !isNaN(base.pontuacao) || peso !== undefined || cintura !== undefined || quadril !== undefined) {
          const dataISO = /^\d{4}-\d{2}-\d{2}$/.test(String(dataAval)) ? String(dataAval) : todayISO();
          base.avaliacoes.push({
            data: dataISO,
            pontuacao: isNaN(base.pontuacao) ? 0 : base.pontuacao,
            // NÃO fixar o nível aqui para não mexer no nível real do cliente
            peso: isNaN(peso) ? undefined : peso,
            cintura: isNaN(cintura) ? undefined : cintura,
            quadril: isNaN(quadril) ? undefined : quadril,
            rcq: (typeof rcq === 'number' && !isNaN(rcq)) ? rcq : undefined
          });
        }

        return base;
      });

      // colapsa por id (mantém histórico)
      const map = new Map();
      for (const r of registros) {
        if (!map.has(r.id)) { map.set(r.id, r); continue; }
        const dst = map.get(r.id);
        for (const f of ['nome','contato','email','cidade']) if (!dst[f] && r[f]) dst[f] = r[f];

        // histórico de avaliações
        dst.avaliacoes = [...(dst.avaliacoes||[]), ...(r.avaliacoes||[])];

        // histórico de promoções
        dst.promocoes  = [...(dst.promocoes || []), ...(r.promocoes || [])];

        if (!Array.isArray(dst.treinos)) dst.treinos = []; // garante array
        // não sobrescreve _answers; mantém o primeiro
      }

      // ordena histórico por data e aplica regras de status/promoção
      const list = [...map.values()];
      for (const c of list) {
        if (Array.isArray(c.avaliacoes)) {
          c.avaliacoes.sort((a,b)=> (a.data||'').localeCompare(b.data||''));
          const last = c.avaliacoes[c.avaliacoes.length-1];
          if (last) {
            // c.pontuacao sugere, mas não muda nível real
            c.pontuacao    = (typeof last.pontuacao === 'number') ? last.pontuacao : c.pontuacao;
            c.ultimoTreino = c.ultimoTreino || last.data;
          }
        }

        // Aplica promoções oficiais em ordem cronológica
        if (Array.isArray(c.promocoes) && c.promocoes.length) {
          c.promocoes.sort((a,b)=> (a.data||'').localeCompare(b.data||''));
          for (const p of c.promocoes) {
            const destino = normNivel(p.para) || p.para;
            if (destino) {
              c.nivel = destino;            // muda o nível REAL
              c.nivelMudadoEm = p.data;     // guarda a data da última mudança
            }
          }
        }
      }

      this.state.clientes = list;
      this.persist();
      console.log(`✅ Normalizado: ${this.state.clientes.length} clientes`);
    }catch(e){
      console.error('Falha init()', e);
      this.state.clientes = [];
    }
  },

  async reloadFromSheets(){ await this.init(); },

  persist(){ localStorage.setItem(KEY, JSON.stringify(this.state.clientes)); },

  list(){
    const { q='', nivel='', status='' } = this.state.filters || {};
    return [...this.state.clientes]
      .sort((a,b)=> (a.nome||'').localeCompare(b.nome||'','pt',{sensitivity:'base'}))
      .filter(c => !q     || (c.nome||'').toLowerCase().includes(q.toLowerCase()))
      .filter(c => !nivel || c.nivel === nivel)
      .filter(c => !status|| statusCalc(c).label === status);
  },

  byId(id){ return this.state.clientes.find(c => String(c.id) === String(id)); },

  upsert(c){
    const i = this.state.clientes.findIndex(x => String(x.id) === String(c.id));
    if (i >= 0) this.state.clientes[i] = c; else this.state.clientes.push(c);
    this.persist();
  }
};

// ---------- Status ----------
export function statusCalc(c){
  const renov = c.renovacaoDias ?? 30;
  const hoje  = todayISO();
  const dias  = renov - (diffDays(hoje, c.ultimoTreino || hoje));
  if (dias >= 10) return { label:'Ativa',           klass:'st-ok'   };
  if (dias >= 3)  return { label:'Perto de vencer', klass:'st-warn' };
  if (dias >= 0)  return { label:'Vence em breve',  klass:'st-soon' };
  return            { label:'Vencida',              klass:'st-bad'  };
}

// ---------- Programas permitidos por nível ----------
export function programsByLevel(nivel){
  switch (nivel) {
    case 'Fundação': return ['ABC','ABCD'];                 // requisito
    case 'Ascensão': return ['ABC','ABCD'];                 // pode abrir depois
    case 'Domínio' : return ['ABC','ABCD','ABCDE','ABCDEF'];
    case 'OverPrime': return ['ABC','ABCD','ABCDE','ABCDEF'];
    default: return ['ABC','ABCD'];
  }
}

// ---------- Intensidades (para Domínio/OverPrime) ----------
const INTENSIDADES_AVANCADAS = [
  'Base Intermediária (≈65–70%)',
  'Densidade / Hipertrofia (≈70–75%)',
  'Força Relativa (≈75–85%)',
  'Lapidação / Refinamento (≈75–80%)'
];

export function intensitiesByLevel(nivel){
  if (!nivel) return null;
  if (String(nivel).startsWith('Dom') || String(nivel).startsWith('Over')) {
    return INTENSIDADES_AVANCADAS.slice();
  }
  return null; // níveis iniciais não pedem intensidade
}

// ---------- Router ----------
const idRe = '([\\w\\-+.@=]+)';
const routes = [
  { path: new RegExp('^#\\/$'),                         view: DashboardView },
  { path: new RegExp('^#\\/cliente\\/' + idRe + '$'),   view: ClienteView   },
  { path: new RegExp('^#\\/avaliacao\\/' + idRe + '$'), view: AvaliacaoView },
  { path: new RegExp('^#\\/treino\\/' + idRe + '\\/novo$'), view: TreinoView }, // <<< NOVO
];

async function render(){
  const app  = document.getElementById('app');
  const hash = location.hash;
  let View = DashboardView, params = [];
  if (hash && hash !== '#' && hash !== '#/'){
    const match = routes.find(r => r.path.test(hash));
    if (match){ params = match.path.exec(hash).slice(1); View = match.view; }
  }
  app.innerHTML = await View.template(...params);
  if (View.init) await View.init(...params);
}

window.addEventListener('hashchange', render);

// ---------- Boot ----------
(async () => {
  await Store.init();
  await render();
})();

// ===============================
// PONTUAÇÃO EVOLUÍDA · Bella Prime
// ===============================
export function calcularPontuacao(respostas) {
  if (!respostas || typeof respostas !== 'object') return 0;

  // Critérios enxutos (palavras-chave por pergunta; pesos positivos/negativos)
  const criterios = [
    // Execução / Técnica
    { chave: /execu[cç][aã]o|t[ée]cnica|movimento|postura/i, bom: ['boa','correta','excelente','sem dificuldade'], ruim: ['ruim','errada','muita dificuldade'], peso: 1 },

    // Frequência semanal
    { chave: /frequ[êe]ncia|dias por semana|quantas vezes/i, bom: ['4','5','6','7'], ruim: ['0','1','2','nenhum','rara'], peso: 1 },

    // Dor / Lesão recorrente
    { chave: /dor|les[aã]o|limita[cç][aã]o|tendinite|condromalacia|condromal[áa]cia|lombar|joelho|ombro/i, bom: ['nenhuma','não','nao','controlada'], ruim: ['sim','frequente','constante'], peso: -1 },

    // Sono
    { chave: /sono/i, bom: ['bom','regular','7','8','9'], ruim: ['ruim','ins[ôo]nia','5','4','3'], peso: 1 },

    // Alimentação / Organização
    { chave: /alimenta[cç][aã]o|dieta|nutri/i, bom: ['equilibrada','organizada','planejada','acompanha'], ruim: ['desorganizada','ruim','pula','lanches'], peso: 1 },

    // Tempo de prática
    { chave: /tempo de treino|treina h[aá]|experi[êe]ncia/i, bom: ['1 ano','2 anos','3 anos','mais de','> 1'], ruim: ['iniciante','come[çc]ando','< 3 meses'], peso: 1 },

    // Constância / Motivação
    { chave: /const[âa]ncia|disciplina|motiva[cç][aã]o/i, bom: ['alta','boa','constante'], ruim: ['baixa','oscilante'], peso: 0.5 }
  ];

  let score = 0;

  for (const [pergunta, resposta] of Object.entries(respostas)) {
    for (const c of criterios) {
      if (c.chave.test(pergunta)) {
        const texto = String(resposta).toLowerCase();
        if (c.bom.some(b => texto.includes(b))) score += c.peso;
        else if (c.ruim && c.ruim.some(r => texto.includes(r))) score -= Math.abs(c.peso);
      }
    }
  }

  // Limita o score entre 0 e 9 (faixa-alvo dos teus níveis)
  score = Math.max(0, Math.min(9, score));
  return score;
}

export function nivelPorPontuacao(score) {
  // Faixas acordadas: ≤3.5 Fundação | 3.6–5.9 Ascensão | ≥6 Domínio
  if (score <= 3.5) return 'Fundação';
  if (score <= 5.9) return 'Ascensão';
  return 'Domínio';
}