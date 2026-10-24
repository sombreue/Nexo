/* Gestão administrativa de turmas e consulta da turma vinculada à sessão. */
module.exports = function registrarRotasTurmas(app, pool, exigirLogin, exigirAdmin) {
    const nomeValido = nome => typeof nome === "string" && nome.trim().length >= 1 && nome.trim().length <= 100;

    async function auditar(atorId, turmaId, acao, detalhes = {}) {
        await pool.query(
            `INSERT INTO auditoria_turmas (ator_usuario_id, turma_id, acao, entidade, detalhes)
             VALUES ($1, $2, $3, 'turma', $4::jsonb)`,
            [atorId, turmaId, acao, JSON.stringify(detalhes)]
        ).catch(erro => console.error("[AUDITORIA TURMAS] Não foi possível registrar ação:", erro));
    }

    app.get("/api/turmas", exigirLogin, async (req, res) => {
        try {
            const usuario = req.session.usuario;
            const resultado = usuario.tipo === "admin"
                ? await pool.query("SELECT id, nome, ano_letivo AS \"anoLetivo\", ativa FROM turmas ORDER BY ativa DESC, ano_letivo DESC NULLS LAST, nome ASC")
                : await pool.query("SELECT id, nome, ano_letivo AS \"anoLetivo\", ativa FROM turmas WHERE id = $1", [usuario.turma_id]);
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, turmas: resultado.rows, turmaId: usuario.turma_id ?? null });
        } catch (erro) {
            console.error("Erro ao listar turmas:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível carregar as turmas. Confirme se a migração foi aplicada." });
        }
    });

    app.post("/api/turmas", exigirAdmin, async (req, res) => {
        const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
        const ano = req.body?.anoLetivo == null || req.body.anoLetivo === "" ? null : Number(req.body.anoLetivo);
        if (!nomeValido(nome) || (ano !== null && (!Number.isInteger(ano) || ano < 2000 || ano > 2200))) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe um nome válido e um ano letivo entre 2000 e 2200." });
        }
        try {
            const resultado = await pool.query(
                `INSERT INTO turmas (nome, ano_letivo)
                 VALUES ($1, $2)
                 RETURNING id, nome, ano_letivo AS "anoLetivo", ativa`,
                [nome, ano]
            );
            await auditar(req.session.usuario.id, resultado.rows[0].id, "turma_criada", { nome, anoLetivo: ano });
            res.status(201).json({ sucesso: true, turma: resultado.rows[0] });
        } catch (erro) {
            if (erro.code === "23505") return res.status(409).json({ sucesso: false, mensagem: "Já existe uma turma com esse nome e ano letivo." });
            console.error("Erro ao criar turma:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível criar a turma." });
        }
    });

    app.patch("/api/turmas/:id", exigirAdmin, async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Turma inválida." });
        const nome = req.body?.nome;
        const ativa = req.body?.ativa;
        const anoBruto = req.body?.anoLetivo;
        const ano = anoBruto === undefined ? undefined : (anoBruto === null || anoBruto === "" ? null : Number(anoBruto));
        if (nome !== undefined && !nomeValido(nome)) return res.status(400).json({ sucesso: false, mensagem: "O nome deve ter entre 1 e 100 caracteres." });
        if (ativa !== undefined && typeof ativa !== "boolean") return res.status(400).json({ sucesso: false, mensagem: "O estado da turma é inválido." });
        if (ano !== undefined && ano !== null && (!Number.isInteger(ano) || ano < 2000 || ano > 2200)) return res.status(400).json({ sucesso: false, mensagem: "Ano letivo inválido." });
        if (nome === undefined && ativa === undefined && ano === undefined) return res.status(400).json({ sucesso: false, mensagem: "Nenhuma alteração foi informada." });
        try {
            const resultado = await pool.query(
                `UPDATE turmas SET
                    nome = COALESCE($1, nome),
                    ativa = COALESCE($2, ativa),
                    ano_letivo = CASE WHEN $3::boolean THEN $4::smallint ELSE ano_letivo END,
                    atualizada_em = NOW()
                 WHERE id = $5
                 RETURNING id, nome, ano_letivo AS "anoLetivo", ativa`,
                [nome === undefined ? null : nome.trim(), ativa === undefined ? null : ativa, ano === undefined ? false : true, ano ?? null, id]
            );
            if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Turma não encontrada." });
            await auditar(req.session.usuario.id, id, "turma_atualizada", { alteracoes: { nome, ativa, anoLetivo: ano } });
            res.json({ sucesso: true, turma: resultado.rows[0] });
        } catch (erro) {
            if (erro.code === "23505") return res.status(409).json({ sucesso: false, mensagem: "Já existe uma turma com esse nome e ano letivo." });
            console.error("Erro ao atualizar turma:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível atualizar a turma." });
        }
    });
};
