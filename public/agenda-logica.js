/* =========================
   HORÁRIO DE AULAS
========================= */

const horarioAulas = {

    1: [
        "Ciências",
        "Português",
        "Matemática",
        "Português",
        "Matemática"
    ],

    2: [
        "Redação",
        "Redação",
        "Bilíngue",
        "Artes",
        "Matemática",
        "Robótica"
    ],

    3: [
        "Ed. Física",
        "Ed. Física",
        "Socioemocional",
        "Literatura",
        "Matemática"
    ],

    4: [
        "Gramática",
        "História",
        "História",
        "Matemática",
        "Bilíngue",
        "Química"
    ],

    5: [
        "Geografia",
        "Física",
        "Geografia",
        "Física",
        "Gramática",
        "Ciências"
    ]

};


/* =========================
   USUÁRIO LOGADO
========================= */

let usuarioAtual = null;


/* =========================
   FORMULÁRIO
========================= */

function abrirFormulario() {

    const formulario =
        document.getElementById("formulario");

    if (!formulario) {
        return;
    }

    formulario.style.display = "block";

    formulario.scrollIntoView({
        behavior: "smooth"
    });

}


function fecharFormulario() {

    const formulario =
        document.getElementById("formulario");

    if (!formulario) {
        return;
    }

    formulario.style.display = "none";

    const data =
        document.getElementById("nova-data");

    if (data) {
        data.value = "";
    }

    const lista =
        document.getElementById(
            "lista-materias-formulario"
        );

    if (lista) {
        lista.innerHTML = "";
    }

}


/* =========================
   DATA / DIA DA SEMANA
========================= */

function descobrirDiaDaSemana(data) {

    const partes =
        data.split("-");

    const ano =
        Number(partes[0]);

    const mes =
        Number(partes[1]) - 1;

    const dia =
        Number(partes[2]);

    const dataObj =
        new Date(
            ano,
            mes,
            dia
        );

    return dataObj.getDay();

}


function nomeDoDia(numero) {

    const dias = [

        "Domingo",
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado"

    ];

    return dias[numero];

}


/* =========================
   MATÉRIAS DO DIA
========================= */

function obterMateriasDoDia(data) {

    const diaSemana =
        descobrirDiaDaSemana(data);

    /*
        Domingo = 0
        Segunda = 1
        Terça = 2
        Quarta = 3
        Quinta = 4
        Sexta = 5
        Sábado = 6
    */

    if (
        diaSemana === 0 ||
        diaSemana === 6
    ) {

        return [];

    }

    const materias =
        horarioAulas[diaSemana];

    if (!materias) {
        return [];
    }

    /*
        Remove matérias repetidas.
    */

    return [
        ...new Set(materias)
    ];

}


/* =========================
   MOSTRAR MATÉRIAS DO DIA
========================= */

function mostrarMateriasDoDia() {

    const campoData =
        document.getElementById(
            "nova-data"
        );

    const lista =
        document.getElementById(
            "lista-materias-formulario"
        );

    if (!campoData || !lista) {

        console.error(
            "Campo de data ou lista de matérias não encontrado."
        );

        return;
    }

    const data =
        campoData.value;

    lista.innerHTML = "";

    if (!data) {
        return;
    }

    const diaSemana =
        descobrirDiaDaSemana(data);

    const nomeDia =
        nomeDoDia(diaSemana);

    const materias =
        obterMateriasDoDia(data);


    console.log(
        "Data selecionada:",
        data
    );

    console.log(
        "Dia da semana:",
        nomeDia
    );

    console.log(
        "Matérias:",
        materias
    );


    /* =========================
       TÍTULO
    ========================= */

    const titulo =
        document.createElement("h3");

    titulo.textContent =
        materias.length > 0
            ? `Matérias de ${nomeDia}`
            : `${nomeDia}`;

    lista.appendChild(
        titulo
    );


    /* =========================
       CRIAR CAMPOS
       Lembrete fica disponível
       em qualquer dia, inclusive
       sábado e domingo.
    ========================= */

    const materiasDoFormulario = [
        ...materias,
        "Lembrete"
    ];

    materiasDoFormulario.forEach(materia => {

        const container =
            document.createElement("div");

        container.className =
            "materia-formulario";


        const label =
            document.createElement("label");

        label.textContent =
            materia;


        const labelTarefa = document.createElement("label");
        labelTarefa.textContent = "Tarefa";
        labelTarefa.className = "label-tarefa";

        const textarea =
            document.createElement("textarea");

        textarea.placeholder =
            `Digite a tarefa de ${materia}...`;

        textarea.dataset.materia =
            materia;

        const labelSubtitulo = document.createElement("label");
        labelSubtitulo.textContent = "Subtítulo";
        labelSubtitulo.className = "label-subtitulo";

        const subtitulo = document.createElement("input");
        subtitulo.type = "text";
        subtitulo.className = "subtitulo-tarefa";
        subtitulo.placeholder = "O que estamos aprendendo? (não vira tarefa)";
        subtitulo.dataset.materia = materia;

        const labelEntrega = document.createElement("label");

        labelEntrega.textContent =
            "Data de entrega";

        labelEntrega.className =
            "label-data-entrega";

        const dataEntrega =
            document.createElement("input");

        dataEntrega.type = "date";
        dataEntrega.className = "data-entrega-tarefa";
        dataEntrega.dataset.materia = materia;
        dataEntrega.value = "";

        container.appendChild(
            label
        );

        container.appendChild(
            labelTarefa
        );

        container.appendChild(
            textarea
        );

        container.appendChild(
            labelSubtitulo
        );

        container.appendChild(
            subtitulo
        );

        container.appendChild(
            labelEntrega
        );

        container.appendChild(
            dataEntrega
        );


        lista.appendChild(
            container
        );

    });

}


/* =========================
   ADICIONAR TAREFAS DO DIA
========================= */

async function adicionarTarefasDoDia() {

    const campoData =
        document.getElementById(
            "nova-data"
        );

    const lista =
        document.getElementById(
            "lista-materias-formulario"
        );

    if (!campoData || !lista) {

        alert(
            "Erro: formulário não encontrado."
        );

        return;
    }


    const data =
        campoData.value;


    if (!data) {

        alert(
            "Selecione uma data."
        );

        return;

    }


    const campos =
        lista.querySelectorAll(
            "textarea[data-materia]"
        );


    if (campos.length === 0) {

        alert(
            "Não existem matérias cadastradas para esse dia."
        );

        return;

    }


    const tarefas = [];


    campos.forEach(campo => {

        const descricao = campo.value.trim();
        const campoSubtitulo = campo.parentElement?.querySelector(".subtitulo-tarefa");
        const subtitulo = campoSubtitulo?.value.trim() || "";

        if (!descricao && !subtitulo) {
            return;
        }

        const campoEntrega = campo.parentElement?.querySelector(".data-entrega-tarefa");

        tarefas.push({

            data:
                data,

            materia:
                campo.dataset.materia,

            turmaId:
                document.getElementById("turma-agenda-seletor")?.value || null,

            descricao:
                descricao,

            subtitulo:
                subtitulo,

            dataEntrega:
                descricao ? (campoEntrega?.value || null) : null

        });

    });


    if (tarefas.length === 0) {

        alert(
            "Digite pelo menos uma tarefa ou subtítulo."
        );

        return;

    }


    try {

        /*
            Envia cada tarefa individualmente
            para o backend.
        */

        for (const tarefa of tarefas) {

            const resposta =
                await fetch(
                    "/api/tarefas",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                tarefa
                            )

                    }
                );


            const dados =
                await resposta.json();


            if (!dados.sucesso) {

                alert(
                    dados.mensagem
                );

                return;

            }

        }


        await carregarTarefas();


        fecharFormulario();


        alert(
            `${tarefas.length} tarefa(s) adicionada(s) com sucesso!`
        );


    } catch (erro) {

        console.error(
            "Erro ao adicionar tarefas:",
            erro
        );

        alert(
            "Erro ao conectar ao servidor."
        );

    }

}


/* =========================
   CRIAR TAREFA NA TELA
========================= */

