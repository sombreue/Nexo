/* Catálogo central de matérias do Nexo. */
module.exports = function registrarRotasMaterias(app, pool, exigirLogin, exigirAdmin) {
    const PADRAO = [
        "Ciências", "Matemática", "Português", "Redação", "Bilíngue",
        "Artes", "Robótica", "Ed. Física", "Socioemocional", "Literatura",
        "Gramática", "História", "Química", "Geografia", "Física"
    ];

    async function garantirTabela() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS materias_catalogo (
                id SERIAL PRIMARY KEY,
                nome TEXT NOT NULL,
                ativa BOOLEAN NOT NULL DEFAULT TRUE,
                ordem INTEGER NOT NULL DEFAULT 0,
                criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS materias_catalogo_nome_lower_idx ON materias_catalogo (LOWER(nome))");
        const total = await pool.query("SELECT COUNT(*)::int AS total FROM materias_catalogo");
        if (total.rows[0].total === 0) {
            for (let i = 0; i < PADRAO.length; i++) {
                await pool.query(
                    "INSERT INTO materias_catalogo (nome, ativa, ordem) VALUES ($1, TRUE, $2) ON CONFLICT DO NOTHING",
                    [PADRAO[i], i]
                );
            }
        }
    }

    const validarNome = nome => typeof nome === "string" && nome.trim().length >= 1 && nome.trim().length <= 80;

    app.get("/api/materias", exigirLogin, async (req, res) => {
        try {
            await garantirTabela();
            const incluirInativas = req.session.usuario.tipo === "admin" && req.query.todas === "1";
            const resultado = await pool.query(
                `SELECT id, nome, ativa, ordem
                 FROM materias_catalogo ${incluirInativas ? "" : "WHERE ativa = TRUE"}
                 ORDER BY ordem ASC, nome ASC`
            );
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, materias: resultado.rows });
        } catch (erro) {
            console.error("Erro ao carregar catálogo de matérias:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível carregar as matérias." });
        }
    });

    app.post("/api/materias", exigirAdmin, async (req, res) => {
        try {
            await garantirTabela();
            const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
            if (!validarNome(nome)) {
                return res.status(400).json({ sucesso: false, mensagem: "Informe um nome de matéria de até 80 caracteres." });
            }
            const existente = await pool.query("SELECT id FROM materias_catalogo WHERE LOWER(nome) = LOWER($1)", [nome]);
            if (existente.rowCount) {
                return res.status(409).json({ sucesso: false, mensagem: "Já existe uma matéria com esse nome. Se estiver inativa, reative-a." });
            }
            const proximaOrdem = await pool.query("SELECT COALESCE(MAX(ordem), -1) + 1 AS ordem FROM materias_catalogo");
            const resultado = await pool.query(
                "INSERT INTO materias_catalogo (nome, ativa, ordem) VALUES ($1, TRUE, $2) RETURNING id, nome, ativa, ordem",
                [nome, proximaOrdem.rows[0].ordem]
            );
            res.status(201).json({ sucesso: true, materia: resultado.rows[0] });
        } catch (erro) {
            console.error("Erro ao adicionar matéria:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível adicionar a matéria." });
        }
    });

    app.put("/api/materias/:id", exigirAdmin, async (req, res) => {
        try {
            await garantirTabela();
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ sucesso: false, mensagem: "Matéria inválida." });
            }
            const atual = await pool.query("SELECT id FROM materias_catalogo WHERE id = $1", [id]);
            if (!atual.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Matéria não encontrada." });

            const ativa = req.body?.ativa;
            const ordem = req.body?.ordem;
            if (typeof ativa !== "boolean" && !Number.isInteger(ordem)) {
                return res.status(400).json({ sucesso: false, mensagem: "Nenhuma alteração válida foi informada." });
            }
            const resultado = await pool.query(
                `UPDATE materias_catalogo
                 SET ativa = COALESCE($1, ativa),
                     ordem = COALESCE($2, ordem),
                     atualizado_em = NOW()
                 WHERE id = $3
                 RETURNING id, nome, ativa, ordem`,
                [typeof ativa === "boolean" ? ativa : null, Number.isInteger(ordem) && ordem >= 0 ? ordem : null, id]
            );
            res.json({ sucesso: true, materia: resultado.rows[0] });
        } catch (erro) {
            console.error("Erro ao atualizar matéria:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível atualizar a matéria." });
        }
    });
};
