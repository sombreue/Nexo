/* Renderiza a grade compartilhada e oferece edição aos administradores. */
(function () {
    "use strict";

    let configuracao = null;
    let administrador = false;
    const materiasPadrao = ["Ciências", "Matemática", "Português", "Redação", "Bilíngue", "Artes", "Robótica", "Ed. Física", "Socioemocional", "Literatura", "Gramática", "História", "Química", "Geografia", "Física"];

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
        if (subtitulo) subtitulo.textContent = "Grade semanal configurada pela administração";

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
        if (administrador) {
            html += '<div class="horario-acoes-admin"><button type="button" id="editar-horario-turma">Editar horário da turma</button></div><div id="editor-horario-turma" hidden></div>';
        }
        container.innerHTML = html;
        document.getElementById("editar-horario-turma")?.addEventListener("click", abrirEditor);
    }

    function abrirEditor() {
        const editor = document.getElementById("editor-horario-turma");
        if (!editor || !configuracao) return;
        editor.hidden = false;
        editor.innerHTML = '<form id="form-editor-horario"><div class="editor-horario-cabecalho"><h3>Configurar horário</h3><label>Nome da turma <input name="turma" maxlength="60" required value="' + escapeHtml(configuracao.turma) + '"></label></div>' +
            '<p>Edite os horários e as matérias. Deixe a matéria vazia quando não houver aula. Marque um período como intervalo para exibi-lo destacado.</p>' +
            '<div class="editor-horario-tabela-wrap"><table class="editor-horario-tabela"><thead><tr><th>Tipo</th><th>Início</th><th>Fim</th>' +
            configuracao.dias.map((d, i) => '<th>' + escapeHtml(d.nome) + '<button type="button" data-remover-dia="' + i + '" title="Remover dia">×</button></th>').join("") + '<th></th></tr></thead><tbody>' +
            configuracao.periodos.map((p, i) => '<tr data-periodo="' + i + '"><td><select data-campo="tipo"><option value="aula"' + (p.tipo === "aula" ? " selected" : "") + '>Aula</option><option value="intervalo"' + (p.tipo === "intervalo" ? " selected" : "") + '>Intervalo</option></select></td>' +
            '<td><input data-campo="inicio" type="time" required value="' + escapeHtml(p.inicio) + '"></td><td><input data-campo="fim" type="time" required value="' + escapeHtml(p.fim) + '"></td>' +
            p.materias.map((m, j) => '<td><input data-materia="' + j + '" maxlength="80" aria-label="' + escapeHtml("Matéria de " + configuracao.dias[j].nome) + '" value="' + escapeHtml(m) + '" placeholder="Sem aula"></td>').join("") +
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
                body: JSON.stringify({ configuracao: nova })
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
                fetch("/api/horario-turma", { cache: "no-store" }),
                fetch("/api/sessao", { cache: "no-store" })
            ]);
            if (!respostaHorario.ok) throw new Error("Falha ao carregar o horário.");
            const dados = await respostaHorario.json();
            const sessao = await respostaSessao.json();
            if (!dados.sucesso || !dados.configuracao) throw new Error(dados.mensagem || "Horário indisponível.");
            configuracao = dados.configuracao;
            administrador = Boolean(sessao.logado && sessao.tipo === "admin");
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
