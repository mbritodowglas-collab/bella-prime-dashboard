// ================================
// VIEW: Relatório da Cliente (A4/print) — com gráficos e explicações (versão com fallbacks + Resumo 2 linhas)
// ================================
import { Store } from '../app.js';

const BRAND_NAME_FALLBACK = (typeof window !== 'undefined' && window.BP_BRAND_NAME) || 'Márcio Dowglas Treinador';
const LOGO_PNG_FALLBACK   = (typeof window !== 'undefined' && window.BP_BRAND_LOGO_PNG) || './assets/img/logo-mdpersonal.png';

let pesoChart = null;
let rcqChart  = null;
let rceChart  = null;
let bfChart   = null;

// -------- helpers base --------
function esc(s){ return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function isNum(v){ return Number.isFinite(parseNumber(v)); }
function nOrDash(v, d=0){ const n = parseNumber(v); return Number.isFinite(n) ? n.toFixed(d) : '-'; }
function baseLineOptions(){
  return {
    responsive: true,
    // mantém o aspecto padrão do Chart.js (usa o atributo height do <canvas>)
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: false } }
  };
}
function pick(obj, keys){ for (const k of keys){ const val = obj?.[k]; if (val != null && String(val).trim() !== '') return val; } return undefined; }

// -------- parsing / normalização --------
function parseNumber(raw){
  if (raw == null) return undefined;
  const s = String(raw).replace(',', '.');
  const m = s.match(/-?\d*\.?\d+/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}
function parseLengthCm(raw){
  if (raw == null) return undefined;
  let s = String(raw).trim().toLowerCase().replace(',', '.');
  const m = s.match(/(-?\d*\.?\d+)\s*(mm|cm|m|centimetros|centímetros)?/i);
  if (!m) return undefined;
  let val = Number(m[1]);
  const unit = (m[2] ? m[2].toLowerCase() : '');
  if (!Number.isFinite(val)) return undefined;
  if (unit === 'm')  return val * 100;
  if (unit === 'mm') return val / 10;
  if (unit && unit !== 'm' && unit !== 'mm') return val; // cm
  return val <= 3 ? val * 100 : val;
}
function norm(s){
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim();
}

// -------- varredura profunda + merge de respostas (FR1/FR2/outros) --------
function collectAnswerLikePairs(root, maxDepth=4){
  const bag = {};
  const seen = new WeakSet();
  function walk(obj, depth){
    if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > maxDepth) return;
    seen.add(obj);
    for (const [k,v] of Object.entries(obj)){
      if (/^(__|id$|nome$|treinos$|avaliacoes$|email$|contato$|cidade$)/i.test(k)) continue;
      if (v != null && (typeof v === 'string' || typeof v === 'number')){
        if (/[a-zA-Z]/.test(k)) if (!(k in bag)) bag[k] = v;
      } else if (v && typeof v === 'object'){
        walk(v, depth+1);
      }
    }
  }
  walk(root, 0);
  return bag;
}
function mergedAnswers(cliente){
  const pools = [];
  if (cliente?._answers)  pools.push(cliente._answers);
  if (cliente?._answers2) pools.push(cliente._answers2);
  if (cliente?.answers2)  pools.push(cliente.answers2);
  if (cliente?.forms && typeof cliente.forms === 'object'){
    for (const [k,v] of Object.entries(cliente.forms)){
      if (v && typeof v === 'object' && /(form|responses|fr)\s*2/i.test(k)) pools.push(v);
    }
  }
  pools.push(collectAnswerLikePairs(cliente));
  return Object.assign({}, ...pools);
}
function pickFuzzyFromObject(obj, regexList){
  if (!obj || typeof obj !== 'object') return undefined;
  for (const [k,v] of Object.entries(obj)){
    const nk = norm(k);
    for (const rx of regexList){
      if (rx.test(nk) && v != null && String(v).trim() !== '') return v;
    }
  }
  return undefined;
}
function pickFuzzyFromAnswers(cliente, regexList){
  const pool = mergedAnswers(cliente);
  for (const [k,v] of Object.entries(pool)){
    const nk = norm(k);
    for (const rx of regexList){
      if (rx.test(nk) && v != null && String(v).trim() !== '') return v;
    }
  }
  return undefined;
}
function pickNumericPreferAval(aval, cliente, exactKeys = [], fuzzyPatterns = []){
  for (const k of exactKeys){
    const v = aval?.[k];
    if (v != null && String(v).trim() !== '' && Number.isFinite(parseNumber(v))) return v;
  }
  const fvA = pickFuzzyFromObject(aval, fuzzyPatterns);
  if (fvA != null && Number.isFinite(parseNumber(fvA))) return fvA;

  const pool = mergedAnswers(cliente);
  for (const k of exactKeys){
    const v = pool?.[k];
    if (v != null && String(v).trim() !== '' && Number.isFinite(parseNumber(v))) return v;
  }
  const fvR = pickFuzzyFromAnswers(cliente, fuzzyPatterns);
  if (fvR != null && Number.isFinite(parseNumber(fvR))) return fvR;

  return undefined;
}

