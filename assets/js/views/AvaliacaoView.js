import { Store } from '../app.js';
import { pontuar, classificar } from '../avaliacao.js';

export const AvaliacaoView = {
  async template(id){
    const c = Store.byId(id);
    if(!c) 
      return `<div class="card"><p>Cliente não encontrado.</p><a class="btn btn-outline" href="#/">Voltar</a></div>`;

    return `
      <section class="card">
        <a class="btn btn-outline" href="#/cliente/${c.id}">← Voltar ao perfil</a>
        <h2 style="margin:8px 0 12px 0">Nova avaliação — ${c.nome}</h2>

        <form id="form" class="row" autocomplete="off">
          <div class="card">
            <label><input type="checkbox" name="estaTreinando" /> Está treinando</label><br />
            <label>Frequência semanal: 
              <input class="input" type="number" name="frequenciaSemanal" min="0" max="7" value="3" />
            </label><br />
            <label>Qualidade do sono (1–5): 
              <input class="input" type="number" name="sono" min="1" max="5" value="3" />
            </label><br />
            <label>Dor/lesão (0=nenhuma, 1=leve, 2=moderada, 3=limitante): 
              <input class="input" type="number" name="dorLesao" min="0" max="3" value="0" />
            </label><br />
          </div>

          <div class="card">
            <label>Nível de estresse (1–5): 
              <input class="input" type="number" name="estresse" min="1" max="5" value="3" />
            </label><br />
            <label>Comprometimento (1–10): 
              <input class="input" type="number" name="comprometimento" min="1" max="10" value="6" />
            </label><br />
            <label>Plano alimentar: 
              <select name="planoAlimentar">
                <option value="nao">Não</option>
                <option value="parcial">Em parte</option>
                <option value="sim">Sim</option>
              </select>
            </label><br />
            <label><input type="checkbox" name="acompanhamentoProfissional" /> Acompanhamento profissional</label><br />
          </div>
        </form>

        <div class="card" id="resultado">
          <h3 style="margin-top:0">Resultado</h3>
          <p>Pontuação: <b id="pontuacao">0</b></p>
          <p>Nível: <b id="nivel">-</b></p>
          <button class="btn btn-primary" id="salvar">Salvar avaliação</button>
        </div>
      </section>
    `;
  },

  async init(id){
    const c = Store.byId(id);
    if(!c) return;

    const $ = (s) => document.querySelector(s);
    const form = document.getElementById('form');

    // Lê os valores do formulário
    function readForm(){
      const fd = new FormData(form);
      return {
        estaTreinando: form.estaTreinando.checked,
        frequenciaSemanal: Number(fd.get('frequenciaSemanal')),
        sono: Number(fd.get('sono')),
        dorLesao: Number(fd.get('dorLesao')),
        estresse: Number(fd.get('estresse')),
        comprometimento: Number(fd.get('comprometimento')),
        planoAlimentar: fd.get('planoAlimentar'),
        acompanhamentoProfissional: form.acompanhamentoProfissional.checked
      };
    }

    // Calcula e exibe o resultado em tempo real
    function renderResultado(){
      const respostas = readForm();
      const p = pontuar(respostas);
      const n = classificar(p, c.avaliacoes || []);
      document.getElementById('pontuacao').textContent = p;
      document.getElementById('nivel').textContent = n;
      return { p, n };
    }

    form.addEventListener('input', renderResultado);
    renderResultado();

    // Botão Salvar
    document.getElementById('salvar').addEventListener('click', () => {
      const { p, n } = renderResultado();
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      const dataISO = `${y}-${m}-${da}`;

      const novo = { data: dataISO, pontuacao: p, nivel: n };
      c.avaliacoes = [...(c.avaliacoes || []), novo];
      c.nivel = n;
      c.pontuacao = p;
      c.ultimoTreino = dataISO;
      Store.upsert(c);

      // Redireciona de volta pro perfil
      location.hash = `#/cliente/${c.id}`;
    });
  }
};