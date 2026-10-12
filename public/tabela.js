const $=id=>document.getElementById(id);
const estado={id:null,nome:"",colunas:[],linhas:[],timer:null,salvando:false,pendente:false,carregado:false};
async function api(url,opcoes={}){const r=await fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json"},...opcoes});const d=await r.json().catch(()=>({}));if(!r.ok||d.sucesso===false){if(r.status===401)location.href="/login.html";throw new Error(d.mensagem||"Falha na comunicação com o servidor.");}return d;}
function escapar(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function mostrarErro(m){$("erroEditor").textContent=m;$("erroEditor").hidden=false;}
function limparErro(){$("erroEditor").hidden=true;$("erroEditor").textContent="";}
function renderizar(){const h=$("tabelaDados").querySelector("thead"),b=$("tabelaDados").querySelector("tbody");h.innerHTML="<tr><th>#</th>"+estado.colunas.map((c,i)=>'<th><input maxlength="100" aria-label="Nome da coluna '+(i+1)+'" data-coluna="'+i+'" value="'+escapar(c)+'"></th>').join("")+"</tr>";b.innerHTML=estado.linhas.map((l,i)=>'<tr><td>'+(i+1)+'</td>'+estado.colunas.map((_,j)=>'<td><input maxlength="2000" aria-label="Linha '+(i+1)+', coluna '+(j+1)+'" data-celula="'+i+','+j+'" value="'+escapar(l[j]??"")+'"></td>').join("")+'</tr>').join("");}
function coletar(){document.querySelectorAll("[data-coluna]").forEach(e=>estado.colunas[+e.dataset.coluna]=e.value);document.querySelectorAll("[data-celula]").forEach(e=>{const [i,j]=e.dataset.celula.split(",").map(Number);if(estado.linhas[i])estado.linhas[i][j]=e.value;});}
function programar(){if(!estado.carregado)return;estado.pendente=true;$("statusSalvamento").textContent="Alterações pendentes…";clearTimeout(estado.timer);estado.timer=setTimeout(salvar,650);}
async function salvar(){if(!estado.carregado)return;if(estado.salvando){estado.pendente=true;return;}coletar();estado.salvando=true;$("statusSalvamento").textContent="Salvando…";limparErro();try{do{estado.pendente=false;const dados={nome:$("nomePlanilha").value.trim(),colunas:[...estado.colunas],linhas:estado.linhas.map(l=>[...l])};await api("/api/planilhas/"+estado.id+"/dados",{method:"PUT",body:JSON.stringify(dados)});estado.nome=dados.nome||estado.nome;}while(estado.pendente);$("statusSalvamento").textContent="Todas as alterações salvas";}catch(e){$("statusSalvamento").textContent="Falha ao salvar";mostrarErro(e.message);}finally{estado.salvando=false;if(estado.pendente){clearTimeout(estado.timer);estado.timer=setTimeout(salvar,250);}}}
async function carregar(){estado.id=new URLSearchParams(location.search).get("id");if(!estado.id||!/^[0-9]+$/.test(estado.id)){mostrarErro("ID inválido. Volte e abra uma tabela pela lista.");$("statusSalvamento").textContent="Tabela inválida";return;}try{const d=await api("/api/planilhas/"+encodeURIComponent(estado.id)),p=d.planilha;estado.nome=p.nome;estado.colunas=Array.isArray(p.colunas)&&p.colunas.length?p.colunas:["Coluna 1","Coluna 2"];estado.linhas=Array.isArray(p.linhas)?p.linhas.map(l=>estado.colunas.map((_,i)=>String(l[i]??""))):[];if(!estado.linhas.length)estado.linhas=Array.from({length:10},()=>estado.colunas.map(()=>""));$("nomePlanilha").value=estado.nome;document.title=estado.nome+" — O SITE";renderizar();estado.carregado=true;$("statusSalvamento").textContent="Pronto para editar";}catch(e){$("statusSalvamento").textContent="Não foi possível abrir";mostrarErro(e.message);}}
$("tabelaDados").addEventListener("input",e=>{if(e.target.matches("[data-coluna]"))estado.colunas[+e.target.dataset.coluna]=e.target.value;else if(e.target.matches("[data-celula]")){const [i,j]=e.target.dataset.celula.split(",").map(Number);estado.linhas[i][j]=e.target.value;}programar();});
$("nomePlanilha").addEventListener("input",programar);
$("renomearSalvar").addEventListener("click",async()=>{const nome=$("nomePlanilha").value.trim();if(!nome){mostrarErro("O nome da tabela não pode ficar vazio.");return;}try{await api("/api/planilhas/"+estado.id,{method:"PATCH",body:JSON.stringify({nome})});estado.nome=nome;document.title=nome+" — O SITE";$("statusSalvamento").textContent="Nome salvo";limparErro();}catch(e){mostrarErro(e.message);}});
$("adicionarColuna").addEventListener("click",()=>{coletar();if(estado.colunas.length>=40){mostrarErro("O limite é de 40 colunas.");return;}estado.colunas.push("Coluna "+(estado.colunas.length+1));estado.linhas=estado.linhas.map(l=>[...l,""]);renderizar();programar();});
$("removerColuna").addEventListener("click",()=>{if(estado.colunas.length<=1){mostrarErro("A tabela precisa ter pelo menos uma coluna.");return;}if(!confirm("Remover a última coluna e seus dados?"))return;coletar();estado.colunas.pop();estado.linhas=estado.linhas.map(l=>l.slice(0,estado.colunas.length));renderizar();programar();});
$("adicionarLinha").addEventListener("click",()=>{coletar();if(estado.linhas.length>=500){mostrarErro("O limite é de 500 linhas.");return;}estado.linhas.push(estado.colunas.map(()=>""));renderizar();programar();});
$("removerLinha").addEventListener("click",()=>{if(!estado.linhas.length)return;if(!confirm("Remover a última linha?"))return;coletar();estado.linhas.pop();renderizar();programar();});

function nomeArquivo(ext){const base=($( "nomePlanilha").value||"tabela").trim().replace(/[\\\\/:*?"<>|]+/g,"-").replace(/\\s+/g," ").slice(0,80)||"tabela";return base+"."+ext;}
function dadosExportacao(){coletar();return [ [...estado.colunas], ...estado.linhas.map(l=>estado.colunas.map((_,i)=>String(l[i]??""))) ];}
function baixarBlob(blob,nome){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function exportarTabela(){
 if(!estado.carregado)return;
 const botao=$("exportarTabela"),formato=$("formatoExportacao"),original=botao.textContent;
 botao.disabled=true;botao.textContent="Preparando…";limparErro();
 try{
  const nome=($( "nomePlanilha").value||"tabela").trim()||"tabela";
  const dados=dadosExportacao();
  if(formato.value==="xlsx"){
   if(!window.XLSX)throw new Error("A biblioteca Excel não carregou. Atualize a página e tente novamente.");
   const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(dados);
   ws["!cols"]=estado.colunas.map(c=>({wch:Math.max(12,Math.min(32,String(c).length+4))}));
   XLSX.utils.book_append_sheet(wb,ws,nome.slice(0,31)||"Tabela");XLSX.writeFile(wb,nomeArquivo("xlsx"));
  }else if(formato.value==="pdf"){
   if(!window.jspdf?.jsPDF)throw new Error("A biblioteca PDF não carregou. Atualize a página e tente novamente.");
   const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:estado.colunas.length>5?"landscape":"portrait",unit:"mm",format:"a4"});
   doc.setFontSize(14);doc.text(nome,14,14);
   if(typeof doc.autoTable!=="function")throw new Error("O recurso de tabela PDF não carregou. Atualize a página.");
   doc.autoTable({head:[dados[0]],body:dados.slice(1),startY:20,theme:"grid",styles:{fontSize:Math.max(5,Math.min(9,10-estado.colunas.length*.25)),cellPadding:2,overflow:"linebreak"},headStyles:{fillColor:[55,65,81]},margin:{left:10,right:10},horizontalPageBreak:true,horizontalPageBreakRepeat:0});
   doc.save(nomeArquivo("pdf"));
  }else{
   if(!window.html2canvas)throw new Error("A biblioteca de imagem não carregou. Atualize a página e tente novamente.");
   const tabela=$("tabelaDados");
   const canvas=await html2canvas(tabela,{backgroundColor:getComputedStyle(document.body).backgroundColor||"#ffffff",scale:2,logging:false,windowWidth:Math.max(document.documentElement.clientWidth,tabela.scrollWidth+40),width:tabela.scrollWidth,height:tabela.scrollHeight,scrollX:0,scrollY:0});
   const mime=formato.value==="jpg"?"image/jpeg":"image/png";
   canvas.toBlob(blob=>{if(blob)baixarBlob(blob,nomeArquivo(formato.value));else mostrarErro("Não foi possível gerar a imagem.");},mime,0.95);
  }
  $("statusSalvamento").textContent="Arquivo exportado";
 }catch(e){mostrarErro(e.message||"Não foi possível exportar a tabela.");}
 finally{botao.disabled=false;botao.textContent=original;}
}
$("exportarTabela").addEventListener("click",exportarTabela);

carregar();