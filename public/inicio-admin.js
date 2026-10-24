(() => {
    const usuarioLogado = document.getElementById("usuario-logado-index");
    const botaoLogout = document.getElementById("botao-logout-index");
    const linkAdmin = document.getElementById("link-admin-index");
    const cardFilaSaidas = document.getElementById("card-fila-saidas-index");
    const gradePaginas = document.querySelector(".pagina-grid");

    async function sair() {
        try {
            await fetch("/api/logout", { method:"POST", credentials:"same-origin" });
        } finally {
            window.location.href = "/login.html";
        }
    }

    botaoLogout?.addEventListener("click", sair);

    async function inicializar() {
        try {
            const resposta = await fetch("/api/usuario", {
                credentials:"same-origin",
                cache:"no-store"
            });
            const dados = await resposta.json();

            if (!resposta.ok || !dados.sucesso || !dados.usuario) {
                window.location.href = "/login.html";
                return;
            }

            const usuario = dados.usuario;

            // A fila só aparece para administradores e professores autorizados.
            try {
                const respostaFila = await fetch("/api/fila/status", {
                    credentials: "same-origin",
                    cache: "no-store"
                });
                if (respostaFila.ok) {
                    const acessoFila = await respostaFila.json();
                    if (acessoFila.sucesso && acessoFila.autorizado && cardFilaSaidas) {
                        cardFilaSaidas.hidden = false;
                        gradePaginas?.classList.add("tem-fila-saidas");
                    }
                }
            } catch (erroFila) {
                console.warn("Não foi possível verificar o acesso à fila de saídas:", erroFila);
            }

            let identificacao = `Logado como: ${usuario.usuario}${usuario.tipo === "admin" ? " (administrador)" : ""}`;
            if (usuario.tipo === "representante") {
                try {
                    const respostaTurma = await fetch("/api/turmas", {
                        credentials: "same-origin",
                        cache: "no-store"
                    });
                    const dadosTurma = await respostaTurma.json();
                    const turma = Array.isArray(dadosTurma.turmas) ? dadosTurma.turmas[0] : null;
                    if (respostaTurma.ok && dadosTurma.sucesso && turma?.nome) {
                        identificacao += ` · Representante da turma ${turma.nome}`;
                    }
                } catch (erroTurma) {
                    console.warn("Não foi possível identificar a turma do representante:", erroTurma);
                }
            }
            usuarioLogado.textContent = identificacao;
            if (botaoLogout) botaoLogout.hidden = false;

            if (usuario.tipo === "admin" && linkAdmin) {
                linkAdmin.hidden = false;
            }
        } catch (erro) {
            window.location.href = "/login.html";
        }
    }

    inicializar();
})();