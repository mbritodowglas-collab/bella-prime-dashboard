import { Store, statusCalc } from '../app.js';

export const DashboardView = {
  async template(){
    const k = kpi(Store.state.clientes);
    return `
      <section class="row">
        <div class="kpi"><h4>Total</h4><div class="num">${k.total}</div></div>
        <div class="kpi"><h4>Fundação</h4><div class="num">${k.fundacao}</div></div>
        <div class="kpi"><h4>Ascensão</h4><div class="num">${k.ascensao}</div></div>
        <div class="kpi"><h4>Domínio</h4><div class="num">${k.dominio}</div></div>
      </section>

      <section class="card controls">
        <input class="input" id="q" placeholder="Buscar por nome..." />
        <select id="nivel">
          <option value="">Todos níveis</option>
          <option>Fundação</option><option>Ascensão</option><option>Domínio</option><option>OverPrime</option>
        </select>
        <select id="status">
          <option value="">Todos status</option>
          <option>Ativa</option><option>Perto de vencer</option><option>Vence em breve</option><option>Vencida</option>
        </select>
        <span style="flex:1"></span>
        <button class="btn btn-outline" id="importBtn">Importar</button>
        <input type="file" id="file" style="display:none" accept="application/json" />
        <button class="btn btn-primary" id="exportBtn">Exportar</button>
      </section>

      <section class="card chart-card">
        <canvas id="chartNiveis" height="120"></canvas>
      </section>

      <section class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Nível</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th style="width:120px;text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </section>
    `;
  },

  async init(){
    const $ = (s) => document.querySelector(s);

    $('#q').value = Store.state.filters.q;
    $('#nivel').value = Store.state.filters.nivel || '';
    $('#status').value = Store.state.filters.status || '';

    const renderTable = () => {
      const body = document.getElementById('tbody');
      body.innerHTML = Store.list().map(rowHTML).join('');

      // botão ver perfil
      body.querySelectorAll('a[data-id]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          location.hash = `#/cliente/${a.dataset.id}`;
        });
      });

      // botão excluir cliente
      body.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.dataset.id;
          const nome = e.target.dataset.nome;
          if (confirm(`Deseja realmente excluir ${nome}?`)) {
            Store.state.clientes = Store.state.clientes.filter(c => String(c.id) !== String(id));
            Store.persist();
            renderTable();
            chartNiveis();
          }
        });
      });
    };

    $('#q').addEventListener('input', e => { Store.state.filters.q = e.target.value; renderTable(); });
    $('#nivel').addEventListener('change', e => { Store.state.filters.nivel = e.target.value; renderTable(); });
    $('#status').addEventListener('change', e => { Store.state.filters.status = e.target.value; renderTable(); });

    document.getElementById('exportBtn').addEventListener('click', () => Store.exportJSON());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('file').click());
    document.getElementById('file').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      await Store.importJSON(f);
      chartNiveis();
      renderTable();
    });

    chartNiveis();
    renderTable();
  }
};

function rowHTML(c){
  const status = statusCalc(c);
  const klass = {
    'Fundação': 'level-fundacao',
    'Ascensão': 'level-ascensao',
    'Domínio': 'level-dominio',
    'OverPrime': 'level-overprime'
  }[c.nivel] || 'level-fundacao';

  return `
    <tr>
      <td>${c.nome}</td>
      <td><span class="badge ${klass}">${c.nivel}</span></td>
      <td>${c.ultimoTreino}</td>
      <td><span class="status ${status.klass}">${status.label}</span></td>
      <td style="text-align:right;">
        <a href="#" data-id="${c.id}" class="btn btn-outline" style="padding:4px 8px;">Ver</a>
        <button class="btn btn-outline btn-del" data-id="${c.id}" data-nome="${c.nome}" style="padding:4px 8px;">🗑️</button>
      </td>
    </tr>`;
}

function kpi(arr){
  const total = arr.length;
  const by = arr.reduce((a, c) => { a[c.nivel] = (a[c.nivel] || 0) + 1; return a; }, {});
  return {
    total,
    fundacao: by['Fundação'] || 0,
    ascensao: by['Ascensão'] || 0,
    dominio: by['Domínio'] || 0,
    over: by['OverPrime'] || 0
  };
}

function chartNiveis(){
  const ctx = document.getElementById('chartNiveis');
  if (!ctx) return;
  const arr = Store.state.clientes;
  const data = {
    labels: ['Fundação', 'Ascensão', 'Domínio', 'OverPrime'],
    datasets: [{
      label: 'Distribuição por Nível',
      data: [
        arr.filter(c => c.nivel === 'Fundação').length,
        arr.filter(c => c.nivel === 'Ascensão').length,
        arr.filter(c => c.nivel === 'Domínio').length,
        arr.filter(c => c.nivel === 'OverPrime').length,
      ],
      borderWidth: 1
    }]
  };
  new Chart(ctx, { type: 'bar', data, options: { scales: { y: { beginAtZero: true } } } });
}