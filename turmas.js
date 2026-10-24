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
            const usuario = await usuarioAtual(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            const resultado = usuario.tipo === "admin"
                ? await pool.query("SELECT id, nome, ano_letivo AS \"anoLetivo\", ativa FROM turmas ORDER BY ativa DESC, ano_letivo DESC NULLS LAST, nome ASC")
                : await pool.query("SELECT id, nome, ano_letivo AS \"anoLetivo\", ativa FROM turmas WHERE id = $1", [usuario.turma_id]);
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, turmas: resultado.rows, turmaId: usuario.turma_id == null ? null : Number(usuario.turma_id) });
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

    // Rotas da agenda compartilhada. São registradas antes das rotas legadas
    // de server.js para que o isolamento por turma seja aplicado no servidor.
    async function usuarioAtual(req) {
        const r = await pool.query("SELECT id, usuario, tipo, turma_id FROM usuarios WHERE id = $1", [req.session.usuario.id]);
        return r.rows[0] || null;
    }

    async function turmaPermitida(req, res) {
        const u = await usuarioAtual(req);
        if (!u) {
            res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada. Entre novamente." });
            return null;
        }
        if (u.tipo === "admin") return { usuario: u, turmaId: null };
        if (!u.turma_id) {
            res.status(403).json({ sucesso: false, mensagem: "Sua conta não está vinculada a uma turma." });
            return null;
        }
        return { usuario: u, turmaId: Number(u.turma_id) };
    }

    app.get("/api/tarefas", exigirLogin, async (req, res) => {
        try {
            const contexto = await turmaPermitida(req, res);
            if (!contexto) return;
            const { usuario, turmaId } = contexto;
            if (usuario.tipo === "admin" && req.query.turmaId != null) {
                const id = Number(req.query.turmaId);
                if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Turma inválida." });
                const r = await pool.query('SELECT id, data, materia, descricao, subtitulo, data_entrega AS "dataEntrega", turma_id AS "turmaId" FROM tarefas WHERE turma_id = $1 ORDER BY data DESC, id DESC', [id]);
                return res.json({ sucesso: true, tarefas: r.rows });
            }
            const r = usuario.tipo === "admin"
                ? await pool.query('SELECT id, data, materia, descricao, subtitulo, data_entrega AS "dataEntrega", turma_id AS "turmaId" FROM tarefas ORDER BY data DESC, id DESC')
                : await pool.query('SELECT id, data, materia, descricao, subtitulo, data_entrega AS "dataEntrega", turma_id AS "turmaId" FROM tarefas WHERE turma_id = $1 ORDER BY data DESC, id DESC', [turmaId]);
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, tarefas: r.rows });
        } catch (e) {
            console.error("Erro ao listar agenda por turma:", e);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível carregar a agenda da turma." });
        }
    });

    app.post("/api/tarefas", exigirLogin, async (req, res) => {
        try {
            const contexto = await turmaPermitida(req, res);
            if (!contexto) return;
            const { usuario } = contexto;
            if (!["admin", "representante"].includes(usuario.tipo)) {
                return res.status(403).json({ sucesso: false, mensagem: "Somente administradores e representantes podem alterar a agenda compartilhada." });
            }
            const data = typeof req.body?.data === "string" ? req.body.data.trim() : "";
            const materia = typeof req.body?.materia === "string" ? req.body.materia.trim() : "";
            const descricao = String(req.body?.descricao ?? "").trim();
            const subtitulo = String(req.body?.subtitulo ?? "").trim();
            if (!data || !materia || (!descricao && !subtitulo)) return res.status(400).json({ sucesso: false, mensagem: "Preencha data, matéria e uma tarefa ou subtítulo." });
            let turmaId = Number(usuario.turma_id);
            if (usuario.tipo === "admin") {
                if (req.body?.turmaId == null || req.body.turmaId === "") {
                    const padrao = await pool.query("SELECT id FROM turmas WHERE ativa = TRUE ORDER BY id ASC LIMIT 1");
                    if (!padrao.rowCount) return res.status(400).json({ sucesso: false, mensagem: "Crie uma turma ativa antes de adicionar tarefas." });
                    turmaId = Number(padrao.rows[0].id);
                } else {
                    turmaId = Number(req.body.turmaId);
                    if (!Number.isSafeInteger(turmaId) || turmaId <= 0) return res.status(400).json({ sucesso: false, mensagem: "Turma inválida." });
                }
            }
            const turma = await pool.query("SELECT id FROM turmas WHERE id = $1 AND ativa = TRUE", [turmaId]);
            if (!turma.rowCount) return res.status(400).json({ sucesso: false, mensagem: "A turma não existe ou está inativa." });
            const entrega = descricao ? (req.body?.dataEntrega || data) : null;
            const r = await pool.query('INSERT INTO tarefas (data, materia, descricao, subtitulo, data_entrega, turma_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, data, materia, descricao, subtitulo, data_entrega AS "dataEntrega", turma_id AS "turmaId"', [data, materia, descricao, subtitulo || null, entrega, turmaId]);
            await auditar(usuario.id, turmaId, "tarefa_criada", { entidadeId: r.rows[0].id, materia, data });
            res.status(201).json({ sucesso: true, tarefa: r.rows[0] });
        } catch (e) {
            console.error("Erro ao criar tarefa por turma:", e);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível criar a tarefa." });
        }
    });

    app.put("/api/tarefas/:id", exigirLogin, async (req, res) => {
        try {
            const contexto = await turmaPermitida(req, res);
            if (!contexto) return;
            const { usuario, turmaId: turmaDoUsuario } = contexto;
            if (!["admin", "representante"].includes(usuario.tipo)) return res.status(403).json({ sucesso: false, mensagem: "Você não pode alterar a agenda compartilhada." });
            const id = Number(req.params.id);
            const data = typeof req.body?.data === "string" ? req.body.data.trim() : "";
            const materia = typeof req.body?.materia === "string" ? req.body.materia.trim() : "";
            const descricao = String(req.body?.descricao ?? "").trim();
            const subtitulo = String(req.body?.subtitulo ?? "").trim();
            if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Tarefa inválida." });
            if (!data || !materia || (!descricao && !subtitulo)) return res.status(400).json({ sucesso: false, mensagem: "Preencha data, matéria e uma tarefa ou subtítulo." });
            const entrega = descricao ? (req.body?.dataEntrega || data) : null;
            const turmaAlvo = usuario.tipo === "representante" ? turmaDoUsuario : (req.body?.turmaId == null || req.body.turmaId === "" ? null : Number(req.body.turmaId));
            if (turmaAlvo !== null && (!Number.isSafeInteger(turmaAlvo) || turmaAlvo <= 0)) return res.status(400).json({ sucesso: false, mensagem: "Turma inválida." });
            const params = [data, materia, descricao, subtitulo || null, entrega, id];
            let sql = 'UPDATE tarefas SET data = $1, materia = $2, descricao = $3, subtitulo = $4, data_entrega = $5 WHERE id = $6';
            if (turmaAlvo !== null) { sql += " AND turma_id = $7"; params.push(turmaAlvo); }
            sql += ' RETURNING id, data, materia, descricao, subtitulo, data_entrega AS "dataEntrega", turma_id AS "turmaId"';
            const r = await pool.query(sql, params);
            if (!r.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Tarefa não encontrada nesta turma." });
            await auditar(usuario.id, r.rows[0].turmaId, "tarefa_atualizada", { entidadeId: id, materia, data });
            res.json({ sucesso: true, tarefa: r.rows[0] });
        } catch (e) {
            console.error("Erro ao editar tarefa por turma:", e);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível editar a tarefa." });
        }
    });

    app.delete("/api/tarefas/:id", exigirLogin, async (req, res) => {
        try {
            const contexto = await turmaPermitida(req, res);
            if (!contexto) return;
            const { usuario, turmaId } = contexto;
            if (!["admin", "representante"].includes(usuario.tipo)) return res.status(403).json({ sucesso: false, mensagem: "Você não pode excluir tarefas da agenda compartilhada." });
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Tarefa inválida." });
            const r = usuario.tipo === "admin"
                ? await pool.query("DELETE FROM tarefas WHERE id = $1 RETURNING id, turma_id", [id])
                : await pool.query("DELETE FROM tarefas WHERE id = $1 AND turma_id = $2 RETURNING id, turma_id", [id, turmaId]);
            if (!r.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Tarefa não encontrada nesta turma." });
            await auditar(usuario.id, r.rows[0].turma_id, "tarefa_excluida", { entidadeId: id });
            res.json({ sucesso: true });
        } catch (e) {
            console.error("Erro ao excluir tarefa por turma:", e);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível excluir a tarefa." });
        }
    });

    // O administrador cria contas com vínculo explícito à turma.
    app.get("/api/admin/usuarios", exigirAdmin, async (req, res) => {
        try {
            const r = await pool.query('SELECT u.id, u.usuario, u.tipo, u.turma_id AS "turmaId", t.nome AS "turmaNome" FROM usuarios u LEFT JOIN turmas t ON t.id = u.turma_id ORDER BY u.id ASC');
            res.json({ sucesso: true, usuarios: r.rows, usuarioLogadoId: req.session.usuario.id });
        } catch (e) {
            console.error("Erro ao listar usuários com turma:", e);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível listar usuários." });
        }
    });

    app.post("/api/admin/usuarios", exigirAdmin, async (req, res) => {
        try {
            const usuario = typeof req.body?.usuario === "string" ? req.body.usuario.trim() : "";
            const senha = typeof req.body?.senha === "string" ? req.body.senha : "";
            const tipo = req.body?.tipo || "usuario";
            if (usuario.length < 3 || usuario.length > 50 || senha.length < 4 || senha.length > 200) return res.status(400).json({ sucesso: false, mensagem: "Usuário deve ter 3–50 caracteres e senha 4–200 caracteres." });
            if (!["admin", "usuario", "representante"].includes(tipo)) return res.status(400).json({ sucesso: false, mensagem: "Tipo de conta inválido." });
            let turmaId = null;
            if (tipo !== "admin") {
                turmaId = Number(req.body?.turmaId);
                if (!Number.isSafeInteger(turmaId) || turmaId <= 0) return res.status(400).json({ sucesso: false, mensagem: "Selecione a turma desta conta." });
                const turma = await pool.query("SELECT id FROM turmas WHERE id = $1 AND ativa = TRUE", [turmaId]);
                if (!turma.rowCount) return res.status(400).json({ sucesso: false, mensagem: "A turma selecionada não existe ou está inativa." });
            }
            const bcrypt = require("bcrypt");
            const hash = await bcrypt.hash(senha, 10);
            const r = await pool.query('INSERT INTO usuarios (usuario, senha, tipo, turma_id) VALUES ($1, $2, $3, $4) RETURNING id, usuario, tipo, turma_id AS "turmaId"', [usuario, hash, tipo, turmaId]);
            await auditar(req.session.usuario.id, turmaId, "conta_criada", { usuario, tipo, entidadeId: r.rows[0].id });
            res.status(201).json({ sucesso: true, usuario: r.rows[0] });
        } catch (e) {
            if (e.code === "23505") return res.status(409).json({ sucesso: false, mensagem: e.constraint === "usuarios_representante_por_turma_uk" ? "Esta turma já tem um representante principal." : "Esse usuário já existe." });
            console.error("Erro ao criar conta com turma:", e);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível criar a conta." });
        }
    });
};
