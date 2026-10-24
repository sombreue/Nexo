let trabalhos = [];
let usuarioSessao = null;

const lista = document.getElementById('listaTrabalhos');
const busca = document.getElementById('busca');
const filtroMateria = document.getElementById('filtroMateria');
const filtroPrioridade = document.getElementById('filtroPrioridade');
const painelAdmin = document.getElementById('painel-trabalhos-admin');
const conteudoAdmin = document.getElementById('conteudo-trabalhos-admin');
const botaoMinAdmin = document.getElementById('botao-minimizar-trabalhos-admin');
const formAdmin = document.getElementById('form-trabalho-admin');
const statusAdmin = document.getElementById('status-admin-trabalhos');
let catalogoMaterias = Array.isArray(window.MATERIAS_AGENDA) ? window.MATERIAS_AGENDA.slice() : [];
window.addEventListener('nexo:materias-carregadas', evento => {
    catalogoMaterias = Array.isArray(evento.detail) ? evento.detail.slice() : [];
    atualizarMaterias();
});

function formatarData(data){
    if(!data) return 'Sem prazo';
    return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
}

function calcularPrioridade(prazo){
    if(!prazo) return {nivel:'minima', nome:'Sem prazo', dias:null, classe:'prioridade-minima'};
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const entrega = new Date(`${prazo}T00:00:00`);
    const dias = Math.ceil((entrega - hoje) / 86400000);
    if(dias < 1) return {nivel:'atrasado', nome:'Atrasado', dias, classe:'prioridade-atrasado'};
    if(dias <= 4) return {nivel:'maxima', nome:'Prioridade máxima', dias, classe:'prioridade-maxima'};
    if(dias <= 9) return {nivel:'media', nome:'Prioridade média', dias, classe:'prioridade-media'};
    return {nivel:'minima', nome:'Prioridade mínima', dias, classe:'prioridade-minima'};
}

function textoPrazo(prazo){
    const p = calcularPrioridade(prazo);
    if(p.dias === null) return 'Sem prazo definido';
    if(p.dias < 0) return `Atrasado há ${Math.abs(p.dias)} ${Math.abs(p.dias) === 1 ? 'dia' : 'dias'}`;
    if(p.dias === 0) return 'Entrega hoje';
    if(p.dias === 1) return 'Falta 1 dia';
    return `Faltam ${p.dias} dias`;
}

function renderizarMarkdown(valor){
    const texto = String(valor ?? '');
    if (!texto.trim()) return '';
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') return escaparHtml(texto).replace(/\n/g, '<br>');
    const html = marked.parse(texto, { breaks: true, gfm: true });
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p','br','strong','em','del','s','h1','h2','h3','h4','blockquote','ul','ol','li','a','code','pre','hr'],
        ALLOWED_ATTR: ['href','target','rel']
    });
}

function escaparHtml(valor){
    return String(valor ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
}

async function lerRespostaJson(resposta, mensagemPadrao){
    const tipo = resposta.headers.get('content-type') || '';
    const texto = await resposta.text();
    if(!tipo.toLowerCase().includes('application/json')) throw new Error('A API não retornou JSON.');
    let dados;
    try{ dados = JSON.parse(texto); }catch{ throw new Error('O servidor retornou uma resposta inválida.'); }
    if(!resposta.ok || dados.sucesso === false) throw new Error(dados.mensagem || mensagemPadrao);
    return dados;
}

function preencherCatalogoMaterias(valorAtual=''){
    const select = document.getElementById('admin-materia');
    if(!select) return;
    const existentes = [...select.options].map(o => o.value).filter(Boolean);
    const materias = [...catalogoMaterias];
    if(valorAtual && !materias.includes(valorAtual)) materias.push(valorAtual);
    select.innerHTML = '<option value="">Selecione a matéria</option>' + materias.map(m => `<option value="${escaparHtml(m)}">${escaparHtml(m)}</option>`).join('');
    if(valorAtual) select.value = valorAtual;
}

function atualizarMaterias(){
    const atual = filtroMateria.value;
    const materiasDosTrabalhos = trabalhos.map(t => t.materia).filter(Boolean);
    const materias = [...new Set([...catalogoMaterias, ...materiasDosTrabalhos])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    filtroMateria.innerHTML = '<option value="">Todas as matérias</option>';
    materias.forEach(materia => {
        const option = document.createElement('option');
        option.value = materia;
        option.textContent = materia;
        filtroMateria.appendChild(option);
    });
    if(materias.includes(atual)) filtroMateria.value = atual;
}

function podeGerenciarTrabalhos(){
    return usuarioSessao && ['admin', 'representante'].includes(String(usuarioSessao.tipo || '').toLowerCase());
}

async function carregarTurmasTrabalho(){
    const select = document.getElementById('turma-trabalho-admin');
    const label = document.getElementById('label-turma-trabalho-admin');
    if(!select || !label) return;
    const ehAdminGlobal = usuarioSessao?.tipo === 'admin';
    select.hidden = !ehAdminGlobal;
    label.hidden = !ehAdminGlobal;
    select.required = ehAdminGlobal;
    if(!ehAdminGlobal) { select.innerHTML = '<option value="">Turma vinculada à conta</option>'; return; }
    try {
        const resposta = await fetch('/api/turmas', {cache:'no-store', credentials:'same-origin'});
        const dados = await lerRespostaJson(resposta, 'Não foi possível carregar turmas.');
        const turmas = dados.turmas.filter(t => t.ativa);
        select.innerHTML = turmas.map(t => '<option value="' + escaparHtml(t.id) + '">' + escaparHtml(t.nome) + (t.anoLetivo ? ' · ' + escaparHtml(t.anoLetivo) : '') + '</option>').join('');
        if(!turmas.length) select.innerHTML = '<option value="">Nenhuma turma ativa</option>';
    } catch(e) {
        select.innerHTML = '<option value="">Erro ao carregar turmas</option>';
        statusAdmin.textContent = e.message;
    }
}

function ativarPainelAdmin(){
    if(!podeGerenciarTrabalhos()) return;
    painelAdmin.hidden = false;
    painelAdmin.removeAttribute('hidden');
    preencherCatalogoMaterias();
    preencherFormulario(null);
}

function renderizar(){
    const termo = busca.value.trim().toLowerCase();
    const materia = filtroMateria.value;
    const prioridadeFiltro = filtroPrioridade.value;
    const filtrados = trabalhos.filter(t => {
        const texto = `${t.titulo} ${t.materia} ${t.descricao || ''}`.toLowerCase();
        const prioridade = calcularPrioridade(t.prazo);
        return (!termo || texto.includes(termo)) && (!materia || t.materia === materia) && (!prioridadeFiltro || prioridade.nivel === prioridadeFiltro);
    });

    document.getElementById('total').textContent = trabalhos.length;
    document.getElementById('pendentes').textContent = trabalhos.filter(t => calcularPrioridade(t.prazo).nivel !== 'atrasado').length;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    document.getElementById('proximos').textContent = trabalhos.filter(t => t.prazo && new Date(`${t.prazo}T12:00:00`) >= hoje).length;

    if(!filtrados.length){ lista.innerHTML = '<div class="vazio">Nenhum trabalho encontrado com esses filtros.</div>'; return; }

    lista.innerHTML = filtrados.map(t => {
        const prioridade = calcularPrioridade(t.prazo);
        const valePonto = t.vale_ponto !== false;
        const controles = podeGerenciarTrabalhos() ? `<div class="controles-trabalho"><button type="button" data-editar="${t.id}">Editar</button><button type="button" class="excluir" data-excluir="${t.id}">Excluir</button></div>` : '';
        return `<article id="trabalho-${t.id}" class="trabalho">
            <div class="trabalho-topo"><div><div class="materia">${escaparHtml(t.materia)}</div><h2>${escaparHtml(t.titulo)}</h2></div><span class="prioridade ${prioridade.classe}">${prioridade.nome}</span></div>
            <div class="descricao markdown-conteudo">${renderizarMarkdown(t.descricao || '')}</div>
            <div class="meta"><span class="tag">Prazo: ${formatarData(t.prazo)}</span><span class="tag">${textoPrazo(t.prazo)}</span>${valePonto ? '<span class="tag">Vale ponto</span>' : ''}</div>
            ${controles}
        </article>`;
    }).join('');
}

async function carregarTrabalhos(){
    try{ const resposta = await fetch('/api/trabalhos', {cache:'no-store'}); const dados = await lerRespostaJson(resposta, 'Falha ao carregar trabalhos.'); trabalhos = dados.trabalhos || []; atualizarMaterias(); renderizar(); }
    catch(erro){ console.error(erro); lista.innerHTML = `<div class="vazio">${escaparHtml(erro.message || 'Não foi possível carregar os trabalhos.')}</div>`; }
}

function preencherFormulario(trabalho){
    document.getElementById('trabalho-id').value = trabalho?.id || '';
    document.getElementById('admin-titulo').value = trabalho?.titulo || '';
    preencherCatalogoMaterias(trabalho?.materia || '');
    document.getElementById('admin-prazo').value = trabalho?.prazo || '';
    document.getElementById('admin-descricao').value = trabalho?.descricao || '';
    document.getElementById('admin-vale-ponto').checked = trabalho?.vale_ponto !== false;
    document.getElementById('botao-salvar-trabalho').textContent = trabalho ? 'Salvar alterações' : 'Criar trabalho';
    document.getElementById('botao-cancelar-trabalho').hidden = !trabalho;
}

formAdmin.addEventListener('submit', async evento => {
    evento.preventDefault();
    const id = document.getElementById('trabalho-id').value;
    const payload = {
        titulo: document.getElementById('admin-titulo').value.trim(),
        materia: document.getElementById('admin-materia').value,
        prazo: document.getElementById('admin-prazo').value,
        descricao: document.getElementById('admin-descricao').value.trim(),
        vale_ponto: document.getElementById('admin-vale-ponto').checked,
        turmaId: document.getElementById('trabalho-id').value ? null : (document.getElementById('turma-trabalho-admin')?.value || null),
        status: 'pendente'
    };
    statusAdmin.textContent = id ? 'Salvando...' : 'Criando...';
    try{
        const resposta = await fetch(id ? `/api/trabalhos/${id}` : '/api/trabalhos', {
            method: id ? 'PUT' : 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        await lerRespostaJson(resposta,'Não foi possível salvar.');
        statusAdmin.textContent = id ? 'Trabalho atualizado.' : 'Trabalho criado.';
        preencherFormulario(null);
        await carregarTrabalhos();
    }catch(erro){ statusAdmin.textContent = erro.message; }
});

document.getElementById('botao-cancelar-trabalho').addEventListener('click',()=>{preencherFormulario(null);statusAdmin.textContent='';});

lista.addEventListener('click',async evento=>{
    const editar=evento.target.closest('[data-editar]'); const excluir=evento.target.closest('[data-excluir]');
    if(editar){const trabalho=trabalhos.find(t=>String(t.id)===editar.dataset.editar);if(trabalho){preencherFormulario(trabalho);painelAdmin.scrollIntoView({behavior:'smooth',block:'start'});}}
    if(excluir){const id=excluir.dataset.excluir;if(!confirm('Tem certeza que deseja excluir este trabalho?'))return;try{await lerRespostaJson(await fetch(`/api/trabalhos/${id}`,{method:'DELETE'}),'Não foi possível excluir.');statusAdmin.textContent='Trabalho excluído.';await carregarTrabalhos();}catch(erro){statusAdmin.textContent=erro.message;}}
});

botaoMinAdmin.addEventListener('click',()=>{const minimizado=conteudoAdmin.hidden;conteudoAdmin.hidden=!minimizado;botaoMinAdmin.textContent=minimizado?'−':'+';botaoMinAdmin.setAttribute('aria-expanded',String(minimizado));});
[busca,filtroMateria,filtroPrioridade].forEach(el=>el.addEventListener('input',renderizar));

async function inicializar(){
    try{
        const resposta = await fetch('/api/sessao', {cache:'no-store', credentials:'same-origin'});
        const texto = await resposta.text();
        const sessao = JSON.parse(texto);
        if(sessao.logado && sessao.usuario){
            usuarioSessao = sessao.usuario;
        } else if(sessao.logado && sessao.tipo){
            usuarioSessao = {tipo:sessao.tipo};
        }
    }catch(erro){
        console.error('Falha ao consultar /api/sessao:', erro);
        usuarioSessao = null;
    }

    if(!podeGerenciarTrabalhos()){
        try{
            const resposta = await fetch('/api/usuario', {cache:'no-store', credentials:'same-origin'});
            if(resposta.ok){
                const dados = await resposta.json();
                if(dados.usuario) usuarioSessao = dados.usuario;
            }
        }catch(erro){ console.error('Falha ao consultar /api/usuario:', erro); }
    }

    if(podeGerenciarTrabalhos()) { await carregarTurmasTrabalho(); ativarPainelAdmin(); }
    else preencherCatalogoMaterias();
    renderizar();
    await carregarTrabalhos();
    abrirTrabalhoPeloHash();
}

function abrirTrabalhoPeloHash() {
    const hash = window.location.hash;
    if (!hash.startsWith("#trabalho-")) return;

    const id = decodeURIComponent(hash.slice("#trabalho-".length));
    const trabalho = document.getElementById(`trabalho-${id}`);
    if (!trabalho) return;

    requestAnimationFrame(() => {
        setTimeout(() => {
            trabalho.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            trabalho.classList.remove("trabalho-destacado");
            void trabalho.offsetWidth;
            trabalho.classList.add("trabalho-destacado");

            setTimeout(() => {
                trabalho.classList.remove("trabalho-destacado");
            }, 2200);
        }, 80);
    });
}

window.addEventListener("hashchange", abrirTrabalhoPeloHash);

inicializar();
