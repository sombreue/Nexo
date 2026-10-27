let equipeEditando = null;
let tipoUsuarioAtual = null;
let turmaExpecAtual = null;

function urlFeira(caminho) {
    const url = `/api/feira/${caminho}`;
    return tipoUsuarioAtual === "admin" && turmaExpecAtual
        ? `${url}?turmaId=${encodeURIComponent(turmaExpecAtual)}`
        : url;
}

async function verificarSessao() {
    try {
        const resposta = await fetch("/api/usuario", { credentials: "same-origin", cache: "no-store" });
        if (resposta.status === 401) {
            window.location.replace("/login.html?redirect=/expec.html");
            return false;
        }
        if (!resposta.ok) return false;
        const dados = await resposta.json();
        const usuario = dados.usuario || {};
        tipoUsuarioAtual = usuario.tipo;
        const respostaTurmas = await fetch("/api/turmas", { credentials: "same-origin", cache: "no-store" });
        const dadosTurmas = await respostaTurmas.json();
        if (!respostaTurmas.ok || !dadosTurmas.sucesso) throw new Error(dadosTurmas.mensagem || "Não foi possível carregar as turmas.");

        if (tipoUsuarioAtual === "admin") {
            const seletor = document.getElementById("seletorTurmaExpec");
            const campoTurma = document.getElementById("turmaExpec");
            const turmas = Array.isArray(dadosTurmas.turmas) ? dadosTurmas.turmas : [];
            seletor.style.display = "flex";
            campoTurma.innerHTML = turmas.map(t => `<option value="${String(t.id)}">${String(t.nome).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}${t.anoLetivo ? " · " + t.anoLetivo : ""}${t.ativa ? "" : " (arquivada)"}</option>`).join("");
            const solicitado = new URLSearchParams(window.location.search).get("turmaId");
            turmaExpecAtual = turmas.some(t => String(t.id) === solicitado)
                ? solicitado
                : String((turmas.find(t => t.ativa) || turmas[0] || {}).id || "");
            if (!turmaExpecAtual) {
                campoTurma.innerHTML = '<option value="">Nenhuma turma cadastrada</option>';
                document.getElementById("listaEquipes").innerHTML = "<p>Crie uma turma para configurar sua EXPEC.</p>";
                return false;
            }
            campoTurma.value = turmaExpecAtual;
            const url = new URL(window.location.href);
            if (url.searchParams.get("turmaId") !== turmaExpecAtual) {
                url.searchParams.set("turmaId", turmaExpecAtual);
                window.history.replaceState(null, "", url);
            }
            campoTurma.addEventListener("change", () => {
                const novaUrl = new URL(window.location.href);
                novaUrl.searchParams.set("turmaId", campoTurma.value);
                window.location.assign(novaUrl);
            });
        } else {
            turmaExpecAtual = dadosTurmas.turmaId == null ? null : String(dadosTurmas.turmaId);
            const turma = dadosTurmas.turmas?.[0];
            if (turma) document.querySelector("header h1").textContent = `EXPEC — ${turma.nome}`;
            if (!turmaExpecAtual) throw new Error("Sua conta não está vinculada a uma turma.");
        }

        const ehAdmin = tipoUsuarioAtual === "admin";
        const configContador = document.getElementById("configContador");
        const botaoCriar = document.getElementById("btnCriarEquipe");
        const formDecoracao = document.getElementById("formDecoracao");
        const colunaAcoes = document.getElementById("colunaAcoes");
        const totalAcoes = document.getElementById("totalAcoes");

        // Libera todo o painel administrativo somente depois de confirmar a sessão.
        if (configContador) configContador.style.display = ehAdmin ? "block" : "none";
        if (botaoCriar) botaoCriar.style.display = ehAdmin ? "block" : "none";
        if (formDecoracao) formDecoracao.style.display = ehAdmin ? "flex" : "none";
        if (colunaAcoes) colunaAcoes.style.display = ehAdmin ? "table-cell" : "none";
        if (totalAcoes) totalAcoes.style.display = ehAdmin ? "table-cell" : "none";

        await Promise.allSettled([carregarEquipes(tipoUsuarioAtual), carregarDecoracoes(tipoUsuarioAtual)]);
        return true;
    } catch (erro) {
        console.error("Erro ao verificar sessão:", erro);
        return false;
    }
}

