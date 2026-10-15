(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const lista = $("lista-materias");
  const status = $("materias-status");
  let materias = [];
  const escapar = valor => String(valor ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {credentials:"same-origin", cache:"no-store", ...opcoes});
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.status === 401) { location.href = "/login.html"; throw new Error("Sua sessão expirou."); }
    if (resposta.status === 403) { location.href = "/"; throw new Error("Apenas administradores podem gerenciar matérias."); }
    if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || "Não foi possível concluir a operação.");
    return dados;
  }
  async function verificarAdmin() {
    const dados = await requisicao("/api/usuario");
    if (dados.usuario?.tipo !== "admin") { location.replace("/"); return false; }
    return true;
  }
  async function carregar() {
    try {
      const dados = await requisicao("/api/materias?todas=1");
      materias = dados.materias || [];
      renderizar();
    } catch (erro) {
      lista.innerHTML = '<p class="materias-erro">' + escapar(erro.message) + '</p>';
    }
  }
  function renderizar() {
    lista.innerHTML = materias.map((m, i) => '<article class="materia-item ' + (!m.ativa ? 'materia-inativa' : '') + '">' +
      '<div class="materia-info"><div><span class="materia-nome">' + escapar(m.nome) + '</span><span class="materia-meta">' + (m.ativa ? 'Ativa' : 'Inativa — preservada nos registros existentes') + '</span></div></div>' +
      '<div class="materia-acoes"><button type="button" data-subir="' + m.id + '" aria-label="Mover ' + escapar(m.nome) + ' para cima" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
      '<button type="button" data-descer="' + m.id + '" aria-label="Mover ' + escapar(m.nome) + ' para baixo" ' + (i === materias.length - 1 ? 'disabled' : '') + '>↓</button>' +
      '<button type="button" class="' + (m.ativa ? '' : 'reativar') + '" data-ativar="' + m.id + '" data-estado="' + (!m.ativa) + '">' + (m.ativa ? 'Desativar' : 'Reativar') + '</button></div></article>'
    ).join("") || "<p>Nenhuma matéria cadastrada.</p>";
    lista.querySelectorAll("[data-ativar]").forEach(botao => botao.addEventListener("click", async () => {
      const materia = materias.find(m => m.id === Number(botao.dataset.ativar));
      if (!materia) return;
      await alterar(materia.id, {ativa: botao.dataset.estado === "true"}, materia.ativa ? "Matéria desativada." : "Matéria reativada.");
    }));
    lista.querySelectorAll("[data-subir], [data-descer]").forEach(botao => botao.addEventListener("click", async () => {
      const id = Number(botao.dataset.subir || botao.dataset.descer);
      const i = materias.findIndex(m => m.id === id);
      const j = i + (botao.hasAttribute("data-subir") ? -1 : 1);
      if (i < 0 || j < 0 || j >= materias.length) return;
      const nova = materias.slice();
      [nova[i], nova[j]] = [nova[j], nova[i]];
      try {
        await Promise.all([
          requisicao("/api/materias/" + nova[i].id, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ordem:i})}),
          requisicao("/api/materias/" + nova[j].id, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ordem:j})})
        ]);
        await carregar();
      } catch (erro) { status.textContent = erro.message; status.classList.add("materias-erro"); }
    }));
  }
  async function alterar(id, alteracao, mensagem) {
    try {
      await requisicao("/api/materias/" + id, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(alteracao)});
      status.classList.remove("materias-erro"); status.textContent = mensagem; await carregar();
    } catch (erro) { status.textContent = erro.message; status.classList.add("materias-erro"); }
  }
  $("form-nova-materia").addEventListener("submit", async evento => {
    evento.preventDefault();
    const campo = $("nome-nova-materia");
    const botao = evento.currentTarget.querySelector('button[type="submit"]');
    botao.disabled = true; status.classList.remove("materias-erro"); status.textContent = "Adicionando…";
    try {
      await requisicao("/api/materias", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({nome:campo.value.trim()})});
      campo.value = ""; status.textContent = "Matéria adicionada."; await carregar();
    } catch (erro) { status.textContent = erro.message; status.classList.add("materias-erro"); }
    finally { botao.disabled = false; }
  });
  $("atualizar-materias").addEventListener("click", carregar);
  verificarAdmin().then(ok => { if (ok) carregar(); }).catch(erro => { lista.textContent = erro.message; });
})();