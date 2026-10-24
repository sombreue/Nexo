/* Horário padrão e configurações isoladas por turma. */
module.exports = function registrarRotasHorarioTurma(app, pool, exigirLogin, exigirAdmin) {
    const PADRAO = {
        turma: "8º B",
        dias: [
            { id: 1, nome: "Segunda" },
            { id: 2, nome: "Terça" },
            { id: 3, nome: "Quarta" },
            { id: 4, nome: "Quinta" },
            { id: 5, nome: "Sexta" }
        ],
        periodos: [
            { inicio: "07:00", fim: "07:50", tipo: "aula", materias: ["Ciências", "Redação", "Ed. Física", "Gramática", "Geografia"] },
            { inicio: "07:50", fim: "08:40", tipo: "aula", materias: ["Português", "Redação", "Ed. Física", "História", "Física"] },
            { inicio: "08:40", fim: "09:30", tipo: "aula", materias: ["Matemática", "Bilíngue", "Socioemocional", "História", "Geografia"] },
            { inicio: "09:30", fim: "09:50", tipo: "intervalo", materias: ["", "", "", "", ""] },
            { inicio: "09:50", fim: "10:40", tipo: "aula", materias: ["Português", "Artes", "Literatura", "Matemática", "Física"] },
            { inicio: "10:40", fim: "11:30", tipo: "aula", materias: ["Matemática", "Matemática", "Matemática", "Bilíngue", "Gramática"] },
            { inicio: "11:30", fim: "12:20", tipo: "aula", materias: ["", "Robótica", "", "Química", "Ciências"] }
        ]
    };

    function validarConfiguracao(valor) {
        if (!valor || typeof valor !== "object" || typeof valor.turma !== "string" ||
            !valor.turma.trim() || valor.turma.trim().length > 100 ||
            !Array.isArray(valor.dias) || valor.dias.length < 1 || valor.dias.length > 7 ||
            !Array.isArray(valor.periodos) || valor.periodos.length < 1 || valor.periodos.length > 16) return false;

        const ids = new Set();
        for (const dia of valor.dias) {
            if (!dia || !Number.isInteger(dia.id) || dia.id < 0 || dia.id > 6 ||
                typeof dia.nome !== "string" || !dia.nome.trim() || dia.nome.trim().length > 30 ||
                ids.has(dia.id)) return false;
            ids.add(dia.id);
        }

        return valor.periodos.every(periodo => {
            if (!periodo || !/^([01]\d|2[0-3]):[0-5]\d$/.test(periodo.inicio) ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(periodo.fim) ||
                periodo.inicio >= periodo.fim || !["aula", "intervalo"].includes(periodo.tipo) ||
                !Array.isArray(periodo.materias) || periodo.materias.length !== valor.dias.length) return false;
            return periodo.materias.every(materia => typeof materia === "string" && materia.length <= 80);
        });
    }

    async function garantirTabelas() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS horario_turma (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                configuracao JSONB NOT NULL,
                atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                atualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
            )
        `);
        await pool.query(
            "INSERT INTO horario_turma (id, configuracao) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING",
            [JSON.stringify(PADRAO)]
        );
        await pool.query(`
            CREATE TABLE IF NOT EXISTS horarios_turmas (
                turma_id BIGINT PRIMARY KEY REFERENCES turmas(id) ON DELETE CASCADE,
                configuracao JSONB NOT NULL,
                atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                atualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
            )
        `);
        // Migra o horário legado somente para a turma geral (menor ID).
        // As turmas secundárias nunca herdam essa configuração.
        await pool.query(`
            INSERT INTO horarios_turmas (turma_id, configuracao, atualizado_em, atualizado_por)
            SELECT t.id, h.configuracao, h.atualizado_em, h.atualizado_por
            FROM turmas t
            CROSS JOIN horario_turma h
            WHERE t.id = (SELECT id FROM turmas ORDER BY id ASC LIMIT 1)
              AND h.id = 1
              AND NOT EXISTS (SELECT 1 FROM horarios_turmas ht WHERE ht.turma_id = t.id)
            ON CONFLICT (turma_id) DO NOTHING
        `);
    }

    async function obterUsuario(req) {
        const r = await pool.query(
            "SELECT u.id, u.tipo, u.turma_id, t.nome AS turma_nome, t.ativa AS turma_ativa FROM usuarios u LEFT JOIN turmas t ON t.id = u.turma_id WHERE u.id = $1",
            [req.session.usuario.id]
        );
        return r.rows[0] || null;
    }

    app.get("/api/horario-turma", exigirLogin, async (req, res) => {
        try {
            await garantirTabelas();
            const usuario = await obterUsuario(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });

            if (usuario.tipo !== "admin" && !usuario.turma_id) {
                return res.status(403).json({ sucesso: false, mensagem: "Sua conta não está vinculada a uma turma." });
            }

            let resultado;
            if (usuario.tipo === "admin" && req.query.turmaId != null) {
                const turmaId = Number(req.query.turmaId);
                if (!Number.isSafeInteger(turmaId) || turmaId <= 0) return res.status(400).json({ sucesso: false, mensagem: "Turma inválida." });
                const turma = await pool.query("SELECT id, nome FROM turmas WHERE id = $1", [turmaId]);
                if (!turma.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Turma não encontrada." });
                resultado = await pool.query("SELECT configuracao, atualizado_em FROM horarios_turmas WHERE turma_id = $1", [turmaId]);
                if (!resultado.rowCount) return res.json({ sucesso: true, configuracao: null, semConfiguracao: true, turma: turma.rows[0].nome });
            } else if (usuario.tipo === "admin") {
                resultado = await pool.query("SELECT configuracao, atualizado_em FROM horario_turma WHERE id = 1");
            } else {
                resultado = await pool.query("SELECT configuracao, atualizado_em FROM horarios_turmas WHERE turma_id = $1", [usuario.turma_id]);
                if (!resultado.rowCount) return res.json({ sucesso: true, configuracao: null, semConfiguracao: true, turma: usuario.turma_nome || "Minha turma" });
            }

            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, configuracao: resultado.rows[0].configuracao, atualizadoEm: resultado.rows[0].atualizado_em });
        } catch (erro) {
            console.error("Erro ao carregar horário da turma:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível carregar o horário da turma." });
        }
    });

    app.put("/api/horario-turma", exigirLogin, async (req, res) => {
        try {
            const usuario = await obterUsuario(req);
            if (!usuario) return res.status(401).json({ sucesso: false, mensagem: "Conta não encontrada." });
            if (!["admin", "representante"].includes(usuario.tipo)) {
                return res.status(403).json({ sucesso: false, mensagem: "Somente o administrador ou o representante da turma pode editar o horário." });
            }
            if (usuario.tipo === "representante" && (!usuario.turma_id || !usuario.turma_ativa)) {
                return res.status(403).json({ sucesso: false, mensagem: "Sua conta não está vinculada a uma turma ativa." });
            }

            const configuracao = req.body?.configuracao;
            if (!validarConfiguracao(configuracao)) {
                return res.status(400).json({ sucesso: false, mensagem: "A configuração do horário é inválida. Confira os dias, períodos e horários." });
            }

            await garantirTabelas();
            let resultado;
            const turmaAlvoAdmin = usuario.tipo === "admin" && req.body?.turmaId != null && req.body.turmaId !== ""
                ? Number(req.body.turmaId) : null;
            if (usuario.tipo === "admin" && turmaAlvoAdmin !== null) {
                if (!Number.isSafeInteger(turmaAlvoAdmin) || turmaAlvoAdmin <= 0) return res.status(400).json({ sucesso: false, mensagem: "Turma inválida." });
                const turma = await pool.query("SELECT id, nome FROM turmas WHERE id = $1", [turmaAlvoAdmin]);
                if (!turma.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Turma não encontrada." });
                const configuracaoDaTurma = { ...configuracao, turma: turma.rows[0].nome };
                resultado = await pool.query(
                    `INSERT INTO horarios_turmas (turma_id, configuracao, atualizado_em, atualizado_por)
                     VALUES ($1, $2::jsonb, NOW(), $3)
                     ON CONFLICT (turma_id) DO UPDATE SET configuracao = EXCLUDED.configuracao,
                        atualizado_em = NOW(), atualizado_por = EXCLUDED.atualizado_por
                     RETURNING configuracao, atualizado_em`,
                    [turmaAlvoAdmin, JSON.stringify(configuracaoDaTurma), usuario.id]
                );
            } else if (usuario.tipo === "representante") {
                const configuracaoDaTurma = { ...configuracao, turma: usuario.turma_nome || configuracao.turma };
                resultado = await pool.query(
                    `INSERT INTO horarios_turmas (turma_id, configuracao, atualizado_em, atualizado_por)
                     VALUES ($1, $2::jsonb, NOW(), $3)
                     ON CONFLICT (turma_id) DO UPDATE SET configuracao = EXCLUDED.configuracao,
                        atualizado_em = NOW(), atualizado_por = EXCLUDED.atualizado_por
                     RETURNING configuracao, atualizado_em`,
                    [usuario.turma_id, JSON.stringify(configuracaoDaTurma), usuario.id]
                );
            } else {
                resultado = await pool.query(
                    `INSERT INTO horario_turma (id, configuracao, atualizado_em, atualizado_por)
                     VALUES (1, $1::jsonb, NOW(), $2)
                     ON CONFLICT (id) DO UPDATE SET configuracao = EXCLUDED.configuracao,
                        atualizado_em = NOW(), atualizado_por = EXCLUDED.atualizado_por
                     RETURNING configuracao, atualizado_em`,
                    [JSON.stringify(configuracao), usuario.id]
                );
            }
            res.json({ sucesso: true, configuracao: resultado.rows[0].configuracao, atualizadoEm: resultado.rows[0].atualizado_em });
        } catch (erro) {
            console.error("Erro ao salvar horário da turma:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível salvar o horário da turma." });
        }
    });
};