async function carregarEquipes(tipoUsuario) {
    try {
        const resposta = await fetch(urlFeira("equipes"), { credentials: "same-origin", cache: "no-store" });
        if (!resposta.ok) throw new Error("Erro ao buscar equipes.");
        const payload = await resposta.json();
        const equipes = Array.isArray(payload) ? payload : (payload.equipes || []);
        const lista = document.getElementById("listaEquipes");
        if (!lista) return;
        lista.innerHTML = "";
        if (!equipes.length) {
            lista.innerHTML = "<p>Nenhuma equipe cadastrada ainda.</p>";
            return;
        }
        equipes.forEach(equipe => {
            const card = document.createElement("div");
            card.className = "equipe";

            const titulo = document.createElement("h3");
            titulo.textContent = equipe.nome || "";

            const criarCampo = (rotulo, valor, fallback) => {
                const p = document.createElement("p");
                const strong = document.createElement("strong");
                strong.textContent = rotulo + ":";
                p.append(strong, " ", valor || fallback);
                return p;
            };

            card.append(
                titulo,
                criarCampo("Tema", equipe.tema, ""),
                criarCampo("Professor", equipe.professor, "Não informado"),
                criarCampo("Líder", equipe.lider, "Não informado"),
                criarCampo("Integrantes", equipe.integrantes, "Não informados")
            );
            if (tipoUsuario === "admin") {
                const acoes = document.createElement("div");
                acoes.className = "equipe-acoes";
                acoes.innerHTML = `<button onclick="editarEquipe(${equipe.id})">Editar</button><button onclick="excluirEquipe(${equipe.id})">Excluir</button>`;
                card.appendChild(acoes);
            }
            lista.appendChild(card);
        });
    } catch (erro) {
        console.error("Erro ao carregar equipes:", erro);
        const lista = document.getElementById("listaEquipes");
        if (lista) lista.innerHTML = "<p>Não foi possível carregar as equipes.</p>";
    }
}

