(() => {
    const CORES = [
        ["bg","Fundo principal"],["surface","Cartões / superfícies"],["surface2","Superfícies secundárias"],
        ["border","Bordas"],["text","Texto principal"],["muted","Texto secundário"],
        ["accent","Cor de destaque"],["button","Botões"]
    ];
    const PADRAO = ["0d0d0f","151518","1b1b20","2c2c34","f5f5f5","a4a4ad","ef3340","29292f"];
    const chaveAtiva = "agenda-auruda-tema";
    let temas = [];
    let logoAtual = null;

    const $ = id => document.getElementById(id);
    const coresGrid = $("cores-grid");

    CORES.forEach(([id,nome],i) => {
        const item=document.createElement("div");
        item.className="cor-item";
        item.innerHTML=`<label for="cor-${id}">${nome}</label><input id="cor-${id}" type="color" value="#${PADRAO[i]}" data-cor="${id}">`;
        coresGrid.appendChild(item);
    });

    function valoresCores() {
        return CORES.map(([id]) => $(`cor-${id}`).value.slice(1).toLowerCase()).join(",");
    }

    function aplicarPreview() {
        const p=$("preview-site");
        const v=CORES.map(([id])=>$(`cor-${id}`).value);
        const vars=["--theme-bg","--theme-surface","--theme-surface-2","--theme-border","--theme-text","--theme-muted","--theme-accent","--theme-button"];
        vars.forEach((nome,i)=>p.style.setProperty(nome,v[i]));
        p.style.setProperty("--theme-header",v[1]);
        p.style.setProperty("--theme-header-2",v[0]);
        p.style.setProperty("--theme-input",v[0]);
        $("preview-logo").src=logoAtual || "/imagens/svg-nexo.svg";
    }

    function carregarEditor(tema=null) {
        $("tema-id").value=tema?.id || "";
        $("tema-nome").value=tema?.nome || "";
        const valores=(tema?.cores || PADRAO.join(",")).split(",");
        CORES.forEach(([id],i)=>$(`cor-${id}`).value="#"+(valores[i] || PADRAO[i]));
        logoAtual=tema?.logoData || null;
        $("logo-preview").src=logoAtual || "";
        $("titulo-editor").textContent=tema ? "Editar tema" : "Criar tema";
        $("botao-excluir").hidden=!tema;
        $("status-editor").textContent="";
        aplicarPreview();
    }

    function clonarTemaOficial(id) {
        if (temas.length >= 3) return flash("Você já atingiu o limite de 3 temas.", true);
        const oficial = window.agendaTemasOficiais?.find(t => t.id === id);
        if (!oficial) return flash("Tema oficial não encontrado.", true);

        const anterior = document.documentElement.dataset.theme;
        const customAnterior = localStorage.getItem("agenda-auruda-tema-custom");
        const customObj = customAnterior ? JSON.parse(customAnterior) : null;

        document.documentElement.dataset.theme = oficial.id;
        const estilo = getComputedStyle(document.documentElement);
        const nomes = ["--theme-bg","--theme-surface","--theme-surface-2","--theme-border","--theme-text","--theme-muted","--theme-accent","--theme-button"];
        const cores = nomes.map(n => (estilo.getPropertyValue(n).trim() || "#000000").replace("#","").slice(0,6)).join(",");

        if (anterior?.startsWith("custom-") && customObj) aplicarTemaCustom(customObj);
        else if (anterior) document.documentElement.dataset.theme = anterior;

        carregarEditor({nome: oficial.nome + " — cópia", cores, logoData: null});
        $("tema-id").value = "";
        flash("Tema clonado. Você pode editar a cópia antes de salvar.");
        $("tema-nome").focus();
    }

    function renderTemasOficiais() {
        const area = document.createElement("div");
        area.className = "temas-oficiais";
        area.innerHTML = '<div class="lista-cabecalho"><h2>Clonar tema do site</h2><span>Use um tema oficial como ponto de partida.</span></div><div class="grade-oficiais"></div>';
        const grade = area.querySelector(".grade-oficiais");
        (window.agendaTemasOficiais || []).forEach(tema => {
            const botao=document.createElement("button");
            botao.type="button";
            botao.className="oficial-card";
            botao.innerHTML=`<span class="tema-salvo-cor" style="background:${tema.cor}"></span><span><strong></strong><small>${tema.grupo}</small></span><b>Clonar</b>`;
            botao.querySelector("strong").textContent=tema.nome;
            botao.onclick=()=>clonarTemaOficial(tema.id);
            grade.appendChild(botao);
        });
        document.querySelector(".lista-meus-temas").prepend(area);
    }

    function flash(mensagem,erro=false) {
        $("status-editor").textContent=mensagem;
        $("status-editor").style.color=erro ? "#ff6b6b" : "var(--theme-accent)";
    }

    async function carregarTemas() {
        try {
            const r=await fetch("/api/temas-personalizados",{credentials:"same-origin",cache:"no-store"});
            if(r.status===401){location.href="/login.html";return;}
            const d=await r.json();
            if(!r.ok || !d.sucesso) throw new Error(d.mensagem);
            temas=d.temas || [];
            $("contador-temas").textContent=`${temas.length}/${d.limite} temas`;
            $("lista-vazia").hidden=temas.length>0;
            $("lista-temas").innerHTML="";
            temas.forEach(tema=>{
                const cor="#"+tema.cores.split(",")[6];
                const el=document.createElement("div");
                el.className="tema-salvo";
                el.innerHTML=`<span class="tema-salvo-cor" style="background:${cor}"></span><div class="tema-salvo-info"><strong></strong><small>Personalizado</small></div><div class="tema-salvo-acoes"><button class="usar">Usar</button><button class="editar">Editar</button><button class="excluir">Excluir</button></div>`;
                el.querySelector("strong").textContent=tema.nome;
                el.querySelector(".usar").onclick=()=>usarTema(tema);
                el.querySelector(".editar").onclick=()=>carregarEditor(tema);
                el.querySelector(".excluir").onclick=()=>excluirTema(tema.id);
                $("lista-temas").appendChild(el);
            });
        } catch(e) { flash(e.message || "Não foi possível carregar seus temas.",true); }
    }

    function usarTema(tema) {
        localStorage.setItem(chaveAtiva,"custom-"+tema.id);
        localStorage.setItem("agenda-auruda-tema-custom",JSON.stringify(tema));
        aplicarTemaCustom(tema);
        flash("Tema aplicado neste dispositivo.");
    }

    function aplicarTemaCustom(tema) {
        const valores=tema.cores.split(",");
        const nomes=["--theme-bg","--theme-surface","--theme-surface-2","--theme-border","--theme-text","--theme-muted","--theme-accent","--theme-button"];
        nomes.forEach((nome,i)=>document.documentElement.style.setProperty(nome,"#"+valores[i]));
        document.documentElement.style.setProperty("--theme-surface-3","#"+valores[2]);
        document.documentElement.style.setProperty("--theme-border-hover","#"+valores[3]);
        document.documentElement.style.setProperty("--theme-accent-hover","#"+valores[6]);
        document.documentElement.style.setProperty("--theme-accent-dark","#"+valores[6]);
        document.documentElement.style.setProperty("--theme-button-hover","#"+valores[6]);
        document.documentElement.style.setProperty("--theme-input","#"+valores[0]);
        document.documentElement.style.setProperty("--theme-header","#"+valores[1]);
        document.documentElement.style.setProperty("--theme-header-2","#"+valores[0]);
        document.querySelectorAll(".home-logo,.logo").forEach(img=>{
            if(tema.logoData){img.src=tema.logoData;img.style.objectFit="contain";}
        });
        document.documentElement.dataset.theme="custom-"+tema.id;
    }

    async function salvar(event) {
        event.preventDefault();
        const nome=$("tema-nome").value.trim();
        if(!nome) return flash("Dê um nome ao tema.",true);
        const id=$("tema-id").value;
        const body={nome,cores:valoresCores(),logoData:logoAtual};
        $("botao-salvar").disabled=true;
        try {
            const r=await fetch(id ? `/api/temas-personalizados/${id}` : "/api/temas-personalizados",{
                method:id?"PUT":"POST",credentials:"same-origin",
                headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
            });
            const d=await r.json();
            if(!r.ok || !d.sucesso) throw new Error(d.mensagem || "Não foi possível salvar.");
            const tema=d.tema;
            usarTema(tema);
            await carregarTemas();
            carregarEditor(tema);
            flash("Tema salvo e aplicado.");
        } catch(e){flash(e.message,true);}
        finally{$("botao-salvar").disabled=false;}
    }

    async function excluirTema(id) {
        if(!confirm("Excluir este tema personalizado?")) return;
        try {
            const r=await fetch(`/api/temas-personalizados/${id}`,{method:"DELETE",credentials:"same-origin"});
            const d=await r.json();
            if(!r.ok || !d.sucesso) throw new Error(d.mensagem);
            if(localStorage.getItem(chaveAtiva)==="custom-"+id){
                localStorage.removeItem(chaveAtiva);
                localStorage.removeItem("agenda-auruda-tema-custom");
                location.reload();
                return;
            }
            carregarEditor();
            await carregarTemas();
            flash("Tema excluído.");
        } catch(e){flash(e.message || "Erro ao excluir.",true);}
    }

    function lerLogo(file) {
        if(!file) return;
        if(file.size>8*1024*1024) return flash("Escolha uma imagem de até 8 MB para processar.",true);
        const img=new Image();
        const reader=new FileReader();
        reader.onload=()=>{img.onload=()=>{
            const max=512,escala=Math.min(1,max/Math.max(img.width,img.height));
            const canvas=document.createElement("canvas");
            canvas.width=Math.max(1,Math.round(img.width*escala));
            canvas.height=Math.max(1,Math.round(img.height*escala));
            const ctx=canvas.getContext("2d");
            ctx.drawImage(img,0,0,canvas.width,canvas.height);
            let qualidade=.82, data=canvas.toDataURL("image/webp",qualidade);
            while(data.length>175000 && qualidade>.45){qualidade-=.07;data=canvas.toDataURL("image/webp",qualidade);}
            if(data.length>180000) return flash("Essa imagem não pôde ser compactada o suficiente. Escolha outra.",true);
            logoAtual=data;
            $("logo-preview").src=data;
            aplicarPreview();
            flash("Logo pronta para salvar.");
        };img.src=reader.result;};
        reader.readAsDataURL(file);
    }

    const dropzone = document.querySelector(".logo-upload-preview");

    $("logo-input").addEventListener("change",e=>lerLogo(e.target.files[0]));
    ["dragenter","dragover"].forEach(evento=>dropzone.addEventListener(evento,e=>{
        e.preventDefault(); e.stopPropagation(); dropzone.classList.add("arrastando");
    }));
    ["dragleave","drop"].forEach(evento=>dropzone.addEventListener(evento,e=>{
        e.preventDefault(); e.stopPropagation(); dropzone.classList.remove("arrastando");
    }));
    dropzone.addEventListener("drop",e=>{
        const arquivo=e.dataTransfer.files?.[0];
        if(arquivo && ["image/png","image/jpeg","image/webp"].includes(arquivo.type)) lerLogo(arquivo);
        else flash("Solte uma imagem PNG, JPG ou WebP.",true);
    });
    dropzone.addEventListener("click",()=>$("logo-input").click());
    $("remover-logo").onclick=()=>{logoAtual=null;$("logo-preview").src="";aplicarPreview();};
    $("form-tema").addEventListener("submit",salvar);
    $("botao-novo").onclick=()=>carregarEditor();
    CORES.forEach(([id])=>$(`cor-${id}`).addEventListener("input",aplicarPreview));

    async function iniciar() {
        const r=await fetch("/api/usuario",{credentials:"same-origin",cache:"no-store"});
        if(!r.ok){location.href="/login.html";return;}
        carregarEditor();
        renderTemasOficiais();
        await carregarTemas();
    }
    iniciar();
})();