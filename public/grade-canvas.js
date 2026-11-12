/* Renderiza tabelas em canvas sem depender do parser de cores do html2canvas. */
(function () {
    "use strict";

    window.NexoGradeCanvas = {
        criar(tabela, dados, escala = 2) {
            const linhasDOM = Array.from(tabela.rows);
            if (!linhasDOM.length || !dados.length) throw new Error("A tabela está vazia.");
            const larguras = Array.from(linhasDOM[0].cells, celula => celula.offsetWidth || 120);
            const alturas = linhasDOM.map(linha => linha.offsetHeight || 40);
            const largura = larguras.reduce((soma, valor) => soma + valor, 0);
            const altura = alturas.reduce((soma, valor) => soma + valor, 0);
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(largura * escala);
            canvas.height = Math.ceil(altura * escala);
            const ctx = canvas.getContext("2d");
            ctx.scale(escala, escala);
            const transparente = cor => !cor || cor === "transparent" || /rgba\([^)]*,\s*0\s*\)$/.test(cor);
            const fundoTabela = getComputedStyle(tabela).backgroundColor;
            const fundoPagina = getComputedStyle(document.body).backgroundColor;
            ctx.fillStyle = "#ffffff";
            if (!transparente(fundoPagina)) ctx.fillStyle = fundoPagina;
            if (!transparente(fundoTabela)) ctx.fillStyle = fundoTabela;
            ctx.fillRect(0, 0, largura, altura);

            let y = 0;
            dados.forEach((linha, i) => {
                let x = 0;
                linha.forEach((valor, j) => {
                    const celula = linhasDOM[i]?.cells[j];
                    const estilo = celula && getComputedStyle(celula);
                    const conteudo = celula?.querySelector("input") || celula;
                    const estiloTexto = conteudo && getComputedStyle(conteudo);
                    const w = larguras[j] || 120, h = alturas[i] || 40;
                    if (!transparente(estilo?.backgroundColor)) {
                        ctx.fillStyle = "#ffffff";
                        ctx.fillStyle = estilo.backgroundColor;
                        ctx.fillRect(x, y, w, h);
                    }
                    ctx.strokeStyle = "#d1d5db";
                    if (estilo?.borderColor) ctx.strokeStyle = estilo.borderColor;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
                    ctx.fillStyle = "#111827";
                    if (estiloTexto?.color) ctx.fillStyle = estiloTexto.color;
                    ctx.font = estiloTexto?.font || (i === 0 ? "700 14px sans-serif" : "14px sans-serif");
                    ctx.textBaseline = "middle";
                    ctx.textAlign = estilo?.textAlign === "center" ? "center" : "left";
                    const padding = 9;
                    const textX = ctx.textAlign === "center" ? x + w / 2 : x + padding;
                    ctx.save();
                    ctx.beginPath(); ctx.rect(x + 2, y + 1, w - 4, h - 2); ctx.clip();
                    ctx.fillText(String(valor ?? ""), textX, y + h / 2);
                    ctx.restore();
                    x += w;
                });
                y += alturas[i] || 40;
            });
            return canvas;
        }
    };
})();
