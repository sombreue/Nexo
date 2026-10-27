(() => {
    const $ = id => document.getElementById(id);
    const usuarioLogado = $("admin-usuario");
    const listaUsuarios = $("lista-usuarios");
    const listaSessoes = $("lista-sessoes");
    const listaTurmas = $("lista-turmas");
    const statusTurmas = $("status-turmas");
    const seletorTurmaConta = $("turma-nova-conta");
    const seletorTipoConta = $("tipo-nova-conta");
    const status = $("status-admin");
    const campoSenha = $("nova-senha");
    const botaoMostrarSenha = $("botao-mostrar-senha");
    const buscaTurmas = $("admin-inicio-busca");
    let turmasParaAbrir = [];
    let turmasAtivas = [];

    usuarioLogado.textContent = "Carregando painel...";

    const escapar = valor => String(valor ?? "").replace(/[&<>'"]/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
    }[c]));

    const dataLocal = valor => {
        if (!valor) return "sem data";
        const data = new Date(valor);
        return Number.isNaN(data.getTime()) ? "sem data" : data.toLocaleString("pt-BR", {dateStyle:"short", timeStyle:"short"});
    };

    async function json(resposta) {
        const dados = await resposta.json().catch(() => ({}));
        if (resposta.status === 401) {
            window.location.href = "/login.html";
            throw new Error("Sessão encerrada.");
        }
        if (resposta.status === 403) {
            window.location.href = "/";
            throw new Error("Acesso negado.");
        }
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || "Não foi possível concluir a operação.");
        return dados;
    }

    async function verificarAdmin() {
        try {
            const resposta = await fetch("/api/usuario", {
                credentials: "same-origin",
                cache: "no-store",
                headers: { "Accept": "application/json" },
                signal: AbortSignal.timeout(5000)
            });

            if (resposta.status === 401 || resposta.status === 403) {
                window.location.replace("/login.html");
                return false;
            }

            const dados = await resposta.json().catch(() => null);

            if (!resposta.ok || !dados?.sucesso || !dados?.usuario) {
                throw new Error(dados?.mensagem || "Não foi possível verificar a sessão.");
            }

            if (dados.usuario.tipo !== "admin") {
                window.location.replace("/");
                return false;
            }

            usuarioLogado.textContent = `Logado como: ${dados.usuario.usuario} (administrador)`;
            return true;
        } catch (erro) {
            usuarioLogado.textContent = erro.name === "TimeoutError"
                ? "O servidor demorou demais para responder."
                : "Não foi possível verificar a sessão.";
            setTimeout(() => window.location.replace("/login.html"), 700);
            return false;
        }
    }


    async function carregarTurmas() {
        try {
            const dados = await json(await fetch("/api/turmas", {credentials:"same-origin", cache:"no-store"}));
            const ativas = dados.turmas.filter(t => t.ativa);
            turmasAtivas = ativas;
            const anterior = seletorTurmaConta.value;
            seletorTurmaConta.innerHTML = '<option value="">Selecione a turma</option>' + ativas.map(t =>
                '<option value="' + escapar(t.id) + '">' + escapar(t.nome) + (t.anoLetivo ? ' · ' + escapar(t.anoLetivo) : '') + '</option>'
            ).join("");
            if (ativas.some(t => String(t.id) === anterior)) seletorTurmaConta.value = anterior;
            atualizarSeletorTurmaConta();
            listaTurmas.innerHTML = dados.turmas.map(t => `
                <article class="usuario-admin-item">
                    <div class="item-principal">
                        <strong>${escapar(t.nome)}</strong>
                        <span class="item-meta">${t.anoLetivo ? "Ano letivo " + escapar(t.anoLetivo) + " · " : ""}${t.ativa ? "Ativa" : "Arquivada"}</span>
                    </div>
                    <div class="usuario-acoes">
                        <button type="button" data-alterar-turma="${escapar(t.id)}" data-ativa-turma="${t.ativa ? "false" : "true"}">${t.ativa ? "Arquivar" : "Reativar"}</button>
                    </div>
                </article>`
            ).join("") || '<div class="estado-vazio">Nenhuma turma criada.</div>';
        } catch (erro) {
            listaTurmas.innerHTML = '<div class="estado-vazio">' + escapar(erro.message) + '</div>';
            seletorTurmaConta.innerHTML = '<option value="">Não foi possível carregar turmas</option>';
        }
    }

    function renderizarTurmasParaAbrir() {
        if (!buscaTurmas) return;
        const termo = buscaTurmas.value.trim().toLocaleLowerCase("pt-BR");
        const filtradas = turmasParaAbrir.filter(t =>
            String(t.nome || "").toLocaleLowerCase("pt-BR").includes(termo) ||
            String(t.anoLetivo || "").includes(termo)
        );
        const ativas = filtradas.filter(t => t.ativa);
        const arquivadas = filtradas.filter(t => !t.ativa);
        $("admin-inicio-total-ativas").textContent = String(ativas.length);
        $("admin-inicio-total-arquivadas").textContent = String(arquivadas.length);
        const card = turma => {
            const nome = escapar(turma.nome);
            const ano = turma.anoLetivo ? "Ano letivo " + escapar(turma.anoLetivo) : "Turma do Nexo";
            const estado = turma.ativa ? "Ativa" : "Arquivada";
            return '<a class="admin-turma-card" href="/agenda.html?turmaId=' + encodeURIComponent(turma.id) + '">' +
                '<div class="admin-turma-card-topo"><span class="admin-turma-card-icone" aria-hidden="true">▦</span><span class="admin-turma-card-status">' + estado + '</span></div>' +
                '<h3>' + nome + '</h3><p>' + ano + '</p><span class="admin-turma-card-abrir">Acessar turma →</span></a>';
        };
        $("admin-inicio-ativas").innerHTML = ativas.map(card).join("") || '<div class="admin-inicio-vazio">Nenhuma turma ativa corresponde à busca.</div>';
        $("admin-inicio-arquivadas").innerHTML = arquivadas.map(card).join("") || '<div class="admin-inicio-vazio">Nenhuma turma arquivada corresponde à busca.</div>';
    }

    async function carregarTurmasParaAbrir() {
        const area = $("admin-inicio-status");
        if (!area) return;
        area.textContent = "Atualizando turmas...";
        try {
            const dados = await json(await fetch("/api/turmas", {credentials:"same-origin", cache:"no-store"}));
            turmasParaAbrir = Array.isArray(dados.turmas) ? dados.turmas : [];
            renderizarTurmasParaAbrir();
            area.textContent = turmasParaAbrir.length ? "Lista atualizada." : "Ainda não há turmas cadastradas.";
        } catch (erro) {
            area.textContent = erro.message;
            $("admin-inicio-ativas").innerHTML = '<div class="admin-inicio-vazio">Não foi possível carregar as turmas.</div>';
            $("admin-inicio-arquivadas").innerHTML = "";
        }
    }

    function atualizarSeletorTurmaConta() {
        const adminGlobal = seletorTipoConta.value === "admin";
        seletorTurmaConta.disabled = adminGlobal;
        seletorTurmaConta.required = !adminGlobal;
        if (adminGlobal) seletorTurmaConta.value = "";
    }

    async function carregarUsuarios() {
        try {
            const dados = await json(await fetch("/api/admin/usuarios", {credentials:"same-origin", cache:"no-store"}));
            const atual = dados.usuarioLogadoId ?? null;
            listaUsuarios.innerHTML = dados.usuarios.map(usuario => `
                <article class="usuario-admin-item">
                    <div class="item-principal">
                        <strong>${escapar(usuario.usuario)}</strong>
                        <span class="item-meta">${usuario.tipo === "admin" ? "Administrador global" : usuario.tipo === "representante" ? "Representante de turma" : "Usuário"}${usuario.turmaNome ? " · " + escapar(usuario.turmaNome) : ""}</span>
                    </div>
                    <div class="usuario-acoes">
                        ${usuario.tipo !== "admin" ? `<label class="turma-conta-edicao"><span class="sr-only">Turma de ${escapar(usuario.usuario)}</span><select data-turma-conta="${usuario.id}" aria-label="Turma de ${escapar(usuario.usuario)}">${[...turmasAtivas, ...(usuario.turmaId && !turmasAtivas.some(t => String(t.id) === String(usuario.turmaId)) ? [{id:usuario.turmaId,nome:usuario.turmaNome || "Turma arquivada",ativa:false}] : [])].map(t => `<option value="${escapar(t.id)}" ${String(t.id) === String(usuario.turmaId) ? "selected" : ""}>${escapar(t.nome)}${t.anoLetivo ? " · " + escapar(t.anoLetivo) : ""}${t.ativa ? "" : " (arquivada)"}</option>`).join("")}</select></label><button type="button" data-salvar-turma-conta="${usuario.id}">Salvar turma</button>` : ""}
                        <button type="button" data-alterar-senha="${usuario.id}">Mudar senha</button>
                        ${usuario.id === atual ? '<em>Conta atual</em>' : `<button type="button" data-excluir-usuario="${usuario.id}">${usuario.tipo === "admin" ? "Excluir administrador" : "Excluir"}</button>`}
                    </div>
                </article>`
            ).join("") || '<div class="estado-vazio">Nenhum usuário cadastrado.</div>';
        } catch (erro) {
            listaUsuarios.innerHTML = `<div class="estado-vazio">${escapar(erro.message)}</div>`;
        }
    }

    async function carregarSessoes() {
        try {
            const dados = await json(await fetch("/api/admin/sessoes", {credentials:"same-origin", cache:"no-store"}));
            listaSessoes.innerHTML = dados.sessoes.map(sessao => `
                <article class="sessao-admin-item ${sessao.atual ? "sessao-atual" : ""}">
                    <div class="item-principal">
                        <div>
                            <strong>${escapar(sessao.usuario || "Sessão sem usuário")}</strong>
                            <div class="item-meta">${sessao.tipo === "admin" ? "Administrador" : "Usuário"} · expira em ${escapar(dataLocal(sessao.expiraEm))}</div>
                        </div>
                    </div>
                    <div class="sessao-acoes">
                        ${sessao.atual ? '<span class="sessao-tag">Esta sessão</span>' : `<button type="button" class="botao-perigo" data-encerrar-sessao="${encodeURIComponent(sessao.sid)}">Encerrar</button>`}
                    </div>
                </article>`
            ).join("") || '<div class="estado-vazio">Nenhuma sessão ativa.</div>';
        } catch (erro) {
            listaSessoes.innerHTML = `<div class="estado-vazio">${escapar(erro.message)}</div>`;
        }
    }

    async function alterarSenha(id, nome) {
        const novaSenha = prompt(`Digite a nova senha para ${nome}:`);
        if (novaSenha === null) return;
        if (novaSenha.length < 4) { status.textContent = "A senha precisa ter pelo menos 4 caracteres."; return; }
        try {
            await json(await fetch(`/api/admin/usuarios/${id}/senha`, {
                method:"PUT", credentials:"same-origin",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({senha:novaSenha})
            }));
            status.textContent = `Senha de ${nome} alterada com sucesso.`;
            carregarSessoes();
        } catch (erro) { status.textContent = erro.message; }
    }

    listaUsuarios.addEventListener("click", async evento => {
        const salvarTurma = evento.target.closest("[data-salvar-turma-conta]");
        if (salvarTurma) {
            const id = salvarTurma.dataset.salvarTurmaConta;
            const select = listaUsuarios.querySelector(`[data-turma-conta="${CSS.escape(id)}"]`);
            try {
                await json(await fetch(`/api/admin/usuarios/${encodeURIComponent(id)}/turma`, {
                    method:"PUT", credentials:"same-origin",
                    headers:{"Content-Type":"application/json"},
                    body:JSON.stringify({turmaId:select?.value})
                }));
                status.textContent = "Turma da conta alterada com sucesso.";
                await carregarUsuarios();
            } catch (erro) { status.textContent = erro.message; }
            return;
        }
        const alterar = evento.target.closest("[data-alterar-senha]");
        if (alterar) {
            const item = alterar.closest(".usuario-admin-item");
            const nome = item?.querySelector("strong")?.textContent || "este usuário";
            await alterarSenha(alterar.dataset.alterarSenha, nome);
            return;
        }
        const excluir = evento.target.closest("[data-excluir-usuario]");
        if (!excluir) return;

        const item = excluir.closest(".usuario-admin-item");
        const nome = item?.querySelector("strong")?.textContent || "esta conta";
        const meta = item?.querySelector(".item-meta")?.textContent || "";
        const ehAdmin = meta.startsWith("Administrador");

        if (!ehAdmin) {
            if (!confirm('Excluir o usuário "' + nome + '"?')) return;
        } else {
            if (!confirm('ATENÇÃO: você está prestes a excluir o administrador "' + nome + '".\\n\\nTem certeza que deseja continuar?')) return;
            if (!confirm('SEGUNDA CONFIRMAÇÃO\\n\\nA conta de administrador "' + nome + '" será excluída permanentemente.\\n\\nClique em OK somente se tiver certeza absoluta.')) return;
        }

        try {
            await json(await fetch('/api/admin/usuarios/' + excluir.dataset.excluirUsuario, {method:"DELETE", credentials:"same-origin"}));
            status.textContent = ehAdmin ? "Administrador excluído." : "Usuário excluído.";
            carregarUsuarios();
            carregarSessoes();
        } catch (erro) { status.textContent = erro.message; }
    });


    listaTurmas.addEventListener("click", async evento => {
        const botao = evento.target.closest("[data-alterar-turma]");
        if (!botao) return;
        const ativa = botao.dataset.ativaTurma === "true";
        if (!confirm(ativa ? "Reativar esta turma?" : "Arquivar esta turma? Os dados históricos serão mantidos.")) return;
        try {
            await json(await fetch("/api/turmas/" + encodeURIComponent(botao.dataset.alterarTurma), {
                method:"PATCH", credentials:"same-origin",
                headers:{"Content-Type":"application/json"}, body:JSON.stringify({ativa})
            }));
            statusTurmas.textContent = ativa ? "Turma reativada." : "Turma arquivada.";
            await carregarTurmas();
        } catch (erro) { statusTurmas.textContent = erro.message; }
    });

    $("form-criar-turma").addEventListener("submit", async evento => {
        evento.preventDefault();
        statusTurmas.textContent = "Criando turma...";
        const nome = $("nova-turma-nome").value.trim();
        const ano = $("nova-turma-ano").value;
        try {
            await json(await fetch("/api/turmas", {
                method:"POST", credentials:"same-origin",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({nome, anoLetivo: ano ? Number(ano) : null})
            }));
            statusTurmas.textContent = "Turma criada com sucesso.";
            evento.target.reset();
            await carregarTurmas();
        } catch (erro) { statusTurmas.textContent = erro.message; }
    });

    seletorTipoConta.addEventListener("change", atualizarSeletorTurmaConta);
    $("botao-atualizar-turmas").addEventListener("click", carregarTurmas);
    if (buscaTurmas) buscaTurmas.addEventListener("input", renderizarTurmasParaAbrir);
    $("admin-inicio-atualizar")?.addEventListener("click", carregarTurmasParaAbrir);

    listaSessoes.addEventListener("click", async evento => {
        const botao = evento.target.closest("[data-encerrar-sessao]");
        if (!botao) return;
        const sid = decodeURIComponent(botao.dataset.encerrarSessao);
        if (!confirm("Encerrar esta sessão remotamente? O usuário perderá o acesso imediatamente.")) return;
        try {
            await json(await fetch(`/api/admin/sessoes/${encodeURIComponent(sid)}`, {method:"DELETE", credentials:"same-origin"}));
            carregarSessoes();
        } catch (erro) { alert(erro.message); }
    });

    $("form-criar-usuario").addEventListener("submit", async evento => {
        evento.preventDefault();
        status.textContent = "Criando usuário...";
        try {
            await json(await fetch("/api/admin/usuarios", {
                method:"POST", credentials:"same-origin",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({
                    usuario:$("novo-usuario").value.trim(),
                    senha:campoSenha.value,
                    tipo:seletorTipoConta.value,
                    turmaId:seletorTurmaConta.value || null
                })
            }));
            status.textContent = "Usuário criado com sucesso.";
            evento.target.reset();
            campoSenha.type = "password";
            botaoMostrarSenha.textContent = "Mostrar";
            $("tipo-nova-conta").value = "usuario";
            atualizarSeletorTurmaConta();
            carregarUsuarios();
        } catch (erro) { status.textContent = erro.message; }
    });

    botaoMostrarSenha.addEventListener("click", () => {
        const mostrar = campoSenha.type === "password";
        campoSenha.type = mostrar ? "text" : "password";
        botaoMostrarSenha.textContent = mostrar ? "Ocultar" : "Mostrar";
    });

    $("botao-atualizar-usuarios").addEventListener("click", carregarUsuarios);
    $("botao-atualizar-sessoes").addEventListener("click", carregarSessoes);

    $("botao-logout").addEventListener("click", async () => {
        try { await fetch("/api/logout", {method:"POST", credentials:"same-origin"}); }
        finally { window.location.href="/login.html"; }
    });

    (async () => {
        usuarioLogado.textContent = "Painel administrativo";
        await carregarTurmas();
        await Promise.all([carregarUsuarios(), carregarSessoes(), carregarTurmasParaAbrir()]);
    })();
})();