async function carregarDecoracoes(tipoUsuario) {
    try {
        const resposta = await fetch(urlFeira("decoracoes"), { credentials: "same-origin", cache: "no-store" });
        if (!resposta.ok) throw new Error("Erro ao buscar decorações.");
        const payload = await resposta.json();
        const decoracoes = Array.isArray(payload) ? payload : (payload.decoracoes || []);
        const lista = document.getElementById("listaDecoracoes");
        if (!lista) return;
        lista.innerHTML = "";
        let total = 0;
        if (!decoracoes.length) {
            lista.innerHTML = `<tr><td colspan="3">Nenhuma decoração cadastrada.</td></tr>`;
        } else {
            decoracoes.forEach(item => {
                const preco = Number.parseFloat(String(item.preco ?? "0").replace(",", ".")) || 0;
                total += preco;
                const tr = document.createElement("tr");
                const nome = document.createElement("td");
                nome.textContent = item.nome || "";
                const valor = document.createElement("td");
                valor.textContent = preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                const acoes = document.createElement("td");
                if (tipoUsuario === "admin") {
                    const editar = document.createElement("button");
                    editar.type = "button";
                    editar.textContent = "Editar";
                    editar.addEventListener("click", () => editarDecoracao(item.id, item.nome || "", preco));
                    const excluir = document.createElement("button");
                    excluir.type = "button";
                    excluir.textContent = "Excluir";
                    excluir.addEventListener("click", () => excluirDecoracao(item.id));
                    acoes.append(editar, document.createTextNode(" "), excluir);
                }
                tr.append(nome, valor, acoes);
                lista.appendChild(tr);
            });
        }
        const totalEl = document.getElementById("totalDecoracao");
        if (totalEl) totalEl.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch (erro) {
        console.error("Erro ao carregar decorações:", erro);
        const lista = document.getElementById("listaDecoracoes");
        if (lista) lista.innerHTML = `<tr><td colspan="3">Não foi possível carregar as decorações.</td></tr>`;
    }
}

const btnAdicionarDecoracao = document.getElementById("btnAdicionarDecoracao");
if (btnAdicionarDecoracao) btnAdicionarDecoracao.addEventListener("click", async () => {
    const nome = document.getElementById("descricaoDecoracao").value.trim();
    const preco = Number(document.getElementById("precoDecoracao").value);
    if (!nome) return alert("Informe a decoração.");
    if (!Number.isFinite(preco) || preco < 0) return alert("Informe um preço válido.");
    try {
        const resposta = await fetch(urlFeira("decoracoes"), {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
            body: JSON.stringify({ nome, preco })
        });
        const resultado = await resposta.json();
        if (!resposta.ok) return alert(resultado.mensagem || "Erro ao adicionar decoração.");
        document.getElementById("descricaoDecoracao").value = "";
        document.getElementById("precoDecoracao").value = "";
        carregarDecoracoes(tipoUsuarioAtual);
    } catch (erro) { console.error(erro); alert("Erro de conexão com o servidor."); }
});

async function editarDecoracao(id, nomeAtual, precoAtual) {
    const nome = prompt("Nome da decoração:", nomeAtual);
    if (nome === null) return;
    const precoTexto = prompt("Preço:", String(precoAtual).replace(".", ","));
    if (precoTexto === null) return;
    const preco = Number(String(precoTexto).replace(",", "."));
    if (!nome.trim() || !Number.isFinite(preco) || preco < 0) return alert("Dados inválidos.");
    try {
        const resposta = await fetch(urlFeira(`decoracoes/${id}`), {
            method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
            body: JSON.stringify({ nome: nome.trim(), preco })
        });
        const resultado = await resposta.json();
        if (!resposta.ok) return alert(resultado.mensagem || "Erro ao editar decoração.");
        carregarDecoracoes(tipoUsuarioAtual);
    } catch (erro) { console.error(erro); alert("Erro de conexão com o servidor."); }
}

async function excluirDecoracao(id) {
    if (!confirm("Tem certeza que deseja excluir esta decoração?")) return;
    try {
        const resposta = await fetch(urlFeira(`decoracoes/${id}`), { method: "DELETE", credentials: "same-origin" });
        const resultado = await resposta.json();
        if (!resposta.ok) return alert(resultado.mensagem || "Erro ao excluir decoração.");
        carregarDecoracoes(tipoUsuarioAtual);
    } catch (erro) { console.error(erro); alert("Erro de conexão com o servidor."); }
}

const btnCriarEquipe = document.getElementById("btnCriarEquipe");
if (btnCriarEquipe) btnCriarEquipe.addEventListener("click", () => {
    equipeEditando = null;
    document.getElementById("tituloModal").textContent = "Criar equipe";
    document.getElementById("formEquipe").reset();
    document.getElementById("modalEquipe").style.display = "flex";
});

const btnCancelar = document.getElementById("btnCancelar");
if (btnCancelar) btnCancelar.addEventListener("click", () => {
    document.getElementById("modalEquipe").style.display = "none";
    equipeEditando = null;
});

const formEquipe = document.getElementById("formEquipe");
if (formEquipe) formEquipe.addEventListener("submit", async evento => {
    evento.preventDefault();
    const dados = {
        nome: document.getElementById("nomeEquipe").value,
        tema: document.getElementById("temaEquipe").value,
        professor: document.getElementById("professorEquipe").value,
        lider: document.getElementById("liderEquipe").value,
        integrantes: document.getElementById("integrantesEquipe").value
    };
    try {
        const resposta = await fetch(urlFeira(equipeEditando !== null ? `equipes/${equipeEditando}` : "equipes"), {
            method: equipeEditando !== null ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(dados)
        });
        const resultado = await resposta.json();
        if (!resposta.ok) return alert(resultado.mensagem || "Erro ao salvar equipe.");
        document.getElementById("modalEquipe").style.display = "none";
        equipeEditando = null;
        verificarSessao();
    } catch (erro) { console.error("Erro ao salvar equipe:", erro); alert("Erro de conexão com o servidor."); }
});

async function editarEquipe(id) {
    try {
        const resposta = await fetch(urlFeira("equipes"), { credentials: "same-origin", cache: "no-store" });
        if (!resposta.ok) throw new Error("Erro ao buscar equipes.");
        const payload = await resposta.json();
        const equipes = Array.isArray(payload) ? payload : (payload.equipes || []);
        const equipe = equipes.find(item => item.id === id);
        if (!equipe) return alert("Equipe não encontrada.");
        equipeEditando = id;
        document.getElementById("tituloModal").textContent = "Editar equipe";
        document.getElementById("nomeEquipe").value = equipe.nome || "";
        document.getElementById("temaEquipe").value = equipe.tema || "";
        document.getElementById("professorEquipe").value = equipe.professor || "";
        document.getElementById("liderEquipe").value = equipe.lider || "";
        document.getElementById("integrantesEquipe").value = equipe.integrantes || "";
        document.getElementById("modalEquipe").style.display = "flex";
    } catch (erro) { console.error("Erro ao editar equipe:", erro); alert("Não foi possível carregar a equipe."); }
}

async function excluirEquipe(id) {
    if (!confirm("Tem certeza que deseja excluir esta equipe?")) return;
    try {
        const resposta = await fetch(urlFeira(`equipes/${id}`), { method: "DELETE", credentials: "same-origin" });
        const resultado = await resposta.json();
        if (!resposta.ok) return alert(resultado.mensagem || "Erro ao excluir equipe.");
        verificarSessao();
    } catch (erro) { console.error("Erro ao excluir equipe:", erro); alert("Erro de conexão com o servidor."); }
}

async function carregarContagem() {
    try {
        const resposta = await fetch(urlFeira("contagem"), { credentials: "same-origin", cache: "no-store" });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao carregar contagem.");
        const dataValor = dados.data_apresentacao ?? dados.data;
        const dataAlvo = new Date(dataValor);
        if (Number.isNaN(dataAlvo.getTime())) throw new Error("Data da apresentação inválida recebida pela API.");
        const campoData = document.getElementById("novaDataApresentacao");
        if (campoData && dataValor) campoData.value = String(dataValor).slice(0, 16);
        const dataInicio = new Date(); dataInicio.setHours(0, 0, 0, 0);
        function atualizarContador() {
            const agora = new Date(), diferenca = dataAlvo - agora;
            const inicio = dataInicio.getTime(), fim = dataAlvo.getTime(), atual = agora.getTime();
            const progresso = fim > inicio ? ((atual - inicio) / (fim - inicio)) * 100 : 100;
            const barra = document.getElementById("barraProgresso");
            if (barra) barra.style.width = Math.min(100, Math.max(0, progresso)) + "%";
            const contador = document.getElementById("contador"), dataTexto = document.getElementById("dataApresentacao");
            if (diferenca <= 0) { if (contador) contador.textContent = "É HOJE!"; if (barra) barra.style.width = "100%"; }
            else {
                const total = Math.floor(diferenca / 1000), dias = Math.floor(total / 86400), horas = Math.floor((total % 86400) / 3600), minutos = Math.floor((total % 3600) / 60), segundos = total % 60;
                if (contador) contador.textContent = `${dias}d ${String(horas).padStart(2,"0")}h ${String(minutos).padStart(2,"0")}m ${String(segundos).padStart(2,"0")}s`;
            }
            if (dataTexto) dataTexto.textContent = "Apresentações: " + dataAlvo.toLocaleString("pt-BR");
        }
        atualizarContador(); setInterval(atualizarContador, 1000);
    } catch (erro) {
        console.error("Erro no contador:", erro);
        const contador = document.getElementById("contador"); if (contador) contador.textContent = "Erro ao carregar contador.";
    }
}

const btnSalvarData = document.getElementById("btnSalvarData");
if (btnSalvarData) btnSalvarData.addEventListener("click", async () => {
    const campo = document.getElementById("novaDataApresentacao");
    if (!campo.value) return alert("Escolha uma data e horário.");
    try {
        const resposta = await fetch(urlFeira("contagem"), { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ data: campo.value }) });
        const resultado = await resposta.json();
        if (!resposta.ok) return alert(resultado.mensagem || "Erro ao salvar data.");
        alert("Data da apresentação atualizada!"); carregarContagem();
    } catch (erro) { console.error(erro); alert("Erro de conexão com o servidor."); }
});

verificarSessao().then(ok => {
    if (!ok || !turmaExpecAtual) return;
    return carregarContagem();
});
