import { Store } from '../app.js';

export const ClienteView = {
  async template(id){
    const c = Store.byId(id);
    if(!c) return `<div class="card"><p>Cliente não encontrado.</p><a class="btn btn-outline" href="#/">Voltar</a></div>`;

    const ult = (c.avaliacoes||[]).slice(-1)[0];
    const pen = (c.avaliacoes||[]).slice(-2)[0];
    const evoluiu = (ult && pen) ? (ult.pontuacao >= pen.pontuacao) : false;

    return `
      <section class="card">
        <a class="btn btn-outline" href="#/">← Voltar</a>
        <h2 style="margin:8px 0 0 0">${c.nome}</h2>
        <p style="color:#b5b5b5;margin:6px 0 12px 0">${c.cidade||''} ${c.contato? '· '+c.contato : ''}</p>
        <div class="row">
          <div class="card">
            <h4>Nível atual</h4>
            <div style="font-size:1.4rem;font-weight:800">${c.nivel}</div>
          </div>
          <div class="card">
            <h4>Última pontuação</h4>
            <div class="num">${ult? ult.pontuacao : '-'}</div>
          </div>
          <div class="card">
            <h4>Data da última avaliação</h4>
            <div>${ult? ult.data : '-'}</div>
          </div>
          <div class="card">
            <h4>Evoluiu?</h4>
            <div>${evoluiu ? '✔️' : '❌'}</div>
          </div>
        </div>
        <div style="margin-top:12px">
          <a class="btn btn-primary" href="#/avaliacao/${c.id}">Nova avaliação</a>
        </div>
      </section>

      <section class="card">
        <h3 style="margin-top:0">Histórico de avaliações</h3>
        <table class="table">
          <thead><tr><th>Data</th><th>Pontuação</th><th>Nível</th></tr></thead>
          <tbody>
            ${(c.avaliacoes||[]).map(a=>`<tr><td>${a.data}</td><td>${a.pontuacao}</td><td>${a.nivel}</td></tr>`).join('')}
          </tbody>
        </table>
      </section>

      <section class="card chart-card">
        <canvas id="evoChart" height="120"></canvas>
      </section>
    `;
  },
  async init(id){
    const c = Store.byId(id); if(!c) return;
    const labels = (c.avaliacoes||[]).map(a=>a.data);
    const data = (c.avaliacoes||[]).map(a=>a.pontuacao);
    const ctx = document.getElementById('evoChart');
    if(ctx && labels.length){
      new Chart(ctx, { type:'line', data:{
        labels, datasets:[{ label:'Pontuação', data, borderWidth:2, tension:.2 }]
      } });
    }
  }
};