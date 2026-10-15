/* Configuração compartilhada do horário da turma. */
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
            !valor.turma.trim() || valor.turma.trim().length > 60 ||
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

    async function garantirTabela() {
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
    }

    app.get("/api/horario-turma", exigirLogin, async (req, res) => {
        try {
            await garantirTabela();
            const resultado = await pool.query("SELECT configuracao, atualizado_em FROM horario_turma WHERE id = 1");
            res.set("Cache-Control", "no-store");
            res.json({ sucesso: true, configuracao: resultado.rows[0].configuracao, atualizadoEm: resultado.rows[0].atualizado_em });
        } catch (erro) {
            console.error("Erro ao carregar horário da turma:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível carregar o horário da turma." });
        }
    });

    app.put("/api/horario-turma", exigirAdmin, async (req, res) => {
        try {
            const configuracao = req.body?.configuracao;
            if (!validarConfiguracao(configuracao)) {
                return res.status(400).json({ sucesso: false, mensagem: "A configuração do horário é inválida. Confira os dias, períodos e horários." });
            }

            await garantirTabela();
            const resultado = await pool.query(
                `INSERT INTO horario_turma (id, configuracao, atualizado_em, atualizado_por)
                 VALUES (1, $1::jsonb, NOW(), $2)
                 ON CONFLICT (id) DO UPDATE SET configuracao = EXCLUDED.configuracao,
                    atualizado_em = NOW(), atualizado_por = EXCLUDED.atualizado_por
                 RETURNING configuracao, atualizado_em`,
                [JSON.stringify(configuracao), req.session.usuario.id]
            );
            res.json({ sucesso: true, configuracao: resultado.rows[0].configuracao, atualizadoEm: resultado.rows[0].atualizado_em });
        } catch (erro) {
            console.error("Erro ao salvar horário da turma:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Não foi possível salvar o horário da turma." });
        }
    });
};
