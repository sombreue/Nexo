(() => {
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=n=>n==null?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const hoje=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const dataLocal=v=>{if(!v)return null;const p=String(v).slice(0,10).split('-').map(Number);if(p.length!==3||!p[0]||!p[1]||!p[2])return null;return new Date(p[0],p[1]-1,p[2])};
async function jsonFetch(url){const r=await fetch(url,{cache:'no-store'});if(r.status===401){location.href='/login.html';return null;}const texto=await r.text();let d;try{d=texto?JSON.parse(texto):{};}catch(e){throw new Error('O servidor não retornou dados válidos para as estatísticas.');}if(!r.ok||d.sucesso===false)throw new Error(d.mensagem||'Não foi possível carregar as estatísticas.');return d;}
async function carregar(){
 const sessao=await jsonFetch('/api/sessao');
 if(!sessao?.logado){location.href='/login.html';return;}
 const [tarefasData,notasData,agendaData]=await Promise.all([jsonFetch('/api/tarefas-pessoais'),jsonFetch('/api/notas'),jsonFetch('/api/tarefas')]);
 const tarefas=[...(tarefasData?.tarefas||[]),...(agendaData?.tarefas||[]).filter(t=>t.feito).map(t=>({status:'concluida',criado_em:t.concluidaEm,materia:t.materia,origem_tipo:'agenda'}))],notas=notasData?.notas||[];
 const agora=hoje();
 const pendentes=tarefas.filter(t=>t.status!=='concluida');
 const atrasadas=pendentes.filter(t=>{const d=dataLocal(t.prazo);return d&&d<agora;});
 const concluidas=tarefas.filter(t=>t.status==='concluida');
 const inicioSemana=new Date(agora);const dia=inicioSemana.getDay();inicioSemana.setDate(inicioSemana.getDate()-(dia===0?6:dia-1));
 const fimSemana=new Date(inicioSemana);fimSemana.setDate(fimSemana.getDate()+7);
 const concluidasSemana=concluidas.filter(t=>{const d=new Date(t.criado_em);return d>=inicioSemana&&d<fimSemana}).length;
 const criadasSemana=tarefas.filter(t=>{const d=new Date(t.criado_em);return d>=inicioSemana&&d<fimSemana}).length;
 const pesoTotal=notas.reduce((s,n)=>s+Number(n.peso||1),0);
 const mediaGeral=notas.length?notas.reduce((s,n)=>s+Number(n.nota)*Number(n.peso||1),0)/pesoTotal:null;
 const mapa={};
 notas.forEach(n=>{const materia=String(n.materia||'Sem matéria');if(!mapa[materia])mapa[materia]={peso:0,soma:0,lancamentos:0};const peso=Number(n.peso||1);mapa[materia].peso+=peso;mapa[materia].soma+=Number(n.nota)*peso;mapa[materia].lancamentos++});
 const materias=Object.entries(mapa).map(([materia,v])=>({materia,media:v.peso?v.soma/v.peso:null,lancamentos:v.lancamentos}));
 const bimestres=['1º bimestre','2º bimestre','3º bimestre','4º bimestre'].map(periodo=>{const itens=notas.filter(n=>n.periodo===periodo);const peso=itens.reduce((s,n)=>s+Number(n.peso||1),0);return{periodo,media:itens.length?itens.reduce((s,n)=>s+Number(n.nota)*Number(n.peso||1),0)/peso:null}});
 $('media-geral').textContent=fmt(mediaGeral);$('concluidas').textContent=concluidas.length;$('atrasadas').textContent=atrasadas.length;$('percentual').textContent=`${tarefas.length?Math.round(concluidas.length/tarefas.length*100):0}%`;$('concluidas-semana').textContent=concluidasSemana;$('criadas-semana').textContent=criadasSemana;$('pendentes').textContent=pendentes.length;
 $('bimestres').innerHTML=bimestres.map(b=>`<div class="bimestre"><div class="bimestre-top"><span>${esc(b.periodo)}</span><strong>${fmt(b.media)}</strong></div><div class="barra"><i style="width:${b.media==null?0:Math.max(0,Math.min(100,b.media*10))}%"></i></div></div>`).join('');
 $('materias').innerHTML=materias.length?materias.map(m=>`<div class="materia"><div><strong>${esc(m.materia)}</strong><small>${m.lancamentos} ${m.lancamentos===1?'avaliação':'avaliações'}</small></div><strong>${fmt(m.media)}</strong></div>`).join(''):'<div class="vazio">Ainda não há notas cadastradas.</div>';
 const melhor=materias.length?materias.reduce((a,b)=>(b.media??-1)>(a.media??-1)?b:a):null;
 const pior=materias.length?materias.reduce((a,b)=>(b.media??11)<(a.media??11)?b:a):null;
 const insights=[];
 if(atrasadas.length)insights.push(`<strong>Você tem ${atrasadas.length} tarefa${atrasadas.length===1?' atrasada':'s atrasadas'}.</strong> Vale a pena resolver isso antes de acumular mais pendências.`);
 if(melhor)insights.push(`<strong>Melhor matéria: ${esc(melhor.materia)} (${fmt(melhor.media)}).</strong> Continue mantendo esse ritmo.`);
 if(pior&&materias.length>1)insights.push(`<strong>Matéria que merece atenção: ${esc(pior.materia)} (${fmt(pior.media)}).</strong> Ela é a menor média entre as matérias cadastradas.`);
 if(!atrasadas.length&&tarefas.length)insights.push('<strong>Sem tarefas atrasadas.</strong> Sua organização está em dia.');
 if(!tarefas.length&&!notas.length)insights.push('<strong>Comece registrando suas tarefas e notas.</strong> Assim esta página poderá mostrar sua evolução.');
 $('mensagem-tarefas').textContent=tarefas.length?`${pendentes.length} pendente${pendentes.length===1?'':'s'} no total.`:'Nenhuma tarefa cadastrada ainda.';
 $('insights').innerHTML=insights.map(t=>`<div class="insight-card">${t}</div>`).join('');
}
$('sair').onclick=async()=>{try{await fetch('/api/logout',{method:'POST'});}finally{location.href='/login.html';}};
carregar().catch(e=>{document.querySelector('main').insertAdjacentHTML('beforeend',`<section class="erro">${esc(e.message)}</section>`);});
})();