function criarTarefa(
    id,
    data,
    materia,
    descricao,
    dataEntrega = null,
    subtitulo = null
) {

    let dia =
        document.querySelector(
            `.dia[data-data="${data}"]`
        );


    if (!dia) {

        dia =
            document.createElement("div");

        dia.className =
            "dia";

        dia.dataset.data =
            data;


        dia.innerHTML = `
            <h2>${formatarData(data)}</h2>
            <div class="tarefas"></div>
        `;


        const listaTarefas =
            document.getElementById(
                "lista-tarefas"
            );


        if (!listaTarefas) {
            return;
        }


        listaTarefas.appendChild(
    dia
);

    }


    const lista =
        dia.querySelector(
            ".tarefas"
        );


    const novaTarefa =
        document.createElement(
            "div"
        );


    novaTarefa.className =
        "tarefa";


    novaTarefa.dataset.id =
        id;
    novaTarefa.id = `tarefa-${id}`;


    const tituloTarefa = document.createElement("h3");
    tituloTarefa.textContent = materia;

    const subtituloTarefa = document.createElement("small");
    subtituloTarefa.className = "subtitulo-tarefa-exibicao";
    subtituloTarefa.textContent = subtitulo || "";

    const descricaoTarefa = document.createElement("p");
    descricaoTarefa.textContent = descricao || "";

    novaTarefa.appendChild(tituloTarefa);
    if (subtitulo) novaTarefa.appendChild(subtituloTarefa);
    if (descricao) novaTarefa.appendChild(descricaoTarefa);

    if (dataEntrega) {
        const entregaTarefa = document.createElement("small");
        entregaTarefa.className = "data-entrega-tarefa-exibicao";

        const entrega = new Date(`${dataEntrega}T00:00:00`);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const diferenca = Math.round((entrega - hoje) / 86400000);

        if (diferenca < 0) {
            entregaTarefa.textContent = `Entrega: ${formatarData(dataEntrega)} · atrasada`;
            entregaTarefa.classList.add("atrasada");
        } else if (diferenca === 0) {
            entregaTarefa.textContent = `Entrega: ${formatarData(dataEntrega)} · hoje`;
            entregaTarefa.classList.add("hoje");
        } else if (diferenca === 1) {
            entregaTarefa.textContent = `Entrega: ${formatarData(dataEntrega)} · amanhã`;
        } else {
            entregaTarefa.textContent = `Entrega: ${formatarData(dataEntrega)}`;
        }

        novaTarefa.appendChild(entregaTarefa);
    }


    /* =========================
       BOTÕES DO ADMIN
    ========================= */

    if (
        usuarioAtual &&
        ["admin", "representante"].includes(usuarioAtual.tipo)
    ) {

        const areaBotoes =
            document.createElement(
                "div"
            );


        areaBotoes.className =
            "botoes-tarefa";


        /* EDITAR */

        const botaoEditar =
            document.createElement(
                "button"
            );


        botaoEditar.textContent =
            "Editar";


        botaoEditar.onclick =
            () => abrirModalEdicao(
                id,
                data,
                materia,
                descricao,
                dataEntrega,
                subtitulo
            );


        /* EXCLUIR */

        const botaoExcluir =
            document.createElement(
                "button"
            );


        botaoExcluir.textContent =
            "Excluir";


        botaoExcluir.onclick =
            () => abrirModalExclusao(id);


        areaBotoes.appendChild(
            botaoEditar
        );


        areaBotoes.appendChild(
            botaoExcluir
        );


        novaTarefa.appendChild(
            areaBotoes
        );

    }


    lista.appendChild(
        novaTarefa
    );

}


/* =========================
   NAVEGAR ATÉ UMA TAREFA
========================= */

function abrirTarefaPeloHash() {
    const hash = window.location.hash;
    if (!hash.startsWith("#tarefa-")) return;

    const id = decodeURIComponent(hash.slice("#tarefa-".length));
    const tarefa = document.getElementById(`tarefa-${id}`);
    if (!tarefa) return;

    requestAnimationFrame(() => {
        setTimeout(() => {
            tarefa.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            tarefa.classList.remove("tarefa-destacada");
            void tarefa.offsetWidth;
            tarefa.classList.add("tarefa-destacada");

            setTimeout(() => {
                tarefa.classList.remove("tarefa-destacada");
            }, 2200);
        }, 80);
    });
}

window.addEventListener("hashchange", abrirTarefaPeloHash);


/* =========================
   CARREGAR TAREFAS
========================= */

async function carregarTarefas() {

    try {

        const resposta =
            await fetch(
                "/api/tarefas"
            );


        const dados =
            await resposta.json();


        if (!dados.sucesso) {

            console.error(
                dados.mensagem
            );

            return;

        }


        const lista =
            document.getElementById(
                "lista-tarefas"
            );


        if (!lista) {
            return;
        }


        lista.innerHTML = "";


        dados.tarefas
    .sort((a, b) => {

        // Datas mais recentes primeiro
        const comparacaoData =
            b.data.localeCompare(a.data);

        // Se forem do mesmo dia,
        // tarefas adicionadas mais recentemente primeiro
        if (comparacaoData !== 0) {
            return comparacaoData;
        }

        return b.id - a.id;

    })
    .forEach(tarefa => {

        criarTarefa(

            tarefa.id,

            tarefa.data,

            tarefa.materia,

            tarefa.descricao,

            tarefa.dataEntrega,

            tarefa.subtitulo

        );

    });

    abrirTarefaPeloHash();

    } catch (erro) {

        console.error(
            "Erro ao carregar tarefas:",
            erro
        );

    }

}


/* =========================
   EDITAR TAREFA
========================= */

function criarModalEdicao() {

    if (document.getElementById("modal-editar-tarefa")) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "modal-editar-tarefa";
    modal.className = "modal-editar-tarefa";

    modal.innerHTML = `
        <div class="conteudo-modal-editar">
            <h2>Editar tarefa</h2>

            <form id="form-editar-tarefa">
                <input type="hidden" id="editar-tarefa-id">

                <label>
                    Data
                    <input type="date" id="editar-tarefa-data" required>
                </label>

                <label>
                    Matéria
                    <input type="text" id="editar-tarefa-materia" required>
                </label>

                <label>
                    Subtítulo
                    <input type="text" id="editar-tarefa-subtitulo" placeholder="O que estamos aprendendo? (não vira tarefa)">
                </label>

                <label>
                    Data de entrega
                    <input type="date" id="editar-tarefa-data-entrega">
                </label>

                <label>
                    Tarefa
                    <textarea id="editar-tarefa-descricao" placeholder="Digite a tarefa..."></textarea>
                </label>

                <div class="botoes-modal-editar">
                    <button type="button" class="cancelar-edicao" onclick="fecharModalEdicao()">
                        Cancelar
                    </button>

                    <button type="submit">
                        Salvar alterações
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const form = document.getElementById("form-editar-tarefa");

    form.addEventListener("submit", async event => {

        event.preventDefault();

        const id = document.getElementById("editar-tarefa-id").value;
        const data = document.getElementById("editar-tarefa-data").value;
        const materia = document.getElementById("editar-tarefa-materia").value.trim();
        const descricao = document.getElementById("editar-tarefa-descricao").value.trim();
        const subtitulo = document.getElementById("editar-tarefa-subtitulo").value.trim();
        const dataEntrega = document.getElementById("editar-tarefa-data-entrega").value;

        if (!data || !materia || (!descricao && !subtitulo)) {
            alert("Preencha a tarefa ou o subtítulo.");
            return;
        }

        const botaoSalvar = form.querySelector("button[type=\"submit\"]");

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        try {

            const resposta = await fetch(
                `/api/tarefas/${id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        data,
                        materia,
                        descricao,
                        subtitulo,
                        dataEntrega: descricao ? (dataEntrega || data) : null
                    })
                }
            );

            const dados = await resposta.json();

            if (!dados.sucesso) {
                alert(dados.mensagem);
                return;
            }

            fecharModalEdicao();
            await carregarTarefas();

        } catch (erro) {

            console.error("Erro ao editar tarefa:", erro);

            alert("Erro ao conectar ao servidor.");

        } finally {

            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar alterações";

        }

    });

    modal.addEventListener("click", event => {

        if (event.target === modal) {
            fecharModalEdicao();
        }

    });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape" && modal.style.display === "flex") {
            fecharModalEdicao();
        }

    });

}

