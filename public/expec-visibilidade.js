(() => {
    const links = document.querySelectorAll("[data-expec-link]");
    if (!links.length) return;

    fetch("/api/usuario", { credentials: "same-origin", cache: "no-store" })
        .then(resposta => resposta.ok ? resposta.json() : null)
        .then(async sessao => {
            if (!sessao?.sucesso) return null;
            if (sessao.usuario?.tipo === "admin") {
                const resposta = await fetch("/api/turmas", { credentials: "same-origin", cache: "no-store" });
                const dados = resposta.ok ? await resposta.json() : null;
                if (!dados?.sucesso || !Array.isArray(dados.turmas)) return null;

                const turmasVisiveis = dados.turmas.filter(turma => turma.ativa && turma.expecVisivel);
                const turmaSolicitada = new URLSearchParams(window.location.search).get("turmaId");
                const turma = turmaSolicitada
                    ? turmasVisiveis.find(item => String(item.id) === turmaSolicitada)
                    : turmasVisiveis[0];
                if (!turma) return false;
                links.forEach(link => { link.href = `/expec.html?turmaId=${encodeURIComponent(turma.id)}`; });
                return true;
            }
            const resposta = await fetch("/api/feira/status", { credentials: "same-origin", cache: "no-store" });
            const dados = resposta.ok ? await resposta.json() : null;
            return Boolean(dados?.sucesso && dados.ativa);
        })
        .then(visivel => {
            if (visivel) links.forEach(link => { link.hidden = false; });
        })
        .catch(erro => console.error("Não foi possível carregar a visibilidade da EXPEC:", erro));
})();
