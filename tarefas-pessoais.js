module.exports = function registrarTarefasPessoais(app, pool, exigirLogin) {
    let tabelaPronta = pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas_pessoais (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            titulo TEXT NOT NULL,
            materia TEXT NOT NULL DEFAULT '',
            prazo TEXT,
            data_planejada TEXT,
            prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
            status TEXT NOT NULL DEFAULT 'a-fazer' CHECK (status IN ('a-fazer','em-andamento','concluida')),
            descricao TEXT NOT NULL DEFAULT '',
            origem_tipo TEXT,
            origem_id INTEGER,
            data_passada TEXT,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE tarefas_pessoais ADD COLUMN IF NOT EXISTS origem_tipo TEXT;
        ALTER TABLE tarefas_pessoais ADD COLUMN IF NOT EXISTS origem_id INTEGER;
        ALTER TABLE tarefas_pessoais ADD COLUMN IF NOT EXISTS data_passada TEXT;
    `);

    app.get('/api/tarefas-pessoais', exigirLogin, async (req,res)=>{
        try{
            await tabelaPronta;
            const r=await pool.query(`SELECT id,titulo,materia,prazo,data_planejada,prioridade,status,descricao,origem_tipo,origem_id,data_passada,criado_em FROM tarefas_pessoais WHERE usuario_id=$1 ORDER BY CASE WHEN data_planejada IS NULL OR data_planejada='' THEN 1 ELSE 0 END,data_planejada ASC,prazo ASC NULLS LAST,id DESC`,[req.session.usuario.id]);
            res.json({sucesso:true,tarefas:r.rows});
        }catch(e){console.error(e);res.status(500).json({sucesso:false,mensagem:'Erro interno do servidor.'});}
    });

    app.get('/api/tarefas-pessoais/origens', exigirLogin, async (req,res)=>{
        try{
            await tabelaPronta;
            const conta = await pool.query("SELECT tipo, turma_id FROM usuarios WHERE id = $1", [req.session.usuario.id]);
            if (!conta.rowCount) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            const usuario = conta.rows[0];
            if (usuario.tipo !== "admin" && !usuario.turma_id) return res.status(403).json({ sucesso: false, mensagem: "Sua conta não está vinculada a uma turma." });
            const [agenda,trabalhos]=await Promise.all([
                usuario.tipo === "admin"
                    ? pool.query(`SELECT id,data,materia,descricao FROM tarefas ORDER BY data DESC,id DESC`)
                    : pool.query(`SELECT id,data,materia,descricao FROM tarefas WHERE turma_id = $1 ORDER BY data DESC,id DESC`, [usuario.turma_id]),
                usuario.tipo === "admin"
                    ? pool.query(`SELECT id,titulo,materia,prazo,descricao,vale_ponto,criado_em,to_char(criado_em AT TIME ZONE 'America/Fortaleza','YYYY-MM-DD') AS data_passada FROM trabalhos ORDER BY prazo ASC NULLS LAST,id DESC`)
                    : pool.query(`SELECT id,titulo,materia,prazo,descricao,vale_ponto,criado_em,to_char(criado_em AT TIME ZONE 'America/Fortaleza','YYYY-MM-DD') AS data_passada FROM trabalhos WHERE turma_id = $1 ORDER BY prazo ASC NULLS LAST,id DESC`, [usuario.turma_id])
            ]);
            const usadas=await pool.query(`SELECT origem_tipo,origem_id FROM tarefas_pessoais WHERE usuario_id=$1 AND origem_tipo IS NOT NULL AND origem_id IS NOT NULL`,[req.session.usuario.id]);
            const chaveUsada=new Set(usadas.rows.map(x=>`${x.origem_tipo}:${x.origem_id}`));
            res.json({
                sucesso:true,
                agenda:agenda.rows.map(x=>({...x,origem_tipo:'agenda',data_passada:x.data,já_adicionada:chaveUsada.has(`agenda:${x.id}`)})),
                trabalhos:trabalhos.rows.map(x=>({...x,origem_tipo:'trabalho',já_adicionada:chaveUsada.has(`trabalho:${x.id}`)}))
            });
        }catch(e){console.error(e);res.status(500).json({sucesso:false,mensagem:'Erro ao carregar tarefas disponíveis.'});}
    });

    app.post('/api/tarefas-pessoais/importar', exigirLogin, async (req,res)=>{
        try{
            await tabelaPronta;
            const origemTipo=String(req.body.origem_tipo||'').trim();
            const origemId=Number(req.body.origem_id);
            const dataPlanejada=String(req.body.data_planejada||'').trim();
            const prioridade=String(req.body.prioridade||'media');
            if(!['agenda','trabalho'].includes(origemTipo)||!Number.isInteger(origemId)||origemId<=0)return res.status(400).json({sucesso:false,mensagem:'Origem inválida.'});
            if(!dataPlanejada)return res.status(400).json({sucesso:false,mensagem:'Escolha o dia em que pretende fazer a tarefa.'});
            if(!/^\d{4}-\d{2}-\d{2}$/.test(dataPlanejada))return res.status(400).json({sucesso:false,mensagem:'Data planejada inválida.'});
            if(!['baixa','media','alta'].includes(prioridade))return res.status(400).json({sucesso:false,mensagem:'Prioridade inválida.'});

            let item;
            let dataPassada;
            if(origemTipo==='agenda'){
                const conta = await pool.query("SELECT tipo, turma_id FROM usuarios WHERE id = $1", [req.session.usuario.id]);
                if (!conta.rowCount) return res.status(401).json({sucesso:false,mensagem:"Conta não encontrada."});
                const usuario = conta.rows[0];
                if (usuario.tipo !== "admin" && !usuario.turma_id) return res.status(403).json({sucesso:false,mensagem:"Sua conta não está vinculada a uma turma."});
                const r = usuario.tipo === "admin"
                    ? await pool.query(`SELECT id,data,materia,descricao FROM tarefas WHERE id=$1`, [origemId])
                    : await pool.query(`SELECT id,data,materia,descricao FROM tarefas WHERE id=$1 AND turma_id=$2`, [origemId, usuario.turma_id]);
                if(!r.rows.length)return res.status(404).json({sucesso:false,mensagem:'A tarefa da Agenda não existe mais.'});
                item=r.rows[0];
                dataPassada=item.data;
            }else{
                const conta = await pool.query("SELECT tipo, turma_id FROM usuarios WHERE id = $1", [req.session.usuario.id]);
                if (!conta.rowCount) return res.status(401).json({sucesso:false,mensagem:"Conta não encontrada."});
                const usuario = conta.rows[0];
                if (usuario.tipo !== "admin" && !usuario.turma_id) return res.status(403).json({sucesso:false,mensagem:"Sua conta não está vinculada a uma turma."});
                const r = usuario.tipo === "admin"
                    ? await pool.query(`SELECT id,titulo,materia,prazo,descricao,criado_em,to_char(criado_em AT TIME ZONE 'America/Fortaleza','YYYY-MM-DD') AS data_passada FROM trabalhos WHERE id=$1`, [origemId])
                    : await pool.query(`SELECT id,titulo,materia,prazo,descricao,criado_em,to_char(criado_em AT TIME ZONE 'America/Fortaleza','YYYY-MM-DD') AS data_passada FROM trabalhos WHERE id=$1 AND turma_id=$2`, [origemId, usuario.turma_id]);
                if(!r.rows.length)return res.status(404).json({sucesso:false,mensagem:'O trabalho não existe mais.'});
                item=r.rows[0];
                dataPassada=item.data_passada;
            }

            const jaExiste=await pool.query(`SELECT id FROM tarefas_pessoais WHERE usuario_id=$1 AND origem_tipo=$2 AND origem_id=$3 AND status<>'concluida' LIMIT 1`,[req.session.usuario.id,origemTipo,origemId]);
            if(jaExiste.rows.length)return res.status(409).json({sucesso:false,mensagem:'Essa atividade já está nas suas tarefas pessoais.'});

            const titulo=origemTipo==='agenda' ? `${item.materia}: ${item.descricao}` : item.titulo;
            const materia=item.materia||'';
            const prazo=origemTipo==='trabalho' ? (item.prazo||null) : item.data;
            const descricao=origemTipo==='agenda' ? item.descricao : (item.descricao||'');
            const r=await pool.query(`INSERT INTO tarefas_pessoais(usuario_id,titulo,materia,prazo,data_planejada,prioridade,status,descricao,origem_tipo,origem_id,data_passada) VALUES($1,$2,$3,$4,$5,$6,'a-fazer',$7,$8,$9,$10) RETURNING *`,[req.session.usuario.id,titulo.slice(0,160),materia.slice(0,80),prazo,dataPlanejada,prioridade,descricao,origemTipo,origemId,dataPassada]);
            res.status(201).json({sucesso:true,tarefa:r.rows[0]});
        }catch(e){console.error(e);res.status(500).json({sucesso:false,mensagem:'Erro interno do servidor.'});}
    });

    app.post('/api/tarefas-pessoais', exigirLogin, async (req,res)=>{try{await tabelaPronta;const titulo=String(req.body.titulo||'').trim(),materia=String(req.body.materia||'').trim(),prazo=String(req.body.prazo||'').trim(),planejada=String(req.body.data_planejada||'').trim(),prioridade=String(req.body.prioridade||'media'),status=String(req.body.status||'a-fazer'),descricao=String(req.body.descricao||'');if(!titulo)return res.status(400).json({sucesso:false,mensagem:'Dê um título para a tarefa.'});if(titulo.length>160||materia.length>80||descricao.length>10000)return res.status(400).json({sucesso:false,mensagem:'Algum campo ultrapassou o limite permitido.'});if(!['baixa','media','alta'].includes(prioridade)||!['a-fazer','em-andamento','concluida'].includes(status))return res.status(400).json({sucesso:false,mensagem:'Prioridade ou status inválido.'});const r=await pool.query(`INSERT INTO tarefas_pessoais(usuario_id,titulo,materia,prazo,data_planejada,prioridade,status,descricao) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.session.usuario.id,titulo,materia,prazo||null,planejada||null,prioridade,status,descricao]);res.status(201).json({sucesso:true,tarefa:r.rows[0]});}catch(e){console.error(e);res.status(500).json({sucesso:false,mensagem:'Erro interno do servidor.'});}});

    app.put('/api/tarefas-pessoais/:id', exigirLogin, async (req,res)=>{try{await tabelaPronta;const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0)return res.status(400).json({sucesso:false,mensagem:'ID inválido.'});const titulo=String(req.body.titulo||'').trim(),materia=String(req.body.materia||'').trim(),prazo=String(req.body.prazo||'').trim(),planejada=String(req.body.data_planejada||'').trim(),prioridade=String(req.body.prioridade||'media'),status=String(req.body.status||'a-fazer'),descricao=String(req.body.descricao||'');if(!titulo)return res.status(400).json({sucesso:false,mensagem:'Dê um título para a tarefa.'});if(!['baixa','media','alta'].includes(prioridade)||!['a-fazer','em-andamento','concluida'].includes(status))return res.status(400).json({sucesso:false,mensagem:'Prioridade ou status inválido.'});const r=await pool.query(`UPDATE tarefas_pessoais SET titulo=$1,materia=$2,prazo=$3,data_planejada=$4,prioridade=$5,status=$6,descricao=$7 WHERE id=$8 AND usuario_id=$9 RETURNING *`,[titulo,materia,prazo||null,planejada||null,prioridade,status,descricao,id,req.session.usuario.id]);if(!r.rows.length)return res.status(404).json({sucesso:false,mensagem:'Tarefa não encontrada.'});res.json({sucesso:true,tarefa:r.rows[0]});}catch(e){console.error(e);res.status(500).json({sucesso:false,mensagem:'Erro interno do servidor.'});}});
    app.delete('/api/tarefas-pessoais/:id',exigirLogin,async(req,res)=>{try{await tabelaPronta;const id=Number(req.params.id);const r=await pool.query(`DELETE FROM tarefas_pessoais WHERE id=$1 AND usuario_id=$2`,[id,req.session.usuario.id]);if(!r.rowCount)return res.status(404).json({sucesso:false,mensagem:'Tarefa não encontrada.'});res.json({sucesso:true});}catch(e){console.error(e);res.status(500).json({sucesso:false,mensagem:'Erro interno do servidor.'});}});
};
