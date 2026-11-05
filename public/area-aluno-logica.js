(() => {
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function data(d){if(!d)return '';const [a,m,dia]=d.split('-');return `${dia}/${m}/${a}`;}
function hoje(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
async function inicializar(){
 try{
  const sessaoRes=await fetch('/api/sessao'); const sessao=await sessaoRes.json();
  if(!sessao.logado){location.href='/login.html';return;}
  // /api/sessao retorna o usuário como objeto; usar o nome salvo em usuario.
  const nomeUsuario = typeof sessao.usuario === 'object'
   ? (sessao.usuario?.usuario || sessao.usuario?.nome || 'aluno')
   : sessao.usuario;
  $('usuario').textContent=nomeUsuario || 'aluno';
  const tarefasRes=await fetch('/api/tarefas-pessoais'); const dados=await tarefasRes.json();
  if(!tarefasRes.ok||!dados.sucesso) throw new Error(dados.mensagem||'Não foi possível carregar suas tarefas.');
  const tarefas=dados.tarefas||[];
  const agendaRes=await fetch('/api/tarefas',{cache:'no-store'});
  const agendaData=agendaRes.ok?await agendaRes.json():{};
  const concluidasAgenda=(agendaData.tarefas||[]).filter(t=>t.feito).length;
  $('total').textContent=tarefas.length+concluidasAgenda;
  $('planejadas').textContent=tarefas.filter(t=>t.data_planejada).length;
  const agora=hoje();
  const proximas=tarefas.filter(t=>{const d=t.data_planejada||t.prazo;if(!d)return false;return new Date(`${d}T00:00:00`)>=agora;}).sort((a,b)=>(a.data_planejada||a.prazo).localeCompare(b.data_planejada||b.prazo)).slice(0,5);
  $('proximas').textContent=proximas.length;
  $('lista-proximas').innerHTML=proximas.length?proximas.map(t=>`<a class="proxima" href="/tarefas-pessoais.html"><div><strong>${esc(t.titulo)}</strong>${t.materia?`<span>${esc(t.materia)}</span>`:''}</div><time>${t.data_planejada?`Fazer em ${data(t.data_planejada)}`:`Entrega ${data(t.prazo)}`}</time></a>`).join(''):'<div class="sem-tarefas"><strong>Tudo tranquilo por enquanto.</strong><p>Você não tem tarefas próximas. Que tal criar uma?</p><a href="/tarefas-pessoais.html">Criar tarefa →</a></div>';
 }catch(e){$('lista-proximas').innerHTML='<div class="sem-tarefas"><strong>Não foi possível carregar as tarefas.</strong><p>Abra Minhas tarefas para tentar novamente.</p></div>';}
}
$('sair').onclick=async()=>{try{await fetch('/api/logout',{method:'POST'});}finally{location.href='/login.html';}};
inicializar();
})();
