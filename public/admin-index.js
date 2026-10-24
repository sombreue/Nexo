(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let turmas = [];

  async function json(resposta) {
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || dados.sucesso === false) throw new Error(dados.mensagem || "Não foi possível carregar os dados.");
    return dados;
  }

  async function validarAdmin() {
    const resposta = await fetch("/api/sessao", {credentials:"same-origin", cache:"no-store"});
    const dados = await resposta.json();
    if (!dados.logado) { window.location.replace("/login.html"); return false; }
    if (dados.tipo !== "admin") { window.location.replace("/"); return false; }
    $("admin-inicio-boas-vindas").textContent = "Olá, " + (dados.usuario?.usuario || dados.usuario || "administrador") + ". Selecione uma turma para trabalhar.";
    return true;
  }

  function card(turma) {
    const nome = escapeHtml(turma.nome);
    const ano = turma.anoLetivo ? "Ano letivo " + escapeHtml(turma.anoLetivo) : "Turma do Nexo";
    const status = turma.ativa ? "Ativa" : "Arquivada";
    return '<a class="admin-turma-card" href="/agenda.html?turmaId=' + encodeURIComponent(turma.id) + '" aria-label="Abrir agenda da turma ' + nome + '">' +
      '<div class="admin-turma-card-topo"><span class="admin-turma-card-icone" aria-hidden="true">▦</span><span class="admin-turma-card-status">' + status + '</span></div>' +
      '<h3>' + nome + '</h3><p>' + ano + '</p><span class="admin-turma-card-abrir">Acessar turma →</span></a>';
  }

  function renderizar() {
    const termo = $("admin-inicio-busca").value.trim().toLocaleLowerCase("pt-BR");
    const filtradas = turmas.filter(t => String(t.nome).toLocaleLowerCase("pt-BR").includes(termo) || String(t.anoLetivo || "").includes(termo));
    const ativas = filtradas.filter(t => t.ativa);
    const arquivadas = filtradas.filter(t => !t.ativa);
    $("admin-inicio-total-ativas").textContent = String(ativas.length);
    $("admin-inicio-total-arquivadas").textContent = String(arquivadas.length);
    $("admin-inicio-ativas").innerHTML = ativas.map(card).join("") || '<div class="admin-inicio-vazio">Nenhuma turma ativa corresponde à busca.</div>';
    $("admin-inicio-arquivadas").innerHTML = arquivadas.map(card).join("") || '<div class="admin-inicio-vazio">Nenhuma turma arquivada corresponde à busca.</div>';
  }

  async function carregarTurmas() {
    $("admin-inicio-status").textContent = "Atualizando turmas...";
    try {
      const dados = await json(await fetch("/api/turmas", {credentials:"same-origin", cache:"no-store"}));
      turmas = Array.isArray(dados.turmas) ? dados.turmas : [];
      renderizar();
      $("admin-inicio-status").textContent = turmas.length ? "Lista atualizada." : "Ainda não há turmas cadastradas. Crie uma no painel administrativo.";
    } catch (erro) {
      $("admin-inicio-status").textContent = erro.message;
      $("admin-inicio-ativas").innerHTML = '<div class="admin-inicio-vazio">Não foi possível carregar as turmas.</div>';
      $("admin-inicio-arquivadas").innerHTML = "";
    }
  }

  $("admin-inicio-busca").addEventListener("input", renderizar);
  $("admin-inicio-atualizar").addEventListener("click", carregarTurmas);
  $("admin-inicio-sair").addEventListener("click", async () => {
    $("admin-inicio-sair").disabled = true;
    try { await fetch("/api/logout", {method:"POST", credentials:"same-origin"}); }
    finally { window.location.replace("/login.html"); }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    if (await validarAdmin()) await carregarTurmas();
  });
})();