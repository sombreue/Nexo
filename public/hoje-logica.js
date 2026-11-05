function dataLocalHoje(){
  const d=new Date();
  d.setHours(0,0,0,0);
  return d;
}
function dataISO(d){
  return d.toISOString().slice(0,10);
}
function formatarData(data){
  return new Date(data+"T12:00:00").toLocaleDateString("pt-BR");
}
function criarCardTarefa(t){
  const el=document.createElement("article");
  el.className="hoje-card";
  el.tabIndex=0;
  el.setAttribute("role","link");
  el.addEventListener("click",()=>{ window.location.href=`/agenda.html#tarefa-${encodeURIComponent(t.id)}`; });
  el.innerHTML="<label class=\"tarefa-feito\"><input type=\"checkbox\"><span>Feito</span></label><div class=\"materia\"></div><h3></h3><p></p><small></small>";
  const checkbox=el.querySelector('input');checkbox.checked=Boolean(t.feito);
  el.classList.toggle('tarefa-concluida',checkbox.checked);
  checkbox.addEventListener('click',e=>e.stopPropagation());
  checkbox.addEventListener('change',async e=>{e.stopPropagation();checkbox.disabled=true;try{const r=await fetch(`/api/tarefas/${encodeURIComponent(t.id)}/feito`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({feito:checkbox.checked})});if(!r.ok)throw new Error();el.classList.toggle('tarefa-concluida',checkbox.checked);}catch{checkbox.checked=!checkbox.checked;}finally{checkbox.disabled=false;}});
  el.querySelector(".materia").textContent=t.materia;
  el.querySelector("h3").textContent="Entrega amanhã";
  el.querySelector("p").textContent=t.descricao;
  el.querySelector("p").style.whiteSpace="pre-line";
  el.querySelector("small").textContent="Prazo: "+formatarData(t.dataEntrega);
  return el;
}
function criarCardTrabalho(t){
  const el=document.createElement("article");
  el.className="trabalho-hoje";
  el.tabIndex=0;
  el.setAttribute("role","link");
  el.addEventListener("click",()=>{ window.location.href=`/trabalhos.html#trabalho-${encodeURIComponent(t.id)}`; });
  el.innerHTML="<div class=\"materia\"></div><h3></h3><p></p><small></small>";
  el.querySelector(".materia").textContent=t.materia||"Trabalho";
  el.querySelector("h3").textContent=t.titulo||"Sem título";
  el.querySelector("p").textContent=t.descricao||"";
  el.querySelector("p").style.whiteSpace="pre-line";
  el.querySelector("small").textContent=t.prazo?"Prazo: "+formatarData(t.prazo):"Sem prazo";
  return el;
}
async function carregarHoje(){
  const listaTarefas=document.getElementById("tarefas-amanha");
  const listaTrabalhos=document.getElementById("trabalhos-proximos");
  try{
    const [rt,rw]=await Promise.all([
      fetch("/api/tarefas",{cache:"no-store",credentials:"same-origin"}),
      fetch("/api/trabalhos",{cache:"no-store",credentials:"same-origin"})
    ]);
    const tarefas=rt.ok?(await rt.json()).tarefas||[]:[];
    const trabalhos=rw.ok?(await rw.json()).trabalhos||[]:[];
    const hoje=dataLocalHoje();
    const amanha=new Date(hoje);
    amanha.setDate(amanha.getDate()+1);
    const isoAmanha=dataISO(amanha);
    const imediatas=tarefas.filter(t=>String(t.descricao||"").trim() && t.dataEntrega===isoAmanha)
      .sort((a,b)=>(a.id||0)-(b.id||0));
    listaTarefas.innerHTML="";
    if(!imediatas.length) listaTarefas.innerHTML='<div class="hoje-vazio">Nenhuma tarefa de casa para entregar amanhã.</div>';
    else imediatas.forEach(t=>listaTarefas.appendChild(criarCardTarefa(t)));
    const limite=new Date(hoje);
    limite.setDate(limite.getDate()+7);
    const proximos=trabalhos.filter(t=>{
      if(!t.prazo)return false;
      const p=new Date(t.prazo+"T12:00:00");
      return p>=hoje && p<=limite;
    }).sort((a,b)=>String(a.prazo).localeCompare(String(b.prazo)));
    listaTrabalhos.innerHTML="";
    if(!proximos.length) listaTrabalhos.innerHTML='<div class="hoje-vazio">Nenhum trabalho ou pesquisa com prazo próximo.</div>';
    else proximos.forEach(t=>listaTrabalhos.appendChild(criarCardTrabalho(t)));
  }catch(erro){
    console.error("Erro ao carregar Hoje:",erro);
    listaTarefas.innerHTML='<div class="hoje-vazio">Não foi possível carregar as tarefas.</div>';
    listaTrabalhos.innerHTML='<div class="hoje-vazio">Não foi possível carregar os trabalhos e pesquisas.</div>';
  }
}
carregarHoje();
