// Compatibilidade para páginas que precisam do catálogo de matérias.
(() => {
    const padrao = [
        "Ciências", "Matemática", "Português", "Redação", "Bilíngue",
        "Artes", "Robótica", "Ed. Física", "Socioemocional", "Literatura",
        "Gramática", "História", "Química", "Geografia", "Física"
    ];
    window.MATERIAS_AGENDA = padrao.slice();

    // A lista local mantém as páginas funcionais durante a primeira carga.
    // Quando a API responde, o catálogo do banco passa a ser a fonte oficial.
    fetch("/api/materias", { credentials: "same-origin", cache: "no-store" })
        .then(resposta => {
            if (!resposta.ok) throw new Error("Catálogo indisponível");
            return resposta.json();
        })
        .then(dados => {
            if (!dados.sucesso || !Array.isArray(dados.materias)) return;
            window.MATERIAS_AGENDA = dados.materias.map(materia => materia.nome);
            window.dispatchEvent(new CustomEvent("nexo:materias-carregadas", {
                detail: window.MATERIAS_AGENDA.slice()
            }));
        })
        .catch(erro => console.warn("Usando catálogo de matérias de compatibilidade:", erro));
})();