// -------- altura/pescoço com prioridade avaliação → respostas --------
function getAlturaFrom(cliente, aval){
  const raw = pickNumericPreferAval(
    aval, cliente,
    ['altura','Altura','Altura (cm)','altura_cm','Altura (m)','altura_m','estatura','Estatura (cm)'],
    [/^altura(\s|\(|$)/, /estatura/, /altura.*(cm|m)/]
  );
  return parseLengthCm(raw);
}
function getPescocoFrom(cliente, aval){
  const raw = pickNumericPreferAval(
    aval, cliente,
    ['pescoco','pescoço','Pescoço','Pescoço (cm)','pescoco_cm','circ_pescoco','Circunferência do Pescoço'],
    [/pescoc/, /circ.*pescoc/]
  );
  return parseLengthCm(raw);
}

// -------- razões e %G --------
function calcRCQWithFallback(cliente, a){
  const c = parseNumber(pickNumericPreferAval(a, cliente, ['cintura','Cintura (cm)','cintura_cm'], [/cintur/]));
  const q = parseNumber(pickNumericPreferAval(a, cliente, ['quadril','Quadril (cm)','quadril_cm'], [/quadril/]));
  return (Number.isFinite(c) && Number.isFinite(q) && q !== 0) ? (c/q) : undefined;
}
function calcRCEWithFallback(cliente, a){
  const c = parseNumber(pickNumericPreferAval(a, cliente, ['cintura','Cintura (cm)','cintura_cm'], [/cintur/]));
  const h = getAlturaFrom(cliente, a);
  return (Number.isFinite(c) && Number.isFinite(h) && h > 0) ? (c/h)
       : (isNum(a?.whtr) ? parseNumber(a.whtr) : undefined);
}
function navyBodyFatFemaleFromCm({ cintura_cm, quadril_cm, pescoco_cm, altura_cm }){
  const w = parseNumber(cintura_cm), h = parseNumber(quadril_cm), n = parseNumber(pescoco_cm), ht = parseNumber(altura_cm);
  if (![w,h,n,ht].every(Number.isFinite)) return undefined;
  const wi = w/2.54, hi = h/2.54, ni = n/2.54, hti = ht/2.54;
  if (wi + hi - ni <= 0 || hti <= 0) return undefined;
  const bf = 163.205*Math.log10(wi + hi - ni) - 97.684*Math.log10(hti) - 78.387;
  return Number.isFinite(bf) ? bf : undefined;
}

// -------- diagnóstico técnico --------
function getDiagnosticoTexto(c, ultimaAval){
  const d =
    ultimaAval?.diagnostico_tecnico ??
    ultimaAval?.diagnostico ??
    ultimaAval?.parecer ??
    c?.diagnostico_tecnico ??
    c?._diagnostico_tecnico ??
    c?._ai_diagnostico ??
    c?.ai_diagnostico;

  if (d && String(d).trim()) return d;

  // Fallback: último treino (caso a análise tenha sido salva junto do treino)
  const lastTreino = (c.treinos||[])
    .slice()
    .sort((a,b)=> ((a.data_inicio||a.inicio||'').localeCompare(b.data_inicio||b.inicio||'')))
    .pop();

  return (
    lastTreino?.diagnostico_tecnico ??
    lastTreino?.diagnostico ??
    lastTreino?.parecer ??
    ''
  );
}

// -------- util: micro-tendência (últimos 2 pontos) --------
function lastTwo(arr){
  if (!Array.isArray(arr)) return [];
  const x = arr.slice().filter(v => Number.isFinite(v)).slice(-2);
  return x.length === 2 ? x : [];
}
function trendWord(v2, v1, betterWhenLower=true, tol=0.001){
  const diff = v2 - v1;
  if (Math.abs(diff) <= tol) return 'estável';
  const goingDown = diff < 0;
  return betterWhenLower ? (goingDown ? 'melhora' : 'piora') : (goingDown ? 'queda' : 'alta');
}

// -------- Resumo em 2 linhas (curto e direto) --------
function buildResumo2Linhas(c, ultimaAval, {pesoVal, rcqVal, rceVal, bfVal}, series){
  const rcqFlag = Number.isFinite(rcqVal) ? (rcqVal <= 0.85 ? 'dentro da meta de RCQ' : 'RCQ acima do ideal') : null;
  const rceFlag = Number.isFinite(rceVal) ? (rceVal < 0.50 ? 'RCE < 0,50' : 'RCE ≥ 0,50') : null;

  let bfBucket = null;
  if (Number.isFinite(bfVal)){
    if (bfVal < 21) bfBucket = 'baixo a atlético';
    else if (bfVal < 25) bfBucket = 'fitness';
    else if (bfVal < 32) bfBucket = 'médio';
    else bfBucket = 'elevado';
  }

  const peso2 = lastTwo(series.peso);
  const rcq2  = lastTwo(series.rcq);
  const rce2  = lastTwo(series.rce);
  const bf2   = lastTwo(series.bf);

  const tPeso = (peso2.length===2) ? trendWord(peso2[1], peso2[0], true) : null;
  const tRCQ  = (rcq2.length===2)  ? trendWord(rcq2[1], rcq2[0], true) : null;
  const tRCE  = (rce2.length===2)  ? trendWord(rce2[1], rce2[0], true) : null;
  const tBF   = (bf2.length===2)   ? trendWord(bf2[1], bf2[0], true)   : null;

  const parts1 = [];
  if (Number.isFinite(rcqVal)) parts1.push(`RCQ ${rcqVal.toFixed(3)} (${rcqFlag})`);
  if (Number.isFinite(rceVal)) parts1.push(`RCE ${rceVal.toFixed(3)}${rceFlag ? ` (${rceFlag})` : ''}`);
  if (Number.isFinite(bfVal))  parts1.push(`%G ${bfVal.toFixed(1)}%${bfBucket ? ` (${bfBucket})` : ''}`);
  const linha1 = parts1.length ? parts1.join(' · ') : 'Sem dados suficientes para RCQ/RCE/%G.';

  const parts2 = [];
  if (tPeso) parts2.push(`peso ${tPeso}`);
  if (tRCQ)  parts2.push(`RCQ ${tRCQ}`);
  if (tRCE)  parts2.push(`RCE ${tRCE}`);
  if (tBF)   parts2.push(`%G ${tBF}`);
  const linha2 = parts2.length ? `Tendência recente: ${parts2.join(' · ')}.` : 'Sem tendências detectáveis (dados pontuais ou insuficientes).';

  return `${linha1}\n${linha2}`;
}

// -------- timing Chart --------
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
async function waitForChart(maxTries=30){
  for (let i=0;i<maxTries;i++){
    if (window.Chart && typeof window.Chart === 'function') return true;
    await sleep(120);
  }
  console.warn('Chart.js não ficou disponível a tempo.');
  return false;
}

export const RelatorioView = {
  async template(id){
    const c = Store.byId(id);
    if (!c) return `<section class="card"><h2>Cliente não encontrada</h2></section>`;

    const ultimaAval = (c.avaliacoes||[])
      .slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')).pop() || {};

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

    // Branding (fallback)
    let BRAND_NAME = BRAND_NAME_FALLBACK;
    let RELATORIO_LOGO_PNG = LOGO_PNG_FALLBACK;
    try {
      const mod = await import('../app.js');
      BRAND_NAME = mod.BRAND_NAME || BRAND_NAME;
      RELATORIO_LOGO_PNG = mod.RELATORIO_LOGO_PNG || RELATORIO_LOGO_PNG;
    } catch (_) {}

    // ===== métricas com fallbacks =====
    const pesoRaw    = pickNumericPreferAval(ultimaAval, c,
      ['peso','Peso','Peso (kg)','peso (kg)','peso_kg','Qual é o seu peso?'], [/^peso(\s|\(|$)/, /peso.*kg/, /^kg$/]);
    const cinturaRaw = pickNumericPreferAval(ultimaAval, c, ['cintura','Cintura (cm)','cintura_cm'], [/cintur/]);
    const quadrilRaw = pickNumericPreferAval(ultimaAval, c, ['quadril','Quadril (cm)','quadril_cm'], [/quadril/]);
    const abdomeRaw  = pickNumericPreferAval(ultimaAval, c,
      ['abdomen','abdome','abdomem','abdominal','abdomen_cm','abdome_cm','Abdome (cm)','Abdomen (cm)'], [/abdom/]);

    const alturaCm   = getAlturaFrom(c, ultimaAval);
    const pescocoCm  = getPescocoFrom(c, ultimaAval);

    const rcqCalc = calcRCQWithFallback(c, ultimaAval);
    const rceCalc = calcRCEWithFallback(c, ultimaAval);

    let bfNum = parseNumber(pick(ultimaAval, [
      "bodyfat","body_fat","bf","%g","g","percentual_gordura","gordura_percentual",
      "gordura corporal","gordura corporal (%)","gordura corporal %","bf_marinha","bf_navy","body fat"
    ]));
    if (!Number.isFinite(bfNum)){
      const est = navyBodyFatFemaleFromCm({
        cintura_cm: parseNumber(cinturaRaw) ?? parseNumber(abdomeRaw),
        quadril_cm: parseNumber(quadrilRaw),
        pescoco_cm: pescocoCm,
        altura_cm : alturaCm
      });
      if (Number.isFinite(est)) bfNum = est;
    }

    // formatos
    const peso     = nOrDash(pesoRaw, 2);
    const cintura  = nOrDash(cinturaRaw, 0);
    const quadril  = nOrDash(quadrilRaw, 0);
    const abdome   = nOrDash(abdomeRaw, 0);
    const alturaF  = Number.isFinite(alturaCm)  ? alturaCm.toFixed(0)  : '-';
    const pescocoF = Number.isFinite(pescocoCm) ? pescocoCm.toFixed(0) : '-';
    const rcq      = nOrDash(rcqCalc, 3