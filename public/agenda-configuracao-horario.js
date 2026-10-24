/* Renderiza o horário e permite que cada representante edite somente sua turma. */
(function () {
    "use strict";

    let configuracao = null;
    let administrador = false;
    let representante = false;
    const turmaSelecionadaAdmin = new URLSearchParams(window.location.search).get("turmaId");
    const gerenciaTurma = () => representante || (administrador && Boolean(turmaSelecionadaAdmin));
    const sufixoTurma = () => turmaSelecionadaAdmin ? "?turmaId=" + encodeURIComponent(turmaSelecionadaAdmin) : "";
    const materiasPadrao = ["Ciências", "Matemática", "Português", "Redação", "Bilíngue", "Artes", "Robótica", "Ed. Física", "Socioemocional", "Literatura", "Gramática", "História", "Química", "Geografia", "Física"];
    let materiasCatalogo = null;

    async function carregarMateriasCatalogo() {
        if (materiasCatalogo) return materiasCatalogo;
        try {
            const resposta = await fetch("/api/materias" + sufixoTurma(), { cache: "no-store" });
            if (!resposta.ok) throw new Error("Catálogo indisponível");
            const dados = await resposta.json();
            if (!dados.sucesso || !Array.isArray(dados.materias)) throw new Error("Catálogo inválido");
            materiasCatalogo = dados.materias.map(m => m.nome);
        } catch (erro) {
            console.warn("Usando lista de matérias de compatibilidade:", erro);
            materiasCatalogo = materiasPadrao.slice();
        }
        return materiasCatalogo;
    }

    const escapeHtml = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

    function obterContainer() {
        return document.querySelector("#conteudo-horario-aulas");
    }

    function renderizarGrade() {
        const container = obterContainer();
        if (!container || !configuracao) return;

        const titulo = document.getElementById("titulo-horario");
        const subtitulo = document.querySelector(".horario-titulo p");
        if (titulo) titulo.textContent = "Horário de aulas — " + configuracao.turma;
        if (subtitulo) subtitulo.textContent = representante ? "Grade semanal configurada pelo representante da turma" : "Grade semanal configurada pela administração";

        let html = '<div class="horario-tabela-wrap"><table class="horario-tabela"><thead><tr><th>Horário</th>';
        configuracao.dias.forEach(dia => html += '<th>' + escapeHtml(dia.nome) + '</th>');
        html += '</tr></thead><tbody>';
        configuracao.periodos.forEach(periodo => {
            html += '<tr' + (periodo.tipo === "intervalo" ? ' class="intervalo"' : '') + '><td>' +
                escapeHtml(periodo.inicio + " - " + periodo.fim) + '</td>';
            configuracao.dias.forEach((dia, indice) => {
                const materia = periodo.tipo === "intervalo" ? "INTERVALO" : (periodo.materias[indice] || "—");
                html += '<td' + (!materia || materia === "—" ? ' class="vazio"' : '') + '>' + escapeHtml(materia) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        if (administrador || representante) {
            html += '<div class="horario-acoes-admin"><button type="button" id="editar-horario-turma">Editar horário da turma</button>' +
                (gerenciaTurma() ? '<button type="button" id="gerenciar-materias-turma">Gerenciar matérias da turma</button>' : '') +
                '</div><div id="editor-horario-turma" hidden></div><div id="editor-materias-turma"></div>';
        }
        container.innerHTML = html;
        document.getElementById("editar-horario-turma")?.addEventListener("click", abrirEditor);
        document.getElementById("gerenciar-materias-turma")?.addEventListener("click", abrirGerenciadorMaterias);
    }

    async function abrirGerenciadorMaterias() {
        if (!gerenciaTurma()) return;
        const container = obterContainer();
        if (!container) return;
        let editor = document.getElementById("editor-materias-turma");
        if (!editor) {
            editor = document.createElement("div");
            editor.id = "editor-materias-turma";
            container.appendChild(editor);
        }
        editor.innerHTML = '<p>Carregando matérias da turma…</p>';
        try {
            const resposta = await fetch("/api/materias", { cache: "no-store", credentials: "same-origin" });
            const dados = await resposta.json();
            if (!resposta.ok || !dados.sucesso || !Array.isArray(dados.materias)) throw new Error(dados.mensagem || "Não foi possível carregar as matérias.");
            materiasCatalogo = dados.materias.map(m => m.nome);
            window.MATERIAS_AGENDA = materiasCatalogo.slice();
            window.dispatchEvent(new CustomEvent("nexo:materias-carregadas", { detail: materiasCatalogo.slice() }));
            editor.innerHTML = '<section class="editor-materias-turma"><h3>Matérias da turma</h3><p>Adicionar ou desativar matérias afeta somente esta turma.</p>' +
                '<form id="form-nova-materia-turma"><label for="nova-materia-turma">Nova matéria</label><input id="nova-materia-turma" name="nome" maxlength="80" required><button type="submit">Adicionar matéria</button></form>' +
                '<ul>' + dados.materias.map(m => '<li><span>' + escapeHtml(m.nome) + '</span><button type="button" data-desativar-materia="' + Number(m.id) + '">Desativar</button></li>').join("") + '</ul><p id="status-materias-turma" role="status"></p></section>';
            editor.querySelector("#form-nova-materia-turma").addEventListener("submit", async evento => {
                evento.preventDefault();
                const campo = evento.currentTarget.elements.nome;
                const nome = campo.value.trim();
                if (!nome) return;
                const status = editor.querySelector("#status-materias-turma");
                const botao = evento.currentTarget.querySelector('button[type="submit"]');
                botao.disabled = true;
                try {
                    const r = await fetch("/api/materias", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ nome, ...(administrador && turmaSelecionadaAdmin ? { turmaId: Number(turmaSelecionadaAdmin) } : {}) }) });
                    const d = await r.json();
                    if (!r.ok || !d.sucesso) throw new Error(d.mensagem || "Não foi possível adicionar a matéria.");
                    materiasCatalogo = null;
                    await abrirGerenciadorMaterias();
                } catch (erro) {
                    status.textContent = erro.message;
                } finally {
                    botao.disabled = false;
                }
            });
            editor.querySelectorAll("[data-desativar-materia]").forEach(botao => botao.addEventListener("click", async () => {
                if (!confirm("Desativar esta matéria somente nesta turma?")) return;
                const status = editor.querySelector("#status-materias-turma");
                botao.disabled = true;
                try {
                    const r = await fetch("/api/materias/" + encodeURIComponent(botao.dataset.desativarMateria) + sufixoTurma(), { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ ativa: false }) });
                    const d = await r.json();
                    if (!r.ok || !d.sucesso) throw new Error(d.mensagem || "Não foi possível desativar a matéria.");
                    materiasCatalogo = null;
                    await abrirGerenciadorMaterias();
                } catch (erro) {
                    status.textContent = erro.message;
                    botao.disabled = false;
                }
            }));
        } catch (erro) {
            editor.innerHTML = '<p role="alert">' + escapeHtml(erro.message) + '</p>';
        }
    }

    async function abrirEditor() {
        await carregarMateriasCatalogo();
        const editor = document.getElementById("editor-horario-turma");
        if (!editor || !configuracao) return;
        editor.hidden = false;
        editor.innerHTML = '<form id="form-editor-horario"><div class="editor-horario-cabecalho"><h3>Configurar horário</h3><label>Nome da turma <input name="turma" maxlength="60" required value="' + escapeHtml(configuracao.turma) + '"></label></div>' +
            '<p>Edite os horários e as matérias. Deixe a matéria vazia quando não houver aula. Marque um período como intervalo para exibi-lo destacado.</p>' +
            '<div class="editor-horario-tabela-wrap"><table class="editor-horario-tabela"><thead><tr><th>Tipo</th><th>Início</th><th>Fim</th>' +
            configuracao.dias.map((d, i) => '<th>' + escapeHtml(d.nome) + '<button type="button" data-remover-dia="' + i + '" title="Remover dia">×</button></th>').join("") + '<th></th></tr></thead><tbody>' +
            configuracao.periodos.map((p, i) => '<tr data-periodo="' + i + '"><td><select data-campo="tipo"><option value="aula"' + (p.tipo === "aula" ? " selected" : "") + '>Aula</option><option value="intervalo"' + (p.tipo === "intervalo" ? " selected" : "") + '>Intervalo</option></select></td>' +
            '<td><input data-campo="inicio" type="time" required value="' + escapeHtml(p.inicio) + '"></td><td><input data-campo="fim" type="time" required value="' + escapeHtml(p.fim) + '"></td>' +
            p.materias.map((m, j) => '<td><select data-materia="' + j + '" aria-label="' + escapeHtml("Matéria de " + configuracao.dias[j].nome) + '"><option value="">Sem aula</option>' + Array.from(new Set([...(materiasCatalogo || materiasPadrao), ...(m && !(materiasCatalogo || materiasPadrao).includes(m) ? [m] : [])])).map(nome => '<option value="' + escapeHtml(nome) + '"' + (m === nome ? " selected" : "") + '>' + escapeHtml(nome) + '</option>').join("") + '</select></td>').join("") +
            '<td><button type="button" data-remover="' + i + '" class="remover-periodo">Remover</button></td></tr>').join("") +
            '</tbody></table></div><div class="editor-horario-acoes"><button type="button" id="adicionar-dia">+ Adicionar dia</button><button type="button" id="adicionar-periodo">+ Adicionar período</button><button type="submit">Salvar horário</button><button type="button" id="cancelar-editor-horario">Cancelar</button></div><p id="mensagem-editor-horario" role="status"></p></form>';

        function capturarEdicao() {
            const form = editor.querySelector("#form-editor-horario");
            return {
                turma: form.elements.turma.value.trim() || configuracao.turma,
                dias: configuracao.dias.map(d => ({ ...d })),
                periodos: Array.from(form.querySelectorAll("tbody tr[data-periodo]")).map(linha => ({
                    tipo: linha.querySelector('[data-campo="tipo"]').value,
                    inicio: linha.querySelector('[data-campo="inicio"]').value,
                    fim: linha.querySelector('[data-campo="fim"]').value,
                    materias: configuracao.dias.map((d, i) => linha.querySelector('[data-materia="' + i + '"]').value.trim())
                }))
            };
        }
        editor.querySelector("#adicionar-dia").addEventListener("click", () => {
            configuracao = capturarEdicao();
            if (configuracao.dias.length >= 7) return alert("O limite é de 7 dias.");
            const usados = new Set(configuracao.dias.map(d => d.id));
            const id = [1, 2, 3, 4, 5, 6, 0].find(n => !usados.has(n));
            const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
            configuracao.dias.push({ id, nome: nomes[id] });
            configuracao.periodos.forEach(p => p.materias.push(""));
            abrirEditor();
        });
        editor.querySelectorAll("[data-remover-dia]").forEach(botao => botao.addEventListener("click", () => {
            configuracao = capturarEdicao();
            if (configuracao.dias.length <= 1) return alert("A grade precisa ter pelo menos um dia.");
            const indice = Number(botao.dataset.removerDia);
            configuracao.dias.splice(indice, 1);
            configuracao.periodos.forEach(p => p.materias.splice(indice, 1));
            abrirEditor();
        }));
        editor.querySelector("#adicionar-periodo").addEventListener("click", () => {
            configuracao = capturarEdicao();
            const ultimo = configuracao.periodos[configuracao.periodos.length - 1];
            if (configuracao.periodos.length >= 16) return alert("O limite é de 16 períodos.");
            configuracao.periodos.push({ inicio: ultimo?.fim || "12:20", fim: "13:10", tipo: "aula", materias: configuracao.dias.map(() => "") });
            abrirEditor();
        });
        editor.querySelectorAll("[data-remover]").forEach(botao => botao.addEventListener("click", () => {
            configuracao = capturarEdicao();
            if (configuracao.periodos.length <= 1) return;
            configuracao.periodos.splice(Number(botao.dataset.remover), 1);
            abrirEditor();
        }));
        editor.querySelector("#cancelar-editor-horario").addEventListener("click", () => { editor.hidden = true; });
        editor.querySelector("#form-editor-horario").addEventListener("submit", salvarEditor);
    }

    async function salvarEditor(evento) {
        evento.preventDefault();
        const editor = document.getElementById("editor-horario-turma");
        const formulario = evento.currentTarget;
        const mensagem = editor.querySelector("#mensagem-editor-horario");
        const nova = {
            turma: formulario.elements.turma.value.trim(),
            dias: configuracao.dias.map(d => ({ ...d })),
            periodos: Array.from(formulario.querySelectorAll("tbody tr[data-periodo]")).map(linha => ({
                tipo: linha.querySelector('[data-campo="tipo"]').value,
                inicio: linha.querySelector('[data-campo="inicio"]').value,
                fim: linha.querySelector('[data-campo="fim"]').value,
                materias: configuracao.dias.map((d, i) => linha.querySelector('[data-materia="' + i + '"]').value.trim())
            }))
        };
        if (nova.periodos.some(p => !p.inicio || !p.fim || p.inicio >= p.fim)) {
            mensagem.textContent = "Confira os horários: o fim precisa ser posterior ao início.";
            return;
        }
        const botao = formulario.querySelector('button[type="submit"]');
        botao.disabled = true;
        mensagem.textContent = "Salvando...";
        try {
            const resposta = await fetch("/api/horario-turma", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ configuracao: nova, ...(administrador && turmaSelecionadaAdmin ? { turmaId: Number(turmaSelecionadaAdmin) } : {}) })
            });
            const dados = await resposta.json();
            if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || "Falha ao salvar.");
            configuracao = dados.configuracao;
            window.NEXO_HORARIO_TURMA = configuracao;
            renderizarGrade();
            window.dispatchEvent(new CustomEvent("nexo:horario-atualizado", { detail: configuracao }));
        } catch (erro) {
            mensagem.textContent = erro.message || "Não foi possível salvar o horário.";
            botao.disabled = false;
        }
    }

    async function inicializar() {
        try {
            const [respostaHorario, respostaSessao] = await Promise.all([
                fetch("/api/horario-turma" + sufixoTurma(), { cache: "no-store" }),
                fetch("/api/sessao", { cache: "no-store" })
            ]);
            if (!respostaHorario.ok) throw new Error("Falha ao carregar o horário.");
            const dados = await respostaHorario.json();
            const sessao = await respostaSessao.json();
            if (!dados.sucesso || !dados.configuracao) throw new Error(dados.mensagem || "Horário indisponível.");
            configuracao = dados.configuracao;
            administrador = Boolean(sessao.logado && sessao.tipo === "admin");
            representante = Boolean(sessao.logado && sessao.tipo === "representante");
            window.NEXO_HORARIO_TURMA = configuracao;
            renderizarGrade();
            window.dispatchEvent(new CustomEvent("nexo:horario-carregado", { detail: configuracao }));
        } catch (erro) {
            console.error("Não foi possível carregar o horário configurável:", erro);
        }
    }

    const funcaoOriginal = window.obterMateriasDoDia;
    window.obterMateriasDoDia = function (data) {
        if (!configuracao || !data) return typeof funcaoOriginal === "function" ? funcaoOriginal(data) : [];
        const partes = data.split("-").map(Number);
        const diaSemana = new Date(partes[0], partes[1] - 1, partes[2]).getDay();
        const indiceDia = configuracao.dias.findIndex(d => d.id === diaSemana);
        if (indiceDia < 0) return [];
        return [...new Set(configuracao.periodos
            .filter(p => p.tipo === "aula")
            .map(p => p.materias[indiceDia])
            .filter(Boolean))];
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicializar);
    else inicializar();
})();
