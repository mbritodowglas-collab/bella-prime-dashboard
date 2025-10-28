function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Respostas ao formulário 1');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  // converte linhas em objetos
  const registros = data.map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i]));
    return o;
  });

  // agrupa por WhatsApp
  const grupos = {};
  registros.forEach((r) => {
    const id = (r["Whatsapp"] || r["whatsapp"] || "").replace(/\D+/g, "");
    if (!id) return;
    if (!grupos[id]) grupos[id] = [];
    grupos[id].push(r);
  });

  // função para classificar as avaliações
  function avaliar(r) {
    let p = 0;

    // pontuação simples (ajuste conforme seu modelo)
    if (/sim/.test((r["Está treinando?"] || "").toLowerCase())) p += 2;
    if (/5/.test(r["Quantas vezes pode treinar por semana?"])) p += 3;
    if (/6/.test(r["Quantas vezes pode treinar por semana?"])) p += 3;
    if (/7/.test(r["Quantas vezes pode treinar por semana?"])) p += 3;
    if (/4/.test(r["Quantas vezes pode treinar por semana?"])) p += 2;

    const sono = parseInt(r["Qualidade de sono"]) || 3;
    if (sono >= 4) p += 2;
    else if (sono === 3) p += 0;
    else p -= 1;

    const estresse = (r["Estresse diário"] || "").toLowerCase();
    if (estresse.includes("baixo")) p += 2;
    else if (estresse.includes("moderado")) p += 1;
    else if (estresse.includes("alto")) p -= 2;

    const comp = parseInt(r["🔥 De 1 a 10, qual o seu nível de comprometimento com essa mudança?"]) || 5;
    if (comp >= 8) p += 2;
    else if (comp >= 5) p += 1;
    else p -= 1;

    let nivel = "Domínio";
    if (p <= 2) nivel = "Fundação";
    else if (p <= 6) nivel = "Ascensão";
    else if (p <= 10) nivel = "Domínio";
    else nivel = "OverPrime";

    return { p, nivel };
  }

  const json = Object.keys(grupos).map((id) => {
    const lista = grupos[id].sort(
      (a, b) => new Date(a["Carimbo de data/hora"]) - new Date(b["Carimbo de data/hora"])
    );

    const inicial = lista[0];
    const avaliacoes = lista.map((r) => {
      const res = avaliar(r);
      const data = new Date(r["Carimbo de data/hora"]);
      return {
        data: data.toISOString().split("T")[0],
        pontuacao: res.p,
        nivel: res.nivel,
      };
    });

    const ultima = avaliacoes[avaliacoes.length - 1];

    return {
      id,
      nome: inicial["Nome completo"],
      contato: id,
      objetivo: inicial["Qual o seu objetivo?"],
      nivel: ultima.nivel,
      pontuacao: ultima.pontuacao,
      ultimoTreino: avaliacoes[avaliacoes.length - 1].data,
      avaliacoes,
    };
  });

  return ContentService.createTextOutput(JSON.stringify(json)).setMimeType(
    ContentService.MimeType.JSON
  );
}