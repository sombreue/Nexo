module.exports = function registrarEstatisticas(app, pool, exigirLogin) {
    app.get('/api/estatisticas', exigirLogin, async (req, res) => {
        const usuarioId = req.session.usuario.id;
        try {
            const [tarefasTabela, notasTabela] = await Promise.all([
                pool.query("SELECT to_regclass('public.tarefas_pessoais') AS tabela"),
                pool.query("SELECT to_regclass('public.notas_escolares') AS tabela")
            ]);

            const temTarefas = Boolean(tarefasTabela.rows[0]?.tabela);
            const temNotas = Boolean(notasTabela.rows[0]?.tabela);
            const agendaConcluidas = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE concluida_em >= date_trunc('week', NOW()))::int AS semana FROM tarefas_concluidas_usuarios WHERE usuario_id=$1`, [usuarioId]);
            const totalAgendaConcluidas = agendaConcluidas.rows[0]?.total || 0;
            const concluidasAgendaSemana = agendaConcluidas.rows[0]?.semana || 0;

            let tarefas = [], notas = [];
            if (temTarefas) {
                const r = await pool.query(`SELECT id,titulo,materia,prazo,data_planejada,prioridade,status,criado_em FROM tarefas_pessoais WHERE usuario_id=$1`, [usuarioId]);
                tarefas = r.rows;
            }
            if (temNotas) {
                const r = await pool.query(`SELECT id,materia,periodo,nota,peso,descricao,criado_em FROM notas_escolares WHERE usuario_id=$1`, [usuarioId]);
                notas = r.rows;
            }

            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            const inicioSemana = new Date(hoje);
            const dia = inicioSemana.getDay();
            inicioSemana.setDate(inicioSemana.getDate() - (dia === 0 ? 6 : dia - 1));
            const fimSemana = new Date(inicioSemana);
            fimSemana.setDate(fimSemana.getDate() + 7);

            const parseData = valor => {
                if (!valor) return null;
                const [a,m,d] = String(valor).slice(0,10).split('-').map(Number);
                if (!a || !m || !d) return null;
                return new Date(a,m-1,d);
            };
            const pendentes = tarefas.filter(t => t.status !== 'concluida');
            const atrasadas = pendentes.filter(t => { const d=parseData(t.prazo); return d && d < hoje; });
            const planejadas = tarefas.filter(t => t.data_planejada);
            const concluidas = tarefas.filter(t => t.status === 'concluida');
            const concluidasSemana = concluidas.filter(t => { const d=new Date(t.criado_em); return d >= inicioSemana && d < fimSemana; }).length;
            const criadasSemana = tarefas.filter(t => { const d=new Date(t.criado_em); return d >= inicioSemana && d < fimSemana; }).length;

            const somaPeso = notas.reduce((s,n)=>s+Number(n.peso||1),0);
            const mediaGeral = notas.length ? notas.reduce((s,n)=>s+Number(n.nota)*Number(n.peso||1),0)/somaPeso : null;
            const materiasMap = {};
            notas.forEach(n => {
                const materia=String(n.materia||'Sem matéria');
                if(!materiasMap[materia]) materiasMap[materia]={notas:[],peso:0,soma:0};
                const peso=Number(n.peso||1);
                materiasMap[materia].notas.push(n);
                materiasMap[materia].peso += peso;
                materiasMap[materia].soma += Number(n.nota)*peso;
            });
            const materias = Object.entries(materiasMap).map(([materia,v])=>({materia,media:v.peso?v.soma/v.peso:null,lancamentos:v.notas.length})).sort((a,b)=>(b.media??-1)-(a.media??-1));
            const melhorMateria = materias[0] || null;
            const piorMateria = materias.length ? materias[materias.length-1] : null;

            const bimestres = ['1º bimestre','2º bimestre','3º bimestre','4º bimestre'].map(periodo => {
                const itens=notas.filter(n=>n.periodo===periodo);
                const peso=itens.reduce((s,n)=>s+Number(n.peso||1),0);
                return {periodo,media:itens.length?itens.reduce((s,n)=>s+Number(n.nota)*Number(n.peso||1),0)/peso:null};
            });

            const totalTarefas = tarefas.length + totalAgendaConcluidas;
            res.json({sucesso:true, resumo:{totalTarefas,pendentes:pendentes.length,concluidas:concluidas.length+totalAgendaConcluidas,atrasadas:atrasadas.length,planejadas:planejadas.length,percentualConclusao:totalTarefas?((concluidas.length+totalAgendaConcluidas)/totalTarefas)*100:0,concluidasSemana:concluidasSemana+concluidasAgendaSemana,criadasSemana,mediaGeral,materiasLancadas:notas.length}, materias, melhorMateria, piorMateria, bimestres});
        } catch (e) {
            console.error(e);
            res.status(500).json({sucesso:false,mensagem:'Não foi possível calcular suas estatísticas.'});
        }
    });
};
