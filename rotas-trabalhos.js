module.exports = function instalarRotasTrabalhos(app, pool) {
    function exigirLogin(req, res, next) {
        if (!req.session?.usuario) return res.status(401).json({ sucesso: false, mensagem: "Você precisa estar logado." });
        next();
    }

    function exigirGestor(req, res, next) {
        if (!req.session?.usuario) return res.status(401).json({ sucesso: false, mensagem: "Você precisa estar logado." });
        if (!["admin", "representante"].includes(req.session.usuario.tipo)) return res.status(403).json({ sucesso: false, mensagem: "Somente administradores e representantes podem alterar trabalhos da turma." });
        next();
    }

    async function usuarioAtual(req) {
        const r = await pool.query("SELECT id, tipo, turma_id FROM usuarios WHERE id = $1", [req.session.usuario.id]);
        return r.rows[0] || null;
    }

    // Mantém a tabela compatível mesmo se ela tiver sido criada por uma versão
    // anterior da página de Trabalhos & Pesquisas.
    const tabelaPronta = (async () => {
        await pool.query(`CREATE TABLE IF NOT EXISTS trabalhos (
            id SERIAL PRIMARY KEY,
            titulo TEXT NOT NULL,
            materia TEXT NOT NULL,
            prazo TEXT,
            descricao TEXT NOT NULL DEFAULT '',
            vale_ponto BOOLEAN NOT NULL DEFAULT TRUE,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);

        await pool.query(`ALTER TABLE trabalhos ADD COLUMN IF NOT EXISTS titulo TEXT`);
        await pool.query(`ALTER TABLE trabalhos ADD COLUMN IF NOT EXISTS materia TEXT`);
        await pool.query(`ALTER TABLE trabalhos ADD COLUMN IF NOT EXISTS prazo TEXT`);
        await pool.query(`ALTER TABLE trabalhos ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT ''`);
        await pool.query(`ALTER TABLE trabalhos ADD COLUMN IF NOT EXISTS vale_ponto BOOLEAN DEFAULT TRUE`);
        await pool.query(`ALTER TABLE trabalhos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW()`);
        await pool.query(`ALTER TABLE trabalhos ALTER COLUMN prazo DROP NOT NULL`);
        await pool.query(`ALTER TABLE trabalhos ALTER COLUMN descricao SET DEFAULT ''`);
        await pool.query(`ALTER TABLE trabalhos ALTER COLUMN vale_ponto SET DEFAULT TRUE`);
        await pool.query(`ALTER TABLE trabalhos ALTER COLUMN criado_em SET DEFAULT NOW()`);
        await pool.query(`CREATE TABLE IF NOT EXISTS trabalho_equipes (
            id SERIAL PRIMARY KEY,
            trabalho_id INTEGER NOT NULL REFERENCES trabalhos(id) ON DELETE CASCADE,
            tema TEXT NOT NULL,
            integrantes TEXT NOT NULL DEFAULT '',
            criado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
    })();
    tabelaPronta.catch(e => console.error("Erro ao preparar tabela de trabalhos:", e));

    app.get("/api/trabalhos", exigirLogin, async (req, res) => {
        try {
            await tabelaPronta;
            const usuario = await usuarioAtual(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            let resultado;
            if (usuario.tipo === "admin" && req.query.turmaId != null) {
                const turmaId = Number(req.query.turmaId);
                if (!Number.isSafeInteger(turmaId) || turmaId <= 0) return res.status(400).json({ sucesso: false, mensagem: "Turma inválida." });
                resultado = await pool.query('SELECT id, titulo, materia, prazo, descricao, vale_ponto, criado_em, turma_id AS "turmaId" FROM trabalhos WHERE turma_id = $1 ORDER BY prazo ASC NULLS LAST, id DESC', [turmaId]);
            } else if (usuario.tipo === "admin") {
                resultado = await pool.query('SELECT id, titulo, materia, prazo, descricao, vale_ponto, criado_em, turma_id AS "turmaId" FROM trabalhos ORDER BY prazo ASC NULLS LAST, id DESC');
            } else {
                if (!usuario.turma_id) return res.status(403).json({ sucesso: false, mensagem: "Sua conta não está vinculada a uma turma." });
                resultado = await pool.query('SELECT id, titulo, materia, prazo, descricao, vale_ponto, criado_em, turma_id AS "turmaId" FROM trabalhos WHERE turma_id = $1 ORDER BY prazo ASC NULLS LAST, id DESC', [usuario.turma_id]);
            }
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, trabalhos: resultado.rows });
        } catch (e) {
            console.error("Erro ao buscar trabalhos:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar trabalhos." });
        }
    });

    app.get("/api/trabalhos/:id/equipes", exigirLogin, async (req, res) => {
        try {
            await tabelaPronta;
            const usuario = await usuarioAtual(req);
            const id = Number(req.params.id);
            if (!usuario || !Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Trabalho inválido." });
            const trabalho = usuario.tipo === "admin"
                ? await pool.query("SELECT id FROM trabalhos WHERE id = $1", [id])
                : await pool.query("SELECT id FROM trabalhos WHERE id = $1 AND turma_id = $2", [id, usuario.turma_id]);
            if (!trabalho.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Trabalho não encontrado nesta turma." });
            const equipes = await pool.query("SELECT id, tema, integrantes, criado_em FROM trabalho_equipes WHERE trabalho_id = $1 ORDER BY id", [id]);
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, equipes: equipes.rows });
        } catch (e) {
            console.error("Erro ao buscar equipes do trabalho:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar equipes." });
        }
    });

    app.post("/api/trabalhos/:id/equipes", exigirLogin, async (req, res) => {
        try {
            await tabelaPronta;
            const usuario = await usuarioAtual(req);
            const id = Number(req.params.id);
            if (!usuario || !Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Trabalho inválido." });
            const tema = String(req.body.tema || "").trim();
            const integrantes = String(req.body.integrantes || "").trim();
            if (!tema || !integrantes) return res.status(400).json({ sucesso: false, mensagem: "Preencha o tema e os integrantes da equipe." });
            if (tema.length > 160 || integrantes.length > 1000) return res.status(400).json({ sucesso: false, mensagem: "Tema ou integrantes ultrapassaram o limite permitido." });
            const trabalho = usuario.tipo === "admin"
                ? await pool.query("SELECT id FROM trabalhos WHERE id = $1", [id])
                : await pool.query("SELECT id FROM trabalhos WHERE id = $1 AND turma_id = $2", [id, usuario.turma_id]);
            if (!trabalho.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Trabalho não encontrado nesta turma." });
            const resultado = await pool.query("INSERT INTO trabalho_equipes (trabalho_id, tema, integrantes, criado_por) VALUES ($1, $2, $3, $4) RETURNING id, tema, integrantes, criado_em", [id, tema, integrantes, usuario.id]);
            res.status(201).json({ sucesso: true, equipe: resultado.rows[0] });
        } catch (e) {
            console.error("Erro ao criar equipe do trabalho:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao criar equipe." });
        }
    });

    app.post("/api/trabalhos", exigirGestor, async (req, res) => {
        try {
            await tabelaPronta;
            const titulo = String(req.body.titulo || "").trim();
            const materia = String(req.body.materia || "").trim();
            const prazo = req.body.prazo ? String(req.body.prazo).slice(0, 10) : null;
            const descricao = String(req.body.descricao || "").trim();
            const valePonto = req.body.vale_ponto !== false;

            if (!titulo || !materia) return res.status(400).json({ sucesso: false, mensagem: "Preencha título e matéria." });
            if (titulo.length > 160 || materia.length > 80 || descricao.length > 1000) return res.status(400).json({ sucesso: false, mensagem: "Um dos campos ultrapassou o limite permitido." });
            const usuario = await usuarioAtual(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            let turmaId = Number(usuario.turma_id);
            if (usuario.tipo === "admin") {
                if (req.body.turmaId == null || req.body.turmaId === "") {
                    const t = await pool.query("SELECT id FROM turmas WHERE ativa = TRUE ORDER BY id LIMIT 1");
                    if (!t.rowCount) return res.status(400).json({ sucesso: false, mensagem: "Crie uma turma ativa antes de adicionar trabalhos." });
                    turmaId = Number(t.rows[0].id);
                } else turmaId = Number(req.body.turmaId);
            }
            if (!Number.isSafeInteger(turmaId) || turmaId <= 0) return res.status(400).json({ sucesso: false, mensagem: "Selecione uma turma válida." });
            const turma = await pool.query("SELECT id FROM turmas WHERE id = $1 AND ativa = TRUE", [turmaId]);
            if (!turma.rowCount) return res.status(400).json({ sucesso: false, mensagem: "A turma não existe ou está inativa." });

            const resultado = await pool.query(
                `INSERT INTO trabalhos (titulo, materia, prazo, descricao, vale_ponto, turma_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, titulo, materia, prazo, descricao, vale_ponto, criado_em, turma_id AS "turmaId"`,
                [titulo, materia, prazo, descricao, valePonto, turmaId]
            );
            await pool.query("INSERT INTO auditoria_turmas (ator_usuario_id, turma_id, acao, entidade, entidade_id, detalhes) VALUES ($1, $2, 'trabalho_criado', 'trabalho', $3, $4::jsonb)", [usuario.id, turmaId, String(resultado.rows[0].id), JSON.stringify({ titulo, materia })]).catch(e => console.error("[AUDITORIA TURMAS] Falha ao registrar trabalho:", e));
            res.status(201).json({ sucesso: true, trabalho: resultado.rows[0] });
        } catch (e) {
            console.error("Erro ao criar trabalho:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao criar trabalho." });
        }
    });

    app.put("/api/trabalhos/:id", exigirGestor, async (req, res) => {
        try {
            await tabelaPronta;
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
            const titulo = String(req.body.titulo || "").trim();
            const materia = String(req.body.materia || "").trim();
            const prazo = req.body.prazo ? String(req.body.prazo).slice(0, 10) : null;
            const descricao = String(req.body.descricao || "").trim();
            const valePonto = req.body.vale_ponto !== false;
            if (!titulo || !materia) return res.status(400).json({ sucesso: false, mensagem: "Preencha título e matéria." });
            if (titulo.length > 160 || materia.length > 80 || descricao.length > 1000) return res.status(400).json({ sucesso: false, mensagem: "Um dos campos ultrapassou o limite permitido." });
            const usuario = await usuarioAtual(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            const params = [titulo, materia, prazo, descricao, valePonto, id];
            let sql = 'UPDATE trabalhos SET titulo = $1, materia = $2, prazo = $3, descricao = $4, vale_ponto = $5 WHERE id = $6';
            if (usuario.tipo !== "admin") { sql += " AND turma_id = $7"; params.push(usuario.turma_id); }
            sql += ' RETURNING id, titulo, materia, prazo, descricao, vale_ponto, criado_em, turma_id AS "turmaId"';
            const resultado = await pool.query(sql, params);
            if (!resultado.rows.length) return res.status(404).json({ sucesso: false, mensagem: "Trabalho não encontrado nesta turma." });
            await pool.query("INSERT INTO auditoria_turmas (ator_usuario_id, turma_id, acao, entidade, entidade_id, detalhes) VALUES ($1, $2, 'trabalho_atualizado', 'trabalho', $3, $4::jsonb)", [usuario.id, resultado.rows[0].turmaId, String(id), JSON.stringify({ titulo, materia })]).catch(e => console.error("[AUDITORIA TURMAS] Falha ao registrar trabalho:", e));
            res.json({ sucesso: true, trabalho: resultado.rows[0] });
        } catch (e) {
            console.error("Erro ao editar trabalho:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao editar trabalho." });
        }
    });

    app.delete("/api/trabalhos/:id", exigirGestor, async (req, res) => {
        try {
            await tabelaPronta;
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
            const usuario = await usuarioAtual(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            const resultado = usuario.tipo === "admin"
                ? await pool.query("DELETE FROM trabalhos WHERE id = $1 RETURNING id, turma_id", [id])
                : await pool.query("DELETE FROM trabalhos WHERE id = $1 AND turma_id = $2 RETURNING id, turma_id", [id, usuario.turma_id]);
            if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Trabalho não encontrado nesta turma." });
            await pool.query("INSERT INTO auditoria_turmas (ator_usuario_id, turma_id, acao, entidade, entidade_id) VALUES ($1, $2, 'trabalho_excluido', 'trabalho', $3)", [usuario.id, resultado.rows[0].turma_id, String(id)]).catch(e => console.error("[AUDITORIA TURMAS] Falha ao registrar exclusão:", e));
            res.json({ sucesso: true, mensagem: "Trabalho excluído com sucesso." });
        } catch (e) {
            console.error("Erro ao excluir trabalho:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir trabalho." });
        }
    });

    console.log("API de trabalhos instalada.");
};
