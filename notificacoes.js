module.exports = function instalarNotificacoes(app, pool) {
    let tabelasProntas = null;

    async function prepararTabelas() {
        if (tabelasProntas) return tabelasProntas;

        tabelasProntas = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS notificacoes (
                    id SERIAL PRIMARY KEY,
                    usuario_id INTEGER NOT NULL,
                    tipo TEXT NOT NULL,
                    origem_tipo TEXT NOT NULL,
                    origem_id INTEGER NOT NULL,
                    titulo TEXT NOT NULL,
                    mensagem TEXT NOT NULL,
                    link TEXT,
                    data_atividade DATE NOT NULL,
                    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    lida_em TIMESTAMPTZ
                )
            `);

            // Migração segura para instalações que receberam uma versão anterior.
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'atividade'`);
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS origem_tipo TEXT NOT NULL DEFAULT 'atividade'`);
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS origem_id INTEGER NOT NULL DEFAULT 0`);
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT 'Notificação'`);
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS mensagem TEXT NOT NULL DEFAULT ''`);
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS link TEXT`);
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS data_atividade DATE NOT NULL DEFAULT CURRENT_DATE`);
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
            await pool.query(`ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS lida_em TIMESTAMPTZ`);

            // Versões anteriores podem ter criado duplicatas antes do índice UNIQUE.
            // Mantemos apenas a notificação mais antiga de cada chave lógica.
            await pool.query(`
                DELETE FROM notificacoes a
                USING notificacoes b
                WHERE a.id > b.id
                  AND a.usuario_id = b.usuario_id
                  AND a.origem_tipo = b.origem_tipo
                  AND a.origem_id = b.origem_id
                  AND a.data_atividade = b.data_atividade
            `);

            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_unicas_idx
                ON notificacoes (usuario_id, origem_tipo, origem_id, data_atividade)
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS configuracoes_notificacoes (
                    usuario_id INTEGER PRIMARY KEY,
                    ativa BOOLEAN NOT NULL DEFAULT TRUE,
                    dias_antecedencia INTEGER NOT NULL DEFAULT 1 CHECK (dias_antecedencia BETWEEN 0 AND 30),
                    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
            await pool.query(`ALTER TABLE configuracoes_notificacoes ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT TRUE`);
            await pool.query(`ALTER TABLE configuracoes_notificacoes ADD COLUMN IF NOT EXISTS dias_antecedencia INTEGER NOT NULL DEFAULT 1`);
            await pool.query(`ALTER TABLE configuracoes_notificacoes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
        })().catch(erro => {
            tabelasProntas = null;
            throw erro;
        });

        return tabelasProntas;
    }

    function exigirLogin(req, res, next) {
        if (!req.session?.usuario) {
            return res.status(401).json({ sucesso: false, mensagem: "Você precisa estar logado." });
        }
        next();
    }

    function dataFortaleza() {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Fortaleza",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());
    }

    function adicionarDias(dataIso, dias) {
        const d = new Date(`${dataIso}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + Number(dias));
        return d.toISOString().slice(0, 10);
    }

    function textoAntecedencia(dias) {
        if (dias === 0) return "hoje";
        if (dias === 1) return "amanhã";
        return `em ${dias} dias`;
    }

    async function gerarNotificacoes() {
        try {
            await prepararTabelas();

            const hoje = dataFortaleza();
            const usuarios = await pool.query(`
                SELECT u.id,
                       COALESCE(c.ativa, TRUE) AS ativa,
                       COALESCE(c.dias_antecedencia, 1) AS dias_antecedencia
                FROM usuarios u
                LEFT JOIN configuracoes_notificacoes c ON c.usuario_id = u.id
            `);

            for (const usuario of usuarios.rows) {
                if (!usuario.ativa) continue;

                const dias = Number(usuario.dias_antecedencia);
                const dataAlvo = adicionarDias(hoje, dias);

                const tarefas = await pool.query(`
                    SELECT id, data, materia, descricao
                    FROM tarefas
                    WHERE data = $1
                      AND turma_id = (SELECT turma_id FROM usuarios WHERE id = $2)
                `, [dataAlvo, usuario.id]);

                for (const tarefa of tarefas.rows) {
                    const descricao = String(tarefa.descricao || "").trim();
                    const resumo = descricao.length > 140 ? descricao.slice(0, 137) + "..." : descricao;
                    await pool.query(`
                        INSERT INTO notificacoes
                            (usuario_id, tipo, origem_tipo, origem_id, titulo, mensagem, link, data_atividade)
                        VALUES ($1, 'atividade', 'tarefa', $2, $3, $4, $5, $6::date)
                        ON CONFLICT (usuario_id, origem_tipo, origem_id, data_atividade) DO NOTHING
                    `, [
                        usuario.id,
                        tarefa.id,
                        `Tarefa ${textoAntecedencia(dias)}`,
                        `${tarefa.materia}: ${resumo}`,
                        `/agenda.html?data=${encodeURIComponent(tarefa.data)}`,
                        tarefa.data
                    ]);
                }

                const trabalhos = await pool.query(`
                    SELECT id, titulo, materia, prazo
                    FROM trabalhos
                    WHERE prazo = $1
                      AND turma_id = (SELECT turma_id FROM usuarios WHERE id = $2)
                `, [dataAlvo, usuario.id]);

                for (const trabalho of trabalhos.rows) {
                    await pool.query(`
                        INSERT INTO notificacoes
                            (usuario_id, tipo, origem_tipo, origem_id, titulo, mensagem, link, data_atividade)
                        VALUES ($1, 'atividade', 'trabalho', $2, $3, $4, '/trabalhos.html', $5::date)
                        ON CONFLICT (usuario_id, origem_tipo, origem_id, data_atividade) DO NOTHING
                    `, [
                        usuario.id,
                        trabalho.id,
                        `Trabalho ${textoAntecedencia(dias)}`,
                        `${trabalho.materia}: ${trabalho.titulo}`,
                        trabalho.prazo
                    ]);
                }
            }

            console.log(`[NOTIFICAÇÕES] Verificação concluída | alvo=${hoje}`);
        } catch (erro) {
            console.error("[NOTIFICAÇÕES] Erro ao gerar notificações:", erro);
        }
    }

    app.get("/api/notificacoes", exigirLogin, async (req, res) => {
        try {
            await prepararTabelas();
            const resultado = await pool.query(`
                SELECT id, tipo, titulo, mensagem, link, data_atividade, criado_em, lida_em
                FROM notificacoes
                WHERE usuario_id = $1
                ORDER BY lida_em NULLS FIRST, criado_em DESC
                LIMIT 50
            `, [req.session.usuario.id]);

            const naoLidas = resultado.rows.filter(n => !n.lida_em).length;
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, notificacoes: resultado.rows, nao_lidas: naoLidas });
        } catch (erro) {
            console.error("[NOTIFICAÇÕES] Erro ao listar:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar notificações." });
        }
    });

    app.patch("/api/notificacoes/:id/lida", exigirLogin, async (req, res) => {
        try {
            await prepararTabelas();
            const resultado = await pool.query(
                "UPDATE notificacoes SET lida_em = COALESCE(lida_em, NOW()) WHERE id = $1 AND usuario_id = $2 RETURNING id",
                [req.params.id, req.session.usuario.id]
            );
            if (!resultado.rows.length) return res.status(404).json({ sucesso: false, mensagem: "Notificação não encontrada." });
            res.json({ sucesso: true });
        } catch (erro) {
            console.error("[NOTIFICAÇÕES] Erro ao marcar como lida:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar notificação." });
        }
    });

    app.post("/api/notificacoes/marcar-todas-lidas", exigirLogin, async (req, res) => {
        try {
            await prepararTabelas();
            await pool.query(
                "UPDATE notificacoes SET lida_em = NOW() WHERE usuario_id = $1 AND lida_em IS NULL",
                [req.session.usuario.id]
            );
            res.json({ sucesso: true });
        } catch (erro) {
            console.error("[NOTIFICAÇÕES] Erro ao marcar todas como lidas:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar notificações." });
        }
    });

    app.get("/api/notificacoes/config", exigirLogin, async (req, res) => {
        try {
            await prepararTabelas();
            const resultado = await pool.query(
                "SELECT ativa, dias_antecedencia FROM configuracoes_notificacoes WHERE usuario_id = $1",
                [req.session.usuario.id]
            );
            const config = resultado.rows[0] || { ativa: true, dias_antecedencia: 1 };
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, configuracao: config });
        } catch (erro) {
            console.error("[NOTIFICAÇÕES] Erro ao carregar configuração:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar configuração." });
        }
    });

    app.put("/api/notificacoes/config", exigirLogin, async (req, res) => {
        try {
            await prepararTabelas();
            const ativa = req.body.ativa !== false;
            const dias = Number(req.body.dias_antecedencia);
            if (!Number.isInteger(dias) || dias < 0 || dias > 30) {
                return res.status(400).json({ sucesso: false, mensagem: "Escolha uma antecedência entre 0 e 30 dias." });
            }

            const resultado = await pool.query(`
                INSERT INTO configuracoes_notificacoes (usuario_id, ativa, dias_antecedencia, atualizado_em)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (usuario_id)
                DO UPDATE SET ativa = EXCLUDED.ativa,
                              dias_antecedencia = EXCLUDED.dias_antecedencia,
                              atualizado_em = NOW()
                RETURNING ativa, dias_antecedencia
            `, [req.session.usuario.id, ativa, dias]);

            res.json({ sucesso: true, configuracao: resultado.rows[0] });
        } catch (erro) {
            console.error("[NOTIFICAÇÕES] Erro ao salvar configuração:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao salvar configuração." });
        }
    });

    const prepararEIniciar = prepararTabelas()
        .then(() => new Promise(resolve => setTimeout(resolve, 5000)))
        .then(() => gerarNotificacoes())
        .catch(erro => console.error("[NOTIFICAÇÕES] Erro ao preparar sistema:", erro));

    // Verifica com frequência para que uma falha temporária de inicialização do banco\n    // não deixe o usuário sem notificações por vários minutos.\n    setInterval(gerarNotificacoes, 60 * 1000);

    console.log("API de notificações instalada.");
    return prepararEIniciar;
};
