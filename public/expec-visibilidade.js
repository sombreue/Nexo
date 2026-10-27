(() => {
    const links = document.querySelectorAll("[data-expec-link]");
    if (!links.length) return;

    fetch("/api/usuario", { credentials: "same-origin", cache: "no-store" })
        .then(resposta => resposta.ok ? resposta.json() : null)
        .then(async sessao => {
            if (!sessao?.sucesso) return null;
            if (sessao.usuario?.tipo === "admin") return true;
            const resposta = await fetch("/api/feira/status", { credentials: "same-origin", cache: "no-store" });
            const dados = resposta.ok ? await resposta.json() : null;
            return Boolean(dados?.sucesso && dados.ativa);
        })
        .then(visivel => {
            if (visivel) links.forEach(link => { link.hidden = false; });
        })
        .catch(erro => console.error("Não foi possível carregar a visibilidade da EXPEC:", erro));
})();
