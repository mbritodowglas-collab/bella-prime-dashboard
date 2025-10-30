// =====================================
// BELLA PRIME · APP PRINCIPAL (com respostas completas + métricas antropométricas)
// =====================================

import { DashboardView } from './views/dashboardview.js';
import { ClienteView }   from './views/clienteview.js';
import { AvaliacaoView } from './views/avaliacaoview.js';
import { TreinoView }    from './views/treinoview.js';
import { RelatorioView } from './views/relatorioview.js'; // <<< NOVO (PDF/link externo)

const SHEETS_API = 'https://script.google.com/macros/s/AKfycbyAafbpJDWr4RF9hdTkzmnLLv1Ge258hk6jlnDo7ng2kk88GoWyJzp63rHZPMDJA-wy/exec';

// ---- Configurações de integrações/branding ----
// Google Forms (pré-preencher com ?id=&nome=)
export const PROFESSOR_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScvQBCSEVdTspYgelGI0zWbrK21ttO1IUKuf9_j5rO_a2czfA/viewform?usp=header';

// Logo em PNG para o relatório PDF (ajuste o caminho do arquivo conforme sua pasta de assets)
export const RELATORIO_LOGO_PNG = './assets/img/logo-mdpersonal.png'; // <<< PNG
export const BRAND_NAME = 'Márcio Dowglas Trainer'; // aparece no cabeçalho do relatório

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
const normNivel = (x='') => {
  const n = strip(x);
  if (n.startsWith('fund')) return 'Fundação';
  if (n.startsWith('asc'))  return 'Ascensão';
  if (n.startsWith('dom'))  return 'Domínio';
  if (n.startsWith('over')) return 'OverPrime';
  return '';
};

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
    // campos do form do professor (não entram no _answers)
    'novo_nivel','novonivel','nivel_novo','nivel aprovado','nivel_aprovado',
    'aprovado','aprovacao','aprovação','aprovacao_professor','ok','apto','apta',
    'data_decisao','data_upgrade','data_mudanca','data da decisao',
    'observacao_professor','observacao','comentario'
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

        // nível default (mantém tua lógica base)
        const nivelDefault = (() => {
          const n = strip(nivelIn || '');
          if (n.startsWith('fund')) return 'Fundação';
          if (n.startsWith('asc'))  return 'Ascensão';
          if (n.startsWith('dom'))  return 'Domínio';
          if (n.startsWith('over')) return 'OverPrime';
          if (pontForm <= 2)  return 'Fundação';
          if (pontForm <= 6)  return 'Ascensão';
          return 'Domínio';
        })();

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
          treinos: [], // histórico de treinos lançados
          _answers: collectAnswersFromRaw(raw)
        };

        // --- Detecta linha do Formulário do Professor (upgrade de nível) ---
        const novoNivelRaw = pick(o, [
          'novo_nivel','novonivel','nivel_novo','nivel aprovado','nivel_aprovado','nivel_definido'
        ]);
        const aprovadoRaw = pick(o, [
          'aprovado','aprovacao','aprovação','aprovacao_professor','ok','apto','apta'
        ]);
        const dataDecRaw  = pick(o, ['data_decisao','data_upgrade','data_mudanca','data da decisao']);
        const obsProf     = pick(o, ['observacao_professor','observacao','comentario']);

        if (novoNivelRaw) {
          const aprovado = /^s(?!$)|^sim$|^ok$|^true$|^aprov/i.test(String(aprovadoRaw||''));
          const novoNivel = normNivel(novoNivelRaw) || novoNivelRaw;
          const dataUp = (dataDecRaw && /^\d{4}-\d{2}-\d{2}$/.test(String(dataDecRaw))) ? String(dataDecRaw) : todayISO();
          base._upgradeEvent = { aprovado, novoNivel, data: dataUp, obs: obsProf || '' };
        }

        // --- Pontuação automática por respostas (fallback se não há nota explícita) ---
        if ((!pontForm || isNaN(pontForm)) && base._answers && Object.keys(base._answers).length){
          const auto = calcularPontuacao(base._answers);
          base.pontuacao = auto;
          base.nivel = nivelPorPontuacao(auto);
        }

        // adiciona avaliação com métricas + parecer (sempre que houver algo)
        if (dataAval || !isNaN(base.pontuacao) || peso !== undefined || cintura !== undefined || quadril !== undefined) {
          const dataISO = /^\d{4}-\d{2}-\d{2}$/.test(String(dataAval)) ? String(dataAval) : todayISO();
          const sugestaoNivel = nivelPorPontuacao(base.pontuacao);
          const readiness = prontidaoPorPontuacao(base.pontuacao); // Pronta / Quase lá / Manter

          base.avaliacoes.push({
            data: dataISO,
            pontuacao: isNaN(base.pontuacao) ? 0 : base.pontuacao,
            nivel: base.nivel,               // nível atual (não muda na reavaliação)
            sugestaoNivel,                   // sugerido pela pontuação
            readiness,                       // status de prontidão
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
        dst.avaliacoes = [...(dst.avaliacoes||[]), ...(r.avaliacoes||[])];
        if (!Array.isArray(dst.treinos)) dst.treinos = []; // garante array

        // acumula upgrades do professor
        if (r._upgradeEvent) {
          if (!Array.isArray(dst._allUpgrades)) dst._allUpgrades = [];
          dst._allUpgrades.push(r._upgradeEvent);
        }
        // não sobrescreve _answers; mantém o primeiro
      }

      // ordena histórico por data + calcula prontidão consecutiva e elegibilidade
      const list = [...map.values()];
      for (const c of list) {
        if (Array.isArray(c.avaliacoes)) {
          c.avaliacoes.sort((a,b)=> (a.data||'').localeCompare(b.data||''));
          const last = c.avaliacoes[c.avaliacoes.length-1];
          if (last) {
            c.pontuacao    = (typeof last.pontuacao === 'number') ? last.pontuacao : c.pontuacao;
            // OBS: nível permanece o atual por reavaliação
            c.ultimoTreino = c.ultimoTreino || last.data;
            c.sugestaoNivel = last.sugestaoNivel;
            c.readiness = last.readiness;
          }

          // conta consecutivas "Pronta para subir"
          c.prontaConsecutivas = contarProntasSeguidas(c.avaliacoes);
          c.elegivelPromocao   = c.prontaConsecutivas >= 2;
        }

        // aplica último upgrade aprovado do professor (se houver)
        const ups = (c._allUpgrades || []).filter(u => u && u.aprovado);
        if (ups.length){
          ups.sort((a,b)=> (a.data||'').localeCompare(b.data||'')); // mais antigo -> mais novo
          const lastUp = ups[ups.length-1];
          if (lastUp.novoNivel){
            c.nivel = normNivel(lastUp.novoNivel) || lastUp.novoNivel;
            c.upgradeEm  = lastUp.data;
            c.upgradeObs = lastUp.obs || '';
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
    case 'Fundação': return ['ABC','ABCD'];
    case 'Ascensão': return ['ABC','ABCD'];
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

// ---------- Pontuação/Nível/Prontidão ----------
export function calcularPontuacao(respostas) {
  if (!respostas || typeof respostas !== 'object') return 0;

  const criterios = [
    { chave: /execu[cç][aã]o|t[ée]cnica|movimento|postura/i, bom: ['boa','correta','excelente','sem dificuldade'], ruim: ['ruim','errada','muita dificuldade'], peso: 1 },
    { chave: /frequ[êe]ncia|dias por semana|quantas vezes/i, bom: ['4','5','6','7'], ruim: ['0','1','2','nenhum','rara'], peso: 1 },
    { chave: /dor|les[aã]o|limita[cç][aã]o|tendinite|condromalacia|condromal[áa]cia|lombar|joelho|ombro/i, bom: ['nenhuma','não','nao','controlada'], ruim: ['sim','frequente','constante'], peso: -1 },
    { chave: /sono/i, bom: ['bom','regular','7','8','9'], ruim: ['ruim','ins[ôo]nia','5','4','3'], peso: 1 },
    { chave: /alimenta[cç][aã]o|dieta|nutri/i, bom: ['equilibrada','organizada','planejada','acompanha'], ruim: ['desorganizada','ruim','pula','lanches'], peso: 1 },
    { chave: /tempo de treino|treina h[aá]|experi[êe]ncia/i, bom: ['1 ano','2 anos','3 anos','mais de','> 1'], ruim: ['iniciante','come[çc]ando','< 3 meses'], peso: 1 },
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

  score = Math.max(0, Math.min(9, score));
  return score;
}

export function nivelPorPontuacao(score) {
  // Faixas acordadas: ≤3.5 Fundação | 3.6–5.9 Ascensão | ≥6 Domínio
  if (score <= 3.5) return 'Fundação';
  if (score <= 5.9) return 'Ascensão';
  return 'Domínio';
}

export function prontidaoPorPontuacao(score){
  if (score >= 6)   return 'Pronta para subir';
  if (score >= 5.0) return 'Quase lá';
  return 'Manter nível';
}

function contarProntasSeguidas(avals){
  if (!Array.isArray(avals) || avals.length === 0) return 0;
  let count = 0;
  for (let i = avals.length - 1; i >= 0; i--){
    if (avals[i].readiness === 'Pronta para subir') count++;
    else break;
  }
  return count;
}

// ---------- Router ----------
const idRe = '([\\w\\-+.@=]+)';
const routes = [
  { path: new RegExp('^#\\/$'),                         view: DashboardView },
  { path: new RegExp('^#\\/cliente\\/' + idRe + '$'),   view: ClienteView   },
  { path: new RegExp('^#\\/avaliacao\\/' + idRe + '$'), view: AvaliacaoView },
  { path: new RegExp('^#\\/treino\\/' + idRe + '\\/novo$'), view: TreinoView },
  { path: new RegExp('^#\\/relatorio\\/' + idRe + '$'), view: RelatorioView }, // <<< NOVO
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