function abrirModalEdicao(
    id,
    dataAtual,
    materiaAtual,
    descricaoAtual,
    dataEntregaAtual = null,
    subtituloAtual = null
) {

    const modal = document.getElementById("modal-editar-tarefa");

    document.getElementById("editar-tarefa-id").value = id;
    document.getElementById("editar-tarefa-data").value = dataAtual;
    document.getElementById("editar-tarefa-materia").value = materiaAtual;
    document.getElementById("editar-tarefa-descricao").value = descricaoAtual || "";
    document.getElementById("editar-tarefa-subtitulo").value = subtituloAtual || "";
    document.getElementById("editar-tarefa-data-entrega").value = dataEntregaAtual || "";

    modal.style.display = "flex";

    document.getElementById("editar-tarefa-materia").focus();

}

function fecharModalEdicao() {

    const modal = document.getElementById("modal-editar-tarefa");

    if (modal) {
        modal.style.display = "none";
    }

}

function editarTarefa(
    id,
    dataAtual,
    materiaAtual,
    descricaoAtual,
    dataEntregaAtual
) {

    abrirModalEdicao(
        id,
        dataAtual,
        materiaAtual,
        descricaoAtual,
        dataEntregaAtual
    );

}


/* =========================
   EXCLUIR TAREFA
========================= */

