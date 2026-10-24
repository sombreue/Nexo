/* Catálogo global de matérias e catálogo isolado por turma. */
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS turma_materias (
                id BIGSERIAL PRIMARY KEY,
                turma_id BIGINT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
                nome VARCHAR(100) NOT NULL,
                ativa BOOLEAN NOT NULL DEFAULT TRUE,
                criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT turma_materias_nome_uk UNIQUE (turma_id, nome)
            )
        `);
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

    async function obterUsuario(req) {
        const r = await pool.query("SELECT id, tipo, turma_id FROM usuarios WHERE id = $1", [req.session.usuario.id]);
        return r.rows[0] || null;
    }

    async function garantirMateriasDaTurma(turmaId) {
        // O catálogo global não é copiado dinamicamente para cada turma.
        await pool.query(
            `INSERT INTO turma_materias (turma_id, nome, ativa)
             SELECT $1, padrao.nome, TRUE FROM unnest($2::text[]) AS padrao(nome)
             ON CONFLICT (turma_id, nome) DO NOTHING`,
            [turmaId, PADRAO]
        );
    }

    app.get("/api/materias", exigirLogin, async (req, res) => {
        try {
            await garantirTabela();
            const usuario = await obterUsuario(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });

            let resultado;
            const turmaIdAdmin = usuario.tipo === "admin" && req.query.turmaId != null ? Number(req.query.turmaId) : null;
            if (usuario.tipo === "admin" && req.query.turmaId != null) {
                if (!Number.isSafeInteger(turmaIdAdmin) || turmaIdAdmin <= 0) return res.status(400).json({ sucesso: false, mensagem: "Turma inválida." });
                const turma = await pool.query("SELECT id FROM turmas WHERE id = $1", [turmaIdAdmin]);
                if (!turma.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Turma não encontrada." });
                await garantirMateriasDaTurma(turmaIdAdmin);
                const incluirInativas = req.query.todas === "1";
                resultado = await pool.query(
                    `SELECT id, nome, ativa, 0 AS ordem FROM turma_materias WHERE turma_id = $1 ${incluirInativas ? "" : "AND ativa = TRUE"} ORDER BY nome ASC`,
                    [turmaIdAdmin]
                );
            } else if (usuario.tipo === "admin") {
                const incluirInativas = req.query.todas === "1";
                resultado = await pool.query(
                    `SELECT id, nome, ativa, ordem FROM materias_catalogo ${incluirInativas ? "" : "WHERE ativa = TRUE"} ORDER BY ordem ASC, nome ASC`
                );
            } else {
                if (!usuario.turma_id) return res.status(403).json({ sucesso: false, mensagem: "Sua conta não está vinculada a uma turma." });
                await garantirMateriasDaTurma(usuario.turma_id);
                resultado = await pool.query(
                    "SELECT id, nome, ativa, 0 AS ordem FROM turma_materias WHERE turma_id = $1 AND ativa = TRUE ORDER BY nome ASC",
                    [usuario.turma_id]
                );
            }

            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, materias: resultado.rows });
        } catch (erro) {
            console.error("Erro ao carregar catálogo de matérias:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível carregar as matérias." });
        }
    });

    app.post("/api/materias", exigirLogin, async (req, res) => {
        try {
            await garantirTabela();
            const usuario = await obterUsuario(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
            if (!validarNome(nome)) return res.status(400).json({ sucesso: false, mensagem: "Informe uma matéria de até 80 caracteres." });

            const turmaIdAdmin = usuario.tipo === "admin" && req.body?.turmaId != null && req.body.turmaId !== "" ? Number(req.body.turmaId) : null;
            if (usuario.tipo === "representante" || (usuario.tipo === "admin" && turmaIdAdmin !== null)) {
                const turmaId = usuario.tipo === "representante" ? usuario.turma_id : turmaIdAdmin;
                if (!Number.isSafeInteger(Number(turmaId)) || Number(turmaId) <= 0) return res.status(400).json({ sucesso: false, mensagem: "Selecione uma turma válida." });
                const turma = await pool.query("SELECT id FROM turmas WHERE id = $1", [Number(turmaId)]);
                if (!turma.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Turma não encontrada." });
                await garantirMateriasDaTurma(Number(turmaId));
                const r = await pool.query(
                    "INSERT INTO turma_materias (turma_id, nome, ativa) VALUES ($1, $2, TRUE) RETURNING id, nome, ativa, 0 AS ordem",
                    [Number(turmaId), nome]
                );
                return res.status(201).json({ sucesso: true, materia: r.rows[0] });
            }

            if (usuario.tipo !== "admin") return res.status(403).json({ sucesso: false, mensagem: "Somente administradores ou representantes podem adicionar matérias." });
            const existente = await pool.query("SELECT id FROM materias_catalogo WHERE LOWER(nome) = LOWER($1)", [nome]);
            if (existente.rowCount) return res.status(409).json({ sucesso: false, mensagem: "Já existe uma matéria com esse nome. Se estiver inativa, reative-a." });
            const proximaOrdem = await pool.query("SELECT COALESCE(MAX(ordem), -1) + 1 AS ordem FROM materias_catalogo");
            const r = await pool.query(
                "INSERT INTO materias_catalogo (nome, ativa, ordem) VALUES ($1, TRUE, $2) RETURNING id, nome, ativa, ordem",
                [nome, proximaOrdem.rows[0].ordem]
            );
            res.status(201).json({ sucesso: true, materia: r.rows[0] });
        } catch (erro) {
            if (erro.code === "23505") return res.status(409).json({ sucesso: false, mensagem: "Essa matéria já existe nesta turma." });
            console.error("Erro ao adicionar matéria:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível adicionar a matéria." });
        }
    });

    app.put("/api/materias/:id", exigirLogin, async (req, res) => {
        try {
            await garantirTabela();
            const usuario = await obterUsuario(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Matéria inválida." });
            const ativa = req.body?.ativa;
            const ordem = req.body?.ordem;

            const turmaIdAdmin = usuario.tipo === "admin" && req.query.turmaId != null ? Number(req.query.turmaId) : null;
            if (usuario.tipo === "representante" || (usuario.tipo === "admin" && req.query.turmaId != null)) {
                const turmaId = usuario.tipo === "representante" ? usuario.turma_id : turmaIdAdmin;
                if (!Number.isSafeInteger(Number(turmaId)) || Number(turmaId) <= 0) return res.status(400).json({ sucesso: false, mensagem: "Selecione uma turma válida." });
                if (typeof ativa !== "boolean") return res.status(400).json({ sucesso: false, mensagem: "Informe se a matéria ficará ativa." });
                const r = await pool.query(
                    "UPDATE turma_materias SET ativa = $1 WHERE id = $2 AND turma_id = $3 RETURNING id, nome, ativa, 0 AS ordem",
                    [ativa, id, Number(turmaId)]
                );
                if (!r.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Matéria não encontrada nesta turma." });
                return res.json({ sucesso: true, materia: r.rows[0] });
            }

            if (usuario.tipo !== "admin") return res.status(403).json({ sucesso: false, mensagem: "Você não pode editar o catálogo de matérias." });
            const atual = await pool.query("SELECT id FROM materias_catalogo WHERE id = $1", [id]);
            if (!atual.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Matéria não encontrada." });
            if (typeof ativa !== "boolean" && !Number.isInteger(ordem)) return res.status(400).json({ sucesso: false, mensagem: "Nenhuma alteração válida foi informada." });
            const r = await pool.query(
                `UPDATE materias_catalogo SET ativa = COALESCE($1, ativa), ordem = COALESCE($2, ordem), atualizado_em = NOW()
                 WHERE id = $3 RETURNING id, nome, ativa, ordem`,
                [typeof ativa === "boolean" ? ativa : null, Number.isInteger(ordem) && ordem >= 0 ? ordem : null, id]
            );
            res.json({ sucesso: true, materia: r.rows[0] });
        } catch (erro) {
            console.error("Erro ao atualizar matéria:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível atualizar a matéria." });
        }
    });
};
