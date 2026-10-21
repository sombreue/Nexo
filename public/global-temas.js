(() => {
    const iniciarTemas = () => {
    const temas = [
        { id: "ruby", nome: "Ruby", icone: "◆", cor: "#ef3340", grupo: "Escuros" },
        { id: "ocean", nome: "Ocean", icone: "●", cor: "#2196f3", grupo: "Escuros" },
        { id: "violet", nome: "Violet", icone: "◆", cor: "#9c5cff", grupo: "Escuros" },
        { id: "midnight", nome: "Midnight", icone: "✦", cor: "#6875ff", grupo: "Especiais" },
        { id: "bordeaux", nome: "Bordeaux", icone: "◆", cor: "#9e1638", grupo: "Especiais" },
        { id: "ancient", nome: "Ancient", icone: "◈", cor: "#c9a227", grupo: "Especiais" },
        { id: "forest", nome: "Forest", icone: "❖", cor: "#4caf72", grupo: "Especiais" },
        { id: "sakura", nome: "Sakura", icone: "✿", cor: "#ef78a5", grupo: "Especiais" },
        { id: "arctic", nome: "Arctic", icone: "❄", cor: "#62d9ff", grupo: "Especiais" },
        { id: "turkey", nome: "Turkey", icone: "☾", cor: "#e30a17", grupo: "Especiais" },
        { id: "quarta-feira", nome: "Quarta-feira", icone: "🐸", cor: "#8fe52f", grupo: "Especiais" },
        { id: "segunda-feira", nome: "Segunda-feira", icone: "🐸", cor: "#ff0000", grupo: "Especiais" },
        { id: "ruby-light", nome: "Ruby Light", icone: "◆", cor: "#d92838", grupo: "Claros" },
        { id: "ocean-light", nome: "Ocean Light", icone: "●", cor: "#0878c9", grupo: "Claros" },
        { id: "violet-light", nome: "Violet Light", icone: "◆", cor: "#7c3dcc", grupo: "Claros" },
        { id: "system", nome: "Sistema", icone: "◐", cor: "#888", grupo: "Automático" }
    ];

    if (window.NEXO_SUPER_TEMAS_ENABLED !== false && Array.isArray(window.NEXO_SUPER_TEMAS)) {
        temas.push(...window.NEXO_SUPER_TEMAS);
    }

    window.agendaTemasOficiais = temas;

    const chave = "agenda-auruda-tema";
    let temasPersonalizados = [];
    let temaPersonalizadoAtivo = null;
    const ehQuartaFeira = () => new Date().getDay() === 3;
    const temaSalvoOriginal = localStorage.getItem(chave) || "ruby";
    const temaSalvo = temas.some(t => t.id === temaSalvoOriginal) || temaSalvoOriginal.startsWith("custom-") ? temaSalvoOriginal : "ruby";
    const customSalvo = localStorage.getItem("agenda-auruda-tema-custom");
    const temaInicial = ehQuartaFeira() ? "quarta-feira" : (temas.some(t => t.id === temaSalvo) ? temaSalvo : "ruby");
    document.documentElement.dataset.theme = customSalvo && temaSalvo.startsWith("custom-") ? temaSalvo : temaInicial;

    const linkTemasBase = document.querySelector('link[href*="global-temas-estilos.css"]') || document.createElement("link");
    linkTemasBase.rel = "stylesheet";
    linkTemasBase.href = "global-temas-estilos.css?v=20261021-separacao-super-temas";
    if (!linkTemasBase.parentNode) document.head.appendChild(linkTemasBase);

    const estilo = document.createElement("style");
    estilo.textContent = `
        html[data-theme$="-light"], html[data-theme$="-light"] body { background:var(--theme-bg)!important; color:var(--theme-text)!important; }
        html[data-theme$="-light"] header { background:linear-gradient(180deg,var(--theme-header),var(--theme-header-2))!important; color:var(--theme-text)!important; border-color:var(--theme-border)!important; }
        html[data-theme$="-light"] main,html[data-theme$="-light"] section,html[data-theme$="-light"] .filtro,html[data-theme$="-light"] .painel-admin,html[data-theme$="-light"] .formulario,html[data-theme$="-light"] .tarefa,html[data-theme$="-light"] .conteudo-modal,html[data-theme$="-light"] .contador-feira,html[data-theme$="-light"] .equipe,html[data-theme$="-light"] .card-equipe { color:var(--theme-text)!important; border-color:var(--theme-border)!important; }
        html[data-theme$="-light"] .filtro,html[data-theme$="-light"] .painel-admin,html[data-theme$="-light"] .formulario,html[data-theme$="-light"] .conteudo-modal,html[data-theme$="-light"] .contador-feira,html[data-theme$="-light"] .equipe,html[data-theme$="-light"] .card-equipe { background:var(--theme-surface)!important; }
        html[data-theme$="-light"] .tarefa { background:linear-gradient(145deg,var(--theme-surface-2),var(--theme-surface))!important; }
        html[data-theme$="-light"] input,html[data-theme$="-light"] textarea,html[data-theme$="-light"] select { background:var(--theme-input)!important; color:var(--theme-text)!important; border-color:var(--theme-border)!important; color-scheme:light!important; }
        html[data-theme$="-light"] .dia h2,html[data-theme$="-light"] .tarefa p,html[data-theme$="-light"] .filtro label,html[data-theme$="-light"] .formulario label,html[data-theme$="-light"] #usuario-logado { color:var(--theme-text)!important; }
        html[data-theme$="-light"] #botao-logout,html[data-theme$="-light"] .cancelar,html[data-theme$="-light"] .botao-imagem,html[data-theme$="-light"] .botao-voltar { background:var(--theme-button)!important; color:var(--theme-text)!important; border-color:var(--theme-border)!important; }
        html[data-theme$="-light"] .seletor-tema-botao,html[data-theme$="-light"] .seletor-tema-lista { background:var(--theme-surface)!important; color:var(--theme-text)!important; border-color:var(--theme-border)!important; }
        html[data-theme="quarta-feira"] { --theme-bg:#071006;--theme-surface:#0d1a0a;--theme-surface-2:#13260d;--theme-surface-3:#1a3210;--theme-border:#2e541a;--theme-border-hover:#467b24;--theme-text:#efffe8;--theme-muted:#a8bf96;--theme-accent:#8fe52f;--theme-accent-hover:#adf653;--theme-accent-dark:#4f8f16;--theme-input:#091408;--theme-header:#12250b;--theme-header-2:#091708;--theme-button:#1d3511;--theme-button-hover:#29491a; }
        html[data-theme="quarta-feira"] body::before { content:"";position:fixed;inset:0;pointer-events:none;z-index:-1;opacity:.42;background:radial-gradient(circle at 50% -8%,rgba(143,229,47,.20),transparent 38%),radial-gradient(circle at 15% 75%,rgba(91,181,24,.09),transparent 32%),linear-gradient(135deg,rgba(111,197,24,.025),transparent 42%); }
        html[data-theme="quarta-feira"] header { box-shadow:inset 0 -1px 0 rgba(143,229,47,.22),0 12px 38px rgba(0,0,0,.28); }
        html[data-theme="quarta-feira"] .seletor-tema-botao,html[data-theme="quarta-feira"] .seletor-tema-lista { border-color:#3d6820!important;box-shadow:0 12px 34px rgba(0,0,0,.32),0 0 22px rgba(143,229,47,.06); }
        html[data-theme="quarta-feira"] .logo,html[data-theme="quarta-feira"] .home-logo { object-fit:contain;filter:drop-shadow(0 5px 14px rgba(0,0,0,.32)); }
        html.quarta-feira-forcada .tema-opcao:not([data-tema="quarta-feira"]) { opacity:.45;cursor:not-allowed;pointer-events:none; }
        html.quarta-feira-forcada .seletor-tema-botao { cursor:not-allowed; }
    `;
    document.head.appendChild(estilo);

    function atualizarLogos(id) {
        const logosEspeciais = {
            "quarta-feira": "/imagens/quarta-feira.jpg",
            "segunda-feira": "/imagens/segunda-feira.jpg"
        };
        const logosSuperTemas = window.NEXO_SUPER_TEMA_LOGOS || {};
        const temaCustom = id.startsWith("custom-")
            ? temasPersonalizados.find(t => "custom-" + t.id === id)
            : null;
        const fonte = (temaCustom && temaCustom.logoData) || logosEspeciais[id] || logosSuperTemas[id] || "/imagens/svg-nexo.svg";

        document.querySelectorAll(".logo:not(.tema-logo-personalizada), .home-logo:not(.tema-logo-personalizada), .site-logo:not(.tema-logo-personalizada)").forEach(logo => {
            // SVG inline não possui atributo src; use uma imagem auxiliar sem duplicar a logo visível.
            if (logo instanceof SVGElement) {
                let imagem = logo.parentElement?.querySelector(":scope > .tema-logo-personalizada");
                if (!imagem) {
                    imagem = document.createElement("img");
                    imagem.className = "tema-logo-personalizada " + [...logo.classList].join(" ");
                    imagem.style.display = "none";
                    imagem.alt = "Logo do Nexo";
                    logo.insertAdjacentElement("afterend", imagem);
                }
                imagem.src = fonte;
                imagem.alt = temaCustom?.logoData ? temaCustom.nome : ((logosEspeciais[id] || logosSuperTemas[id]) ? "Logo do tema" : "Logo do Nexo");
                const usarImagem = Boolean(temaCustom?.logoData || logosEspeciais[id] || (logosSuperTemas[id] && logo.classList.contains("home-logo")));
                logo.style.display = usarImagem ? "none" : "";
                imagem.style.display = usarImagem ? "" : "none";
                return;
            }

            if (!logo.dataset.logoOriginal) logo.dataset.logoOriginal = "/imagens/svg-nexo.svg";
            logo.src = fonte;
            logo.alt = temaCustom?.logoData ? temaCustom.nome : ((logosEspeciais[id] || logosSuperTemas[id]) ? "Logo do tema" : "Logo do Nexo");
        });
    }

    function atualizarBloqueioQuarta() {
        document.documentElement.classList.toggle("quarta-feira-forcada", ehQuartaFeira());
    }

    function aplicarTema(id) {
        if(ehQuartaFeira()) id="quarta-feira";
        if(id.startsWith("custom-")) {
            const custom = temasPersonalizados.find(t => "custom-"+t.id === id);
            if(custom) {
                aplicarTemaPersonalizado(custom);
                return;
            }
        }
        if(!temas.some(t=>t.id===id)) return;
        document.documentElement.classList.add("trocando-tema");
        document.documentElement.dataset.theme=id;
        atualizarLogos(id);
        localStorage.setItem(chave,id);
        atualizarBloqueioQuarta();
        document.querySelectorAll(".tema-opcao").forEach(botao=>botao.classList.toggle("ativo",botao.dataset.tema===id));
        const tema=temas.find(t=>t.id===id), nome=document.querySelector(".seletor-tema-nome");
        if(nome&&tema) nome.textContent=tema.nome;
        window.setTimeout(()=>document.documentElement.classList.remove("trocando-tema"),260);
    }

    function aplicarTemaPersonalizado(tema) {
        temaPersonalizadoAtivo = tema;
        const valores = tema.cores.split(",");
        const nomes = ["--theme-bg","--theme-surface","--theme-surface-2","--theme-border","--theme-text","--theme-muted","--theme-accent","--theme-button"];
        nomes.forEach((nome,i)=>document.documentElement.style.setProperty(nome,"#"+valores[i]));
        document.documentElement.style.setProperty("--theme-surface-3","#"+valores[2]);
        document.documentElement.style.setProperty("--theme-border-hover","#"+valores[3]);
        document.documentElement.style.setProperty("--theme-accent-hover","#"+valores[6]);
        document.documentElement.style.setProperty("--theme-accent-dark","#"+valores[6]);
        document.documentElement.style.setProperty("--theme-button-hover","#"+valores[6]);
        document.documentElement.style.setProperty("--theme-input","#"+valores[0]);
        document.documentElement.style.setProperty("--theme-header","#"+valores[1]);
        document.documentElement.style.setProperty("--theme-header-2","#"+valores[0]);
        document.documentElement.dataset.theme = "custom-"+tema.id;
        localStorage.setItem(chave,"custom-"+tema.id);
        localStorage.setItem("agenda-auruda-tema-custom",JSON.stringify(tema));
        atualizarLogos("custom-" + tema.id);
        document.querySelectorAll(".tema-opcao").forEach(botao=>botao.classList.toggle("ativo",botao.dataset.tema==="custom-"+tema.id));
        const nome=document.querySelector(".seletor-tema-nome");
        if(nome) nome.textContent=tema.nome;
    }

    async function carregarTemasPersonalizados() {
        try {
            const resposta = await fetch("/api/temas-personalizados",{credentials:"same-origin",cache:"no-store"});
            if(!resposta.ok) return;
            const dados = await resposta.json();
            temasPersonalizados = dados.temas || [];

            const lista = document.querySelector(".seletor-tema-lista");
            if(!lista) return;

            const titulo=document.createElement("div");
            titulo.className="tema-grupo-titulo";
            titulo.textContent="Meus temas";

            const grade=document.createElement("div");
            grade.className="tema-grupo-grade";

            temasPersonalizados.forEach(tema=>{
                const opcao=document.createElement("button");
                opcao.type="button";
                opcao.className="tema-opcao";
                opcao.dataset.tema="custom-"+tema.id;
                opcao.setAttribute("role","menuitem");
                const cor="#"+tema.cores.split(",")[6];
                opcao.innerHTML=`<span class="tema-bolinha" style="--cor-tema:${cor}"></span><span class="tema-opcao-texto"><span class="tema-opcao-icone">🎨</span></span>`;
                opcao.querySelector(".tema-opcao-texto").append(document.createTextNode(tema.nome));
                opcao.addEventListener("click",()=>{
                    aplicarTemaPersonalizado(tema);
                    lista.hidden=true;
                    document.querySelector(".seletor-tema-botao")?.setAttribute("aria-expanded","false");
                });
                grade.appendChild(opcao);
            });

            const editor=document.createElement("a");
            editor.href="/temas-personalizados.html";
            editor.className="tema-opcao";
            editor.textContent="⚙ Personalizar temas";
            editor.style.textDecoration="none";
            grade.appendChild(editor);

            lista.prepend(grade);
            lista.prepend(titulo);

            const salvo=localStorage.getItem(chave);
            const custom=temasPersonalizados.find(t=>"custom-"+t.id===salvo);
            if(custom) aplicarTemaPersonalizado(custom);
        } catch (erro) {
            console.warn("Não foi possível carregar temas personalizados:",erro);
        }
    }

    function criarSeletor() {
        if(document.querySelector(".seletor-tema")) return;
        const wrapper=document.createElement("div"); wrapper.className="seletor-tema";
        const botao=document.createElement("button"); botao.type="button";botao.className="seletor-tema-botao";botao.setAttribute("aria-expanded","false");botao.setAttribute("aria-label","Escolher tema");
        botao.innerHTML=`<span class="seletor-tema-atual"><span class="seletor-tema-icone">🎨</span><span class="seletor-tema-nome"></span></span><span class="seletor-tema-seta" aria-hidden="true">⌄</span>`;
        const lista=document.createElement("div");lista.className="seletor-tema-lista";lista.hidden=true;lista.setAttribute("role","menu");
        ["Super temas","Automático","Especiais","Escuros","Claros"].forEach(grupo=>{
            const itens=temas.filter(tema=>tema.grupo===grupo); if(!itens.length)return;
            const titulo=document.createElement("div");titulo.className="tema-grupo-titulo";titulo.textContent=grupo;lista.appendChild(titulo);
            const grade=document.createElement("div");grade.className="tema-grupo-grade";
            itens.forEach(tema=>{
                const opcao=document.createElement("button");opcao.type="button";opcao.className="tema-opcao";opcao.dataset.tema=tema.id;opcao.setAttribute("role","menuitem");
                opcao.innerHTML=`<span class="tema-bolinha" style="--cor-tema: ${tema.cor}"></span><span class="tema-opcao-texto"><span class="tema-opcao-icone">${tema.icone}</span>${tema.nome}</span>`;
                opcao.addEventListener("click",()=>{ if(ehQuartaFeira()&&tema.id!=="quarta-feira")return;aplicarTema(tema.id);lista.hidden=true;botao.setAttribute("aria-expanded","false"); });
                grade.appendChild(opcao);
            });
            lista.appendChild(grade);
        });
        botao.addEventListener("click",event=>{
            event.stopPropagation();
            if(ehQuartaFeira()){ aplicarTema("quarta-feira"); return; }
            lista.hidden=!lista.hidden;botao.setAttribute("aria-expanded",String(!lista.hidden));
        });
        document.addEventListener("click",event=>{if(!wrapper.contains(event.target)){lista.hidden=true;botao.setAttribute("aria-expanded","false");}});
        document.addEventListener("keydown",event=>{if(event.key==="Escape"){lista.hidden=true;botao.setAttribute("aria-expanded","false");}});
        wrapper.append(botao,lista);document.body.appendChild(wrapper);aplicarTema(document.documentElement.dataset.theme);
    }

    function verificarQuarta() {
        if(ehQuartaFeira()) aplicarTema("quarta-feira");
        atualizarBloqueioQuarta();
    }

    if(document.readyState==="loading") {
        document.addEventListener("DOMContentLoaded",()=>{ criarSeletor(); carregarTemasPersonalizados(); });
    } else {
        criarSeletor();
        carregarTemasPersonalizados();
    }
    setInterval(verificarQuarta,60000);
    };

    if (window.NEXO_SUPER_TEMAS_ENABLED === false) {
        iniciarTemas();
        return;
    }
    if (Array.isArray(window.NEXO_SUPER_TEMAS)) {
        iniciarTemas();
        return;
    }
    const script = document.createElement("script");
    script.src = "global-super-temas.js?v=20261021";
    script.onload = iniciarTemas;
    script.onerror = () => { console.warn("Temas opcionais não carregados; iniciando apenas com temas base."); iniciarTemas(); };
    document.head.appendChild(script);
})();;