function criarModalExclusao() {

    if (document.getElementById("modal-excluir-tarefa")) {
        return;
    }

    const modal = document.createElement("div");
    modal.id = "modal-excluir-tarefa";
    modal.className = "modal-excluir-tarefa";
    modal.innerHTML = `
        <div class="conteudo-modal-excluir" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-excluir">
            <div class="modal-excluir-icone" aria-hidden="true">!</div>
            <h2 id="titulo-modal-excluir">Excluir tarefa?</h2>
            <p id="mensagem-modal-excluir">Tem certeza que deseja excluir esta tarefa?</p>

            <div class="botoes-modal-excluir">
                <button type="button" class="cancelar-exclusao" id="cancelar-exclusao-tarefa">Cancelar</button>
                <button type="button" class="confirmar-exclusao" id="confirmar-exclusao-tarefa">Excluir</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const fechar = () => {
        modal.style.display = "none";
    };

    document.getElementById("cancelar-exclusao-tarefa").addEventListener("click", fechar);

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            fechar();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal.style.display === "flex") {
            fechar();
        }
    });
}

function abrirModalExclusao(id) {

    criarModalExclusao();

    const modal = document.getElementById("modal-excluir-tarefa");
    const mensagem = document.getElementById("mensagem-modal-excluir");
    const botoes = document.querySelector(".botoes-modal-excluir");
    const confirmar = document.getElementById("confirmar-exclusao-tarefa");

    modal.dataset.tarefaId = id;
    modal.dataset.estado = "confirmacao";

    mensagem.textContent = "Tem certeza que deseja excluir esta tarefa?";
    confirmar.textContent = "Excluir";
    confirmar.disabled = false;
    botoes.innerHTML = `
        <button type="button" class="cancelar-exclusao" id="cancelar-exclusao-tarefa">Cancelar</button>
        <button type="button" class="confirmar-exclusao" id="confirmar-exclusao-tarefa">Excluir</button>
    `;

    document.getElementById("cancelar-exclusao-tarefa").onclick = () => {
        modal.style.display = "none";
    };

    document.getElementById("confirmar-exclusao-tarefa").onclick = () => {
        excluirTarefa(id);
    };

    modal.style.display = "flex";
    document.getElementById("confirmar-exclusao-tarefa").focus();
}

async function excluirTarefa(id) {

    criarModalExclusao();

    const modal = document.getElementById("modal-excluir-tarefa");
    const mensagem = document.getElementById("mensagem-modal-excluir");
    const botoes = document.querySelector(".botoes-modal-excluir");

    const confirmar = document.getElementById("confirmar-exclusao-tarefa");
    if (!confirmar || confirmar.dataset.processando === "true") {
        return;
    }

    confirmar.dataset.processando = "true";
    confirmar.disabled = true;
    confirmar.textContent = "Excluindo...";

    try {
        const resposta = await fetch(`/api/tarefas/${id}`, {
            method: "DELETE"
        });

        const dados = await resposta.json();

        if (!dados.sucesso) {
            mensagem.textContent = dados.mensagem || "Não foi possível excluir a tarefa.";
            confirmar.disabled = false;
            confirmar.dataset.processando = "false";
            confirmar.textContent = "Tentar novamente";
            return;
        }

        await carregarTarefas();

        modal.dataset.estado = "sucesso";
        mensagem.textContent = "Tarefa excluída com sucesso.";
        botoes.innerHTML = `
            <button type="button" class="confirmar-exclusao" id="fechar-modal-exclusao">Fechar</button>
        `;
        document.getElementById("fechar-modal-exclusao").onclick = () => {
            modal.style.display = "none";
        };

    } catch (erro) {
        console.error("Erro ao excluir tarefa:", erro);
        mensagem.textContent = "Erro ao conectar ao servidor.";
        confirmar.disabled = false;
        confirmar.dataset.processando = "false";
        confirmar.textContent = "Tentar novamente";
    }
}


/* =========================
   FILTRO POR DATA
========================= */

function filtrarPorData() {

    const campoData =
        document.getElementById(
            "data"
        );


    if (!campoData) {
        return;
    }


    const dataSelecionada =
        campoData.value;


    const dias =
        document.querySelectorAll(
            ".dia"
        );


    dias.forEach(dia => {

        if (
            dia.dataset.data ===
            dataSelecionada
        ) {

            dia.style.display =
                "block";

        } else {

            dia.style.display =
                "none";

        }

    });

}


function limparFiltro() {

    document
        .querySelectorAll(
            ".dia"
        )
        .forEach(dia => {

            dia.style.display =
                "block";

        });


    const campoData =
        document.getElementById(
            "data"
        );


    if (campoData) {

        campoData.value =
            "";

    }

}


/* =========================
   FORMATAR DATA
========================= */

function formatarData(data) {

    const partes =
        data.split("-");

    const numeroDia =
        descobrirDiaDaSemana(data);

    const diaDaSemana =
        nomeDoDia(numeroDia);

    return `${diaDaSemana}, ${partes[2]} de ${nomeDoMes(partes[1])} de ${partes[0]}`;

}


function nomeDoMes(numero) {

    const meses = [

        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro"

    ];

    return meses[
        parseInt(numero) - 1
    ];

}


/* =========================
   SESSÃO
========================= */

async function verificarSessao() {

    try {

        const resposta =
            await fetch(
                "/api/sessao"
            );


        const dados =
            await resposta.json();


        if (!dados.logado) {

            window.location.href =
                "/login.html";

            return;

        }


        usuarioAtual = {

            id:
                dados.usuario?.id,

            usuario:
                dados.usuario?.usuario,

            tipo:
                dados.usuario?.tipo ?? dados.tipo

        };


        console.log(
            "USUÁRIO LOGADO:",
            usuarioAtual
        );


        /* =========================
           USUÁRIO NA TELA
        ========================= */

        const elemento =
            document.getElementById(
                "usuario-logado"
            );


        if (elemento) {

            elemento.textContent =
                `Logado como: ${dados.usuario} (${dados.tipo})`;

        }


        /* =========================
           ÁREA DE ADICIONAR
        ========================= */

        const areaAdicionar =
            document.getElementById(
                "area-adicionar"
            );


        if (areaAdicionar) {
            areaAdicionar.style.display =
                ["admin", "representante"].includes(dados.tipo) ? "block" : "none";
        }

        const seletorTurmaAgenda = document.getElementById("turma-agenda-seletor");
        const labelTurmaAgenda = document.getElementById("label-turma-agenda");
        if (seletorTurmaAgenda && labelTurmaAgenda) {
            const ehAdminGlobal = dados.tipo === "admin";
            seletorTurmaAgenda.style.display = ehAdminGlobal ? "inline-block" : "none";
            labelTurmaAgenda.style.display = ehAdminGlobal ? "inline-block" : "none";
            if (ehAdminGlobal) {
                try {
                    const respostaTurmas = await fetch("/api/turmas", { cache: "no-store" });
                    const dadosTurmas = await respostaTurmas.json();
                    if (respostaTurmas.ok && dadosTurmas.sucesso) {
                        const turmasAtivas = dadosTurmas.turmas.filter(t => t.ativa);
                        seletorTurmaAgenda.innerHTML = turmasAtivas.map(t =>
                            '<option value="' + String(t.id).replace(/[^0-9]/g, '') + '">' +
                            String(t.nome).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) +
                            (t.anoLetivo ? ' · ' + t.anoLetivo : '') + '</option>'
                        ).join("");
                        if (!turmasAtivas.length) seletorTurmaAgenda.innerHTML = '<option value="">Nenhuma turma ativa</option>';
                    }
                } catch (erroTurmas) {
                    console.error("Não foi possível carregar as turmas:", erroTurmas);
                    seletorTurmaAgenda.innerHTML = '<option value="">Erro ao carregar turmas</option>';
                }
            }
        }


        /* =========================
           PAINEL ADMIN
        ========================= */

        const painelAdmin =
            document.getElementById(
                "painel-admin"
            );


        if (painelAdmin) {

            if (
                dados.tipo ===
                "admin"
            ) {

                painelAdmin.style.display =
                    "block";


                await carregarUsuarios();

            } else {

                painelAdmin.style.display =
                    "none";

            }

        }


        /* =========================
           CARREGAR TAREFAS
        ========================= */

        await carregarTarefas();


    } catch (erro) {

        console.error(
            "Erro ao verificar sessão:",
            erro
        );

    }

}


/* =========================
   USUÁRIOS
========================= */

async function carregarUsuarios() {

    try {

        const resposta =
            await fetch(
                "/api/admin/usuarios"
            );


        const dados =
            await resposta.json();


        if (!dados.sucesso) {

            console.error(
                dados.mensagem
            );

            return;

        }


        const lista =
            document.getElementById(
                "lista-usuarios"
            );


        if (!lista) {
            return;
        }


        lista.innerHTML = "";


        dados.usuarios.forEach(
            usuario => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "usuario-admin";


                /* INFORMAÇÕES */

                const informacoes =
                    document.createElement(
                        "span"
                    );


                informacoes.textContent =
                    `${usuario.usuario} — ${usuario.tipo}`;


                item.appendChild(
                    informacoes
                );


                /* ALTERAR SENHA */

                const botaoSenha =
                    document.createElement(
                        "button"
                    );


                botaoSenha.textContent =
                    "Alterar senha";


                botaoSenha.onclick =
                    () => alterarSenha(
                        usuario.id,
                        usuario.usuario
                    );


                item.appendChild(
                    botaoSenha
                );


                /* EXCLUIR */

                if (
                    usuario.id !==
                    usuarioAtual?.id
                ) {

                    const botaoExcluir =
                        document.createElement(
                            "button"
                        );


                    botaoExcluir.textContent =
                        "Excluir";


                    botaoExcluir.onclick =
                        () => excluirUsuario(
                            usuario.id
                        );


                    item.appendChild(
                        botaoExcluir
                    );

                }


                lista.appendChild(
                    item
                );

            }
        );


    } catch (erro) {

        console.error(
            "Erro ao carregar usuários:",
            erro
        );

    }

}


/* =========================
   ALTERAR SENHA
========================= */

let usuarioAlterarSenhaId =
    null;


function alterarSenha(
    id,
    usuario
) {

    usuarioAlterarSenhaId =
        id;


    const texto =
        document.getElementById(
            "usuario-senha"
        );


    if (texto) {

        texto.textContent =
            `Alterando senha de: ${usuario}`;

    }


    const campo =
        document.getElementById(
            "senha-alterada"
        );


    if (campo) {

        campo.value =
            "";

    }


    const modal =
        document.getElementById(
            "modal-senha"
        );


    if (modal) {

        modal.style.display =
            "flex";

    }


    if (campo) {

        campo.focus();

    }

}


function fecharModalSenha() {

    const modal =
        document.getElementById(
            "modal-senha"
        );


    if (modal) {

        modal.style.display =
            "none";

    }


    usuarioAlterarSenhaId =
        null;

}


async function confirmarAlteracaoSenha() {

    if (
        !usuarioAlterarSenhaId
    ) {

        alert(
            "Nenhum usuário selecionado."
        );

        return;

    }


    const campo =
        document.getElementById(
            "senha-alterada"
        );


    if (!campo) {
        return;
    }


    const senha =
        campo.value;


    if (!senha) {

        alert(
            "Digite uma nova senha."
        );

        return;

    }


    if (senha.length < 4) {

        alert(
            "A senha precisa ter pelo menos 4 caracteres."
        );

        return;

    }


    try {

        const resposta =
            await fetch(
                `/api/admin/usuarios/${usuarioAlterarSenhaId}/senha`,
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            senha:
                                senha
                        })

                }
            );


        const dados =
            await resposta.json();


        if (!dados.sucesso) {

            alert(
                dados.mensagem
            );

            return;

        }


        alert(
            "Senha alterada com sucesso!"
        );


        fecharModalSenha();


    } catch (erro) {

        console.error(
            "Erro ao alterar senha:",
            erro
        );

        alert(
            "Erro ao conectar ao servidor."
        );

    }

}


/* =========================
   CRIAR USUÁRIO
========================= */

async function criarUsuario() {

    const campoUsuario =
        document.getElementById(
            "novo-usuario"
        );


    const campoSenha =
        document.getElementById(
            "nova-senha"
        );


    if (
        !campoUsuario ||
        !campoSenha
    ) {

        return;

    }


    const usuario =
        campoUsuario.value.trim();


    const senha =
        campoSenha.value;


    if (
        !usuario ||
        !senha
    ) {

        alert(
            "Preencha usuário e senha."
        );

        return;

    }


    try {

        const resposta =
            await fetch(
                "/api/admin/usuarios",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            usuario:
                                usuario,

                            senha:
                                senha

                        })

                }
            );


        const dados =
            await resposta.json();


        if (!dados.sucesso) {

            alert(
                dados.mensagem
            );

            return;

        }


        alert(
            "Conta criada com sucesso!"
        );


        campoUsuario.value =
            "";


        campoSenha.value =
            "";


        await carregarUsuarios();


    } catch (erro) {

        console.error(
            "Erro ao criar usuário:",
            erro
        );

        alert(
            "Erro ao conectar ao servidor."
        );

    }

}


/* =========================
   EXCLUIR USUÁRIO
========================= */

async function excluirUsuario(id) {

    if (
        !confirm(
            "Tem certeza que deseja excluir este usuário?"
        )
    ) {

        return;

    }


    try {

        const resposta =
            await fetch(
                `/api/admin/usuarios/${id}`,
                {

                    method: "DELETE"

                }
            );


        const dados =
            await resposta.json();


        if (!dados.sucesso) {

            alert(
                dados.mensagem
            );

            return;

        }


        await carregarUsuarios();


        alert(
            "Usuário excluído!"
        );


    } catch (erro) {

        console.error(
            "Erro ao excluir usuário:",
            erro
        );

        alert(
            "Erro ao conectar ao servidor."
        );

    }

}


/* =========================
   LOGOUT
========================= */

async function logout() {

    try {

        const resposta =
            await fetch(
                "/api/logout",
                {

                    method: "POST"

                }
            );


        const dados =
            await resposta.json();


        if (dados.sucesso) {

            window.location.href =
                "/login.html";

        }


    } catch (erro) {

        console.error(
            "Erro ao fazer logout:",
            erro
        );

    }

}


/* =========================
   INICIALIZAÇÃO
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        criarModalEdicao();
        verificarSessao();

    }
);
