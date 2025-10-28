// Regras de pontuação + classificação (alinhadas ao Apps Script)
export function pontuar(r){
  let p = 0;

  // está treinando
  p += r.estaTreinando ? 2 : -3;

  // frequência semanal
  const f = Number(r.frequenciaSemanal || 0);
  if (f <= 1) p += -2;
  else if (f === 2) p += 0;
  else if (f <= 4) p += 1;
  else if (f <= 6) p += 2;
  else p += 3; // 7x+

  // sono (1–5)
  const sono = Number(r.sono || 3);
  if (sono <= 2) p += -2;
  else if (sono === 3) p += 0;
  else if (sono === 4) p += 1;
  else p += 2;

  // dor/lesão (0/1/2/3...) — penaliza se sim
  const dor = Number(r.dorLesao || 0);
  if (dor >= 1) p += -1;

  // estresse (1–5)
  const estresse = Number(r.estresse || 3);
  if (estresse >= 4) p += -2;
  else if (estresse === 3) p += -1;
  else if (estresse === 2) p += 0;
  else p += 1;

  // comprometimento (1–10)
  const comp = Number(r.comprometimento || 5);
  if (comp <= 3) p += -2;
  else if (comp <= 6) p += 0;
  else if (comp <= 8) p += 1;
  else p += 2;

  // plano alimentar
  if (r.planoAlimentar === 'sim') p += 2;
  else if (r.planoAlimentar === 'parcial') p += 1;

  // acompanhamento profissional
  if (r.acompanhamentoProfissional) p += 1;

  return p;
}

export function classificar(p, historico = []){
  // Consistência para OverPrime (opcional): 3 últimas em tendência
  const ult = [...historico].slice(-3).map(a => a.pontuacao);
  const tendenciaOk = ult.length === 3 && (ult[2] >= ult[1] && ult[1] >= ult[0]);

  if (p <= 2)  return 'Fundação';
  if (p <= 6)  return 'Ascensão';
  if (p <= 10) return 'Domínio';
  if (p >= 11 && tendenciaOk) return 'OverPrime';
  return 'Domínio';
}