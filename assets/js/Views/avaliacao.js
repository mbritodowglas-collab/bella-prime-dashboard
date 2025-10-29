// === PONTUAÇÃO ALINHADA AO APPS SCRIPT (aceita texto ou número) ===
export function pontuar(r){
  const toNum = v => Number(String(v).replace(/\D+/g,'') || 0);
  const toStr = v => (v==null?'':String(v)).trim().toLowerCase();

  let p = 0;

  // está treinando (boolean ou "sim/não")
  const treinando = r.estaTreinando === true || /sim/.test(toStr(r.estaTreinando));
  p += treinando ? 2 : -3;

  // frequência semanal (número)
  const f = toNum(r.frequenciaSemanal);
  if (f <= 1) p += -2;
  else if (f === 2) p += 0;
  else if (f <= 4) p += 1;
  else if (f <= 6) p += 2;
  else p += 3; // 7+

  // sono (1–5) -> 4 ou 5 = +2; 3 = 0; 1–2 = -2
  const sono = toNum(r.sono) || 3;
  if (sono <= 2) p += -2;
  else if (sono === 3) p += 0;
  else /* 4 ou 5 */ p += 2;

  // dor/lesão (qualquer "sim" ou número >=1 penaliza -1)
  const dorNum = toNum(r.dorLesao);
  const dorTxt = toStr(r.dorLesao);
  if (dorNum >= 1 || /sim/.test(dorTxt)) p += -1;

  // estresse (1–5 OU "baixo/moderado/alto")
  const estresseNum = toNum(r.estresse);
  const estresseTxt = toStr(r.estresse);
  const estresseHigh = estresseNum >= 4 || /alto/.test(estresseTxt);
  const estresseMid  = estresseNum === 3 || /moderado|medio|m[eé]dio/.test(estresseTxt);
  const estresseLow  = estresseNum <= 2 || /baixo|leve/.test(estresseTxt);
  if (estresseHigh) p += -2;
  else if (estresseMid) p += 0;
  else if (estresseLow) p += 2;

  // comprometimento (1–10): ≥8 = +2; 5–7 = +1; <5 = -1
  const comp = toNum(r.comprometimento) || 5;
  if (comp >= 8) p += 2;
  else if (comp >= 5) p += 1;
  else p += -1;

  // plano alimentar (sim/parcial/não)
  const plano = toStr(r.planoAlimentar);
  if (/sim/.test(plano)) p += 2;
  else if (/parcial/.test(plano)) p += 1;

  // acompanhamento profissional (boolean ou "sim")
  const acomp = r.acompanhamentoProfissional === true || /sim/.test(toStr(r.acompanhamentoProfissional));
  if (acomp) p += 1;

  return p;
}

// === CLASSIFICAÇÃO ALINHADA AO APPS SCRIPT (sem tendência para OverPrime) ===
export function classificar(p){
  if (p <= 2)  return 'Fundação';
  if (p <= 6)  return 'Ascensão';
  if (p <= 10) return 'Domínio';
  return 'OverPrime';
}
