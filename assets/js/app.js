// =====================================
// BELLA PRIME · APP PRINCIPAL (com respostas completas + métricas antropométricas)
// =====================================

import { DashboardView } from './views/dashboardview.js';
import { ClienteView }   from './views/clienteview.js';
import { AvaliacaoView } from './views/avaliacaoview.js';
import { TreinoView }    from './views/treinoview.js';
import { RelatorioView } from './views/relatorioview.js';

// ---------- Config gerais ----------
export const SHEETS_API = 'https://script.google.com/macros/s/AKfycbyTQxy-R22hFvEtLrBPf70qFuouXBPNCNZP87StBK_fNvIjQlvmB2Dy77pooPECwekr/exec';

// Se o seu Apps Script aceita ?sheet=<nome_da_aba> (ou ?tab=...), declare aqui as abas a ler.
const SHEETS_TABS = [
  'Form Responses 1',
  'Form Responses 2',
  'Form Responses 3'
];

// Branding (lido pelo RelatorioView via import dinâmico)
export const BRAND_NAME = 'Marcio Dowglas Treinador';
export const RELATORIO_LOGO_PNG = './assets/img/logo-mdpersonal.png';

// Form do Professor (pré-preenchido)
export const PROFESSOR_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScvQBCSEVdTspYgelGI0zWbrK21ttO1IUKuf9_j5rO_a2czfA/viewform?usp=header';

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

// novo: busca “fuzzy” por regex no NOME da coluna (já normalizado com strip)
function pickByRegex(obj, regexArr){
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || String(v).trim() === '') continue;
    for (const rx of regexArr){
      if (rx.test(k)) return v;
    }
  }
  return undefined;
}
function toNum(v){
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

const normNivel = (x='') => {
  const n = strip(x);
  if (n.startsWith('fund')) return 'Fundação';
  if (n.startsWith('asc'))  return 'Ascensão';
  if (n.startsWith('dom'))  return 'Domínio';
  if (n.startsWith('over')) return 'OverPrime';
  return '';
};

// ---------- % Gordura (Marinha EUA) ----------
function cmToIn(cm){ return Number.isFinite(cm) ? (cm / 2.54) : undefined; }
function log10(x){ return Math.log(x) / Math.LN10; }

/**
 * Calcula %G Marinha EUA.
 * @param {'F'|'M'} sexo
 * @param {number} cinturaCm
 * @param {number} quadrilCm - obrigatório para mulheres
 * @param {number} pescocoCm
 * @param {number} alturaCm
 * @returns {number|undefined}
 */
function navyBodyFat(sexo, cinturaCm, quadrilCm, pescocoCm, alturaCm){
  const C = cmToIn(cinturaCm);
  const H = cmToIn(alturaCm);
  const N = cmToIn(pescocoCm);
  const Q = cmToIn(quadrilCm);
  if (!Number.isFinite(C) || !Number.isFinite(H) || !Number.isFinite(N)) return undefined;

  if (sexo === 'M'){
    const diff = C - N;
    if (diff <= 0) return undefined;
    const bf = 86.010 * log10(diff) - 70.041 * log10(H) + 36.76;
    return Number.isFinite(bf) ? Number(Math.max(0, bf).toFixed(1)) : undefined;
  } else {
    if (!Number.isFinite(Q)) return undefined;
    const sum = C + Q - N;
    if (sum <= 0) return undefined;
    const bf = 163.205 * log10(sum) - 97.684 * log10(H) - 78.387;
    return Number.isFinite(bf) ? Number(Math.max(0, bf).toFixed(1)) : undefined;
  }
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
    // métricas que extraímos separadamente
    'peso','peso (kg)','peso kg',
    'cintura','cintura (cm)','cintura cm',
    'quadril','quadril (cm)','quadril cm',
    'altura','estatura','altura (cm)','height',
    // abdômen
    'abdome','abdome (cm)','abdome cm',
    'abdomen','abdomen (cm)','abdomen cm',
    'abdomem','abdomem (cm)','abdomem cm',
    'perimetro abdominal','perimetro abdominal (cm)','perimetro abdominal cm',
    'circunferencia abdominal','circunferencia abdominal (cm)','circunferencia abdominal cm',
    // pescoço
    'pescoço','pescoco','circunferencia do pescoco','pescoço (cm)','pescoco (cm)',
    // sexo
    'sexo','gênero','genero','sexo biologico','sexo biológico',
    // %G
    '%g','% g','percentual de gordura','percentual_gordura','gordura corporal','gordura corporal (%)','gordura corporal %',
    'bf','bf%','body fat','bodyfat','% body fat',
    // form do professor
    'novo_nivel','novonivel','nivel_novo','nivel aprovado','nivel_aprovado','nivel_definido',
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
  // helper: busca uma aba específica (tenta ?tab= e ?sheet=)
  const fetchTab = async (tabName) => {
    const tryUrls = tabName
      ? [
          `${SHEETS_API}?tab=${encodeURIComponent(tabName)}`,
          `${SHEETS_API}?sheet=${encodeURIComponent(tabName)}`
        ]
      : [SHEETS_API];

    let lastErr;
    for (const url of tryUrls){
      try{
        const r = await fetch(url, { cache:'no-store' });
        if (!r.ok) throw new Error(`Sheets HTTP ${r.status} (${tabName||'base'})`);
        const data = await r.json();
        if (!Array.isArray(data)) throw new Error(`Formato inválido em ${tabName||'base'}`);
        return data.map(row => ({ __tab: tabName || 'base', ...row }));
      }catch(e){ lastErr = e; }
    }
    throw lastErr || new Error('Falha ao buscar aba');
  };

  try{
    let datasets = [];
    if (Array.isArray(SHEETS_TABS) && SHEETS_TABS.length){
      const parts = await Promise.allSettled(SHEETS_TABS.map(fetchTab));
      for (const p of parts){
        if (p.status === 'fulfilled') datasets = datasets.concat(p.value);
        else console.warn('Aba falhou (ignorada):', p.reason?.message || p.reason);
      }
      if (datasets.length === 0){
        console.warn('Nenhuma aba retornou dados. Tentando base sem parâmetro…');
        datasets = await fetchTab(null);
      }
    } else {
      datasets = await fetchTab(null);
    }

    console.log('Sheets OK (linhas totais):', datasets.length);
    return datasets;
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

        // Avaliação base
        const dataAval = pick(o, ['data','dataavaliacao','ultimotreino']);
        const pontForm = Number(pick(o, ['pontuacao','pontuação','score','nota']) || 0);
        const nivelIn  = pick(o, ['nivel','nível','fase','faixa']);

        // ---- MÉTRICAS (fuzzy) ----
        const pesoN     = toNum(pickByRegex(o, [/^peso\b/, /\bpeso \(kg\)/]));
        const cinturaN  = toNum(pickByRegex(o, [/\bcintura\b/]));
        const quadrilN  = toNum(pickByRegex(o, [/\bquadril\b/]));
        const alturaRaw = toNum(pickByRegex(o, [/\baltura\b/, /\bestatura\b/, /\baltura \(cm\)\b/, /\bheight\b/]));
        const alturaN   = (typeof alturaRaw === 'number' && alturaRaw <= 3) ? alturaRaw*100 : alturaRaw;

        const abdomenN  = toNum(pickByRegex(o, [
          /\babdome\b/, /\babdomen\b/, /\babdomem\b/, /\babdominal\b/,
          /perimetro abdominal/, /circunferencia abdominal/
        ]));

        const pescocoN  = toNum(pickByRegex(o, [
          /\bpesco[cç]o\b/, /circunferencia do pescoco/
        ]));

        // Sexo / gênero (para %G)
        const sexoRaw = pickByRegex(o, [/\bsexo\b/, /\bg[êe]nero\b/, /sexo biolog/i]);
        const sx = String(sexoRaw || '').toLowerCase();
        const isMale   = /\b(m|masc|masculino|homem|male)\b/.test(sx);
        const sexoNorm = isMale ? 'M' : 'F';

        // RCQ / WHtR
        const rcqCalc   = (Number.isFinite(cinturaN) && Number.isFinite(quadrilN) && quadrilN !== 0) ? (cinturaN / quadrilN) : undefined;
        const whtrCalc  = (Number.isFinite(cinturaN) && Number.isFinite(alturaN)  && alturaN  !== 0) ? (cinturaN / alturaN)  : undefined;

        // %G do Forms (direto) com fallback no cálculo
        const bodyfatForm = toNum(pickByRegex(o, [
          /^%?\s*g$/, /\bpercentual.*gordura\b/, /\bgordura.*corporal\b/,
          /\bbf%?\b/, /\bbody\s*fat\b/, /\bbodyfat\b/
        ]));
        const bodyfatCalc = navyBodyFat(sexoNorm, cinturaN, quadrilN, pescocoN, alturaN);
        const bodyfatFinal = Number.isFinite(bodyfatForm) ? bodyfatForm : (Number.isFinite(bodyfatCalc) ? bodyfatCalc : undefined);

        const base = {
          id,
          nome: nome || '(Sem nome)',
          contato: contato || '',
          email: email || '',
          cidade,
          nivel: (() => {
            const n = strip(nivelIn || '');
            if (n.startsWith('fund')) return 'Fundação';
            if (n.startsWith('asc'))  return 'Ascensão';
            if (n.startsWith('dom'))  return 'Domínio';
            if (n.startsWith('over')) return 'OverPrime';
            if (pontForm <= 2)  return 'Fundação';
            if (pontForm <= 6)  return 'Ascensão';
            return 'Domínio';
          })(),
          pontuacao: isNaN(pontForm) ? 0 : pontForm,
          ultimoTreino: dataAval || undefined,
          renovacaoDias: Number(pick(o,['renovacaodias','renovacao','ciclodias'])) || 30,
          avaliacoes: [],
          treinos: [],
          _answers: collectAnswersFromRaw(raw)
        };

        // --- Detecta Form do Professor (upgrade) ---
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

        // --- Pontuação automática fallback ---
        if ((!pontForm || isNaN(pontForm)) && base._answers && Object.keys(base._answers).length){
          const auto = calcularPontuacao(base._answers);
          base.pontuacao = auto;
          base.nivel = nivelPorPontuacao(auto);
        }

        // --- Registrar avaliação (com métricas) ---
        if (
          dataAval || Number.isFinite(base.pontuacao) ||
          Number.isFinite(pesoN) || Number.isFinite(cinturaN) || Number.isFinite(quadrilN) ||
          Number.isFinite(alturaN) || Number.isFinite(abdomenN) || Number.isFinite(pescocoN) ||
          Number.isFinite(bodyfatFinal)
        ) {
          const dataISO = /^\d{4}-\d{2}-\d{2}$/.test(String(dataAval)) ? String(dataAval) : todayISO();
          const sugestaoNivel = nivelPorPontuacao(base.pontuacao);
          const readiness = prontidaoPorPontuacao(base.pontuacao);

          base.avaliacoes.push({
            data: dataISO,
            pontuacao: Number.isFinite(base.pontuacao) ? base.pontuacao : 0,
            nivel: base.nivel,
            sugestaoNivel,
            readiness,
            peso:    Number.isFinite(pesoN)        ? pesoN        : undefined,
            cintura: Number.isFinite(cinturaN)     ? cinturaN     : undefined,
            quadril: Number.isFinite(quadrilN)     ? quadrilN     : undefined,
            altura:  Number.isFinite(alturaN)      ? alturaN      : undefined,
            abdomen: Number.isFinite(abdomenN)     ? abdomenN     : undefined,
            pescoco: Number.isFinite(pescocoN)     ? pescocoN     : undefined,
            rcq:     Number.isFinite(rcqCalc)      ? rcqCalc      : undefined,
            whtr:    Number.isFinite(whtrCalc)     ? whtrCalc     : undefined,
            bodyfat: Number.isFinite(bodyfatFinal) ? bodyfatFinal : undefined
          });
        }

        if (raw && raw.__tab) base.__tab = raw.__tab;
        return base;
      });

      // colapsa por id (mantém histórico)
      const map = new Map();
      for (const r of registros) {
        if (!map.has(r.id)) { map.set(r.id, r); continue; }
        const dst = map.get(r.id);
        for (const f of ['nome','contato','email','cidade']) if (!dst[f] && r[f]) dst[f] = r[f];
        dst.avaliacoes = [...(dst.avaliacoes||[]), ...(r.avaliacoes||[])];
        if (!Array.isArray(dst.treinos)) dst.treinos = [];
        if (r._upgradeEvent) {
          if (!Array.isArray(dst._allUpgrades)) dst._allUpgrades = [];
          dst._allUpgrades.push(r._upgradeEvent);
        }
      }

      // ordena histórico + flags
      const list = [...map.values()];
      for (const c of list) {
        if (Array.isArray(c.avaliacoes)) {
          c.avaliacoes.sort((a,b)=> (a.data||'').localeCompare(b.data||''));
          const last = c.avaliacoes[c.avaliacoes.length-1];
          if (last) {
            c.pontuacao    = (typeof last.pontuacao === 'number') ? last.pontuacao : c.pontuacao;
            c.ultimoTreino = c.ultimoTreino || last.data;
            c.sugestaoNivel = last.sugestaoNivel;
            c.readiness = last.readiness;
          }
          c.prontaConsecutivas = contarProntasSeguidas(c.avaliacoes);
          c.elegivelPromocao   = c.prontaConsecutivas >= 2;
        }

        const ups = (c._allUpgrades || []).filter(u => u && u.aprovado);
        if (ups.length){
          ups.sort((a,b)=> (a.data||'').localeCompare(b.data||''));
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
  },

  exportJSON(){
    try{
      const blob = new Blob([JSON.stringify(this.state.clientes, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bella-prime-clientes-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }catch(e){
      console.error('exportJSON()', e);
      alert('Falha ao exportar JSON.');
    }
  },

  async importJSON(file){
    try{
      const txt = await file.text();
      const arr = JSON.parse(txt);
      if (!Array.isArray(arr)) throw new Error('Formato inválido (esperado array de clientes).');
      this.state.clientes = arr;
      this.persist();
    }catch(e){
      console.error('importJSON()', e);
      alert('Falha ao importar JSON: ' + e.message);
    }
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

// ---------- Programas por nível ----------
export function programsByLevel(nivel){
  switch (nivel) {
    case 'Fundação': return ['ABC','ABCD'];
    case 'Ascensão': return ['ABC','ABCD'];
    case 'Domínio' : return ['ABC','ABCD','ABCDE','ABCDEF'];
    case 'OverPrime': return ['ABC','ABCD','ABCDE','ABCDEF'];
    default: return ['ABC','ABCD'];
  }
}

// ---------- Intensidades (Domínio/OverPrime) ----------
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
  return null;
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
  { path: new RegExp('^#\\/$'),                             view: DashboardView },
  { path: new RegExp('^#\\/cliente\\/' + idRe + '$'),       view: ClienteView   },
  { path: new RegExp('^#\\/avaliacao\\/' + idRe + '$'),     view: AvaliacaoView },
  { path: new RegExp('^#\\/treino\\/' + idRe + '\\/novo$'), view: TreinoView    },
  { path: new RegExp('^#\\/relatorio\\/' + idRe + '$'),     view: RelatorioView },
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

/* =========================
   PATCH DE UI (CSS + tabelas mobile + zona segura nas ações)
   ========================= */
const BP_MOBILE_CSS = `
:root{
  --bg:#0c0c0e;--card:#121316;--muted:#9aa0a6;--text:#e9eaee;--border:#22252b;
  --primary:#c62828;--primary-2:#b61f1f;--primary-3:#a31b1b;
  --ok:#1f8f53;--warn:#c2931a;--bad:#ab2b28;--radius:14px;
  --shadow:0 6px 24px rgba(0,0,0,.35),0 1px 0 rgba(255,255,255,.02) inset;
}
html,body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;font-size:15px;-webkit-tap-highlight-color:transparent;}
.card{background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,.01));border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow);backdrop-filter:saturate(1.1) blur(2px);margin-bottom:14px;}
.input{width:100%;height:44px;border-radius:12px;padding:0 12px;border:1px solid var(--border);background:#111316;color:#e9eaee;font-size:.95rem;}
.input:focus{outline:none;border-color:#3a3f47;box-shadow:0 0 0 2px rgba(198,40,40,.12);}
.btn{--h:44px;min-width:44px;height:var(--h);line-height:var(--h);display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;padding:0 14px;font-weight:600;letter-spacing:.2px;border:1px solid var(--border);background:#14161a;color:#e9eaee;transition:transform .08s ease,filter .12s ease,background .2s ease,border-color .2s ease;cursor:pointer;text-decoration:none;}
.btn:hover{filter:brightness(1.08);} .btn:active{transform:translateY(1px);}
.btn-primary{background:var(--primary);border-color:var(--primary-2);color:#fff;} .btn-primary:hover{background:var(--primary-2);} .btn-primary:active{background:var(--primary-3);}
.btn-outline{background:transparent;} .btn-danger{background:#a32622;border-color:#8e1f1b;color:#fff;} .btn-success{background:var(--ok);border-color:#1a7b46;color:#fff;}
.badge{display:inline-block;padding:6px 10px;border-radius:999px;font-weight:700;background:#1a1d22;border:1px solid var(--border);color:#d5d7dc;font-size:.82rem;}
.status{padding:6px 10px;border-radius:999px;font-weight:700;}
.st-ok{background:rgba(16,112,64,.25);color:#7ce0b3;border:1px solid rgba(16,112,64,.35);}
.st-warn{background:rgba(197,147,26,.20);color:#ffd86b;border:1px solid rgba(197,147,26,.35);}
.st-soon{background:rgba(197,147,26,.12);color:#ffea9a;border:1px solid rgba(197,147,26,.22);}
.st-bad{background:rgba(171,43,40,.22);color:#ff9e9c;border:1px solid rgba(171,43,40,.32);}

/* Tabelas */
.table{width:100%;border-collapse:separate;border-spacing:0;min-width:520px;}
.table thead th{font-weight:700;color:#cfd2d8;text-align:left;padding:10px;}
.table tbody td{padding:10px;border-top:1px solid var(--border);}
.table tbody tr:hover{background:rgba(255,255,255,.02);}
.table-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px;}

/* Coluna de ações: zona segura */
.td-actions{text-align:right;}
.td-actions .btn{min-width:64px;}
.td-actions .btn + .btn{margin-left:12px;}
.td-actions .btn-danger{filter:saturate(1.1);}

/* Mobile: tabela em “cards” */
@media(max-width:640px){
  .table{min-width:unset;}
  .table thead{display:none;}
  .table tbody tr{display:grid;grid-template-columns:1fr auto;gap:6px;padding:10px;border-top:1px solid var(--border);}
  .table tbody td{display:flex;justify-content:space-between;align-items:center;border:none;padding:6px 0;}
  .table tbody td::before{content:attr(data-label);color:var(--muted);font-weight:600;margin-right:12px;}
  .td-actions{grid-column:1 / -1;justify-content:flex-end;}
}

.chart-card canvas{max-height:240px;}
@media(max-width:640px){.chart-card canvas{max-height:200px;}}

.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
`;

function ensureStylesInjected(){
  if (document.getElementById('bp-mobile-style')) return;
  const s = document.createElement('style');
  s.id = 'bp-mobile-style';
  s.textContent = BP_MOBILE_CSS;
  document.head.appendChild(s);
}

// Cria automaticamente data-label nos <td> e marca a última célula como “ações”
function enhanceTables(){
  document.querySelectorAll('table.table').forEach(table=>{
    const headers = [...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells = [...tr.children];
      cells.forEach((td,i)=>{
        if (!td.getAttribute('data-label')) td.setAttribute('data-label', headers[i] || '');
        if (i === cells.length - 1) td.classList.add('td-actions');
      });
    });
  });
}

// Hook no render para aplicar o patch em todas as telas
const _origRender = render;
render = async function(){
  ensureStylesInjected();
  await _origRender();
  enhanceTables();
};
ensureStylesInjected();

// Eventos de rota
window.addEventListener('hashchange', render);

// ---------- Boot ----------
(async () => {
  await Store.init();
  await render();
})();