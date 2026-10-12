module.exports = function registrarProvas(app, pool, exigirLogin, exigirAdmin) {
    const tabelaPronta = pool.query(`
        CREATE TABLE IF NOT EXISTS roteiro_provas (
            id SERIAL PRIMARY KEY,
            materia VARCHAR(80) NOT NULL,
            data_prova DATE NOT NULL,
            conteudo TEXT NOT NULL DEFAULT '',
            etapa SMALLINT NOT NULL DEFAULT 1 CHECK (etapa BETWEEN 1 AND 4),
            tipo VARCHAR(12) NOT NULL DEFAULT 'parcial' CHECK (tipo IN ('parcial', 'bimestral')),
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS roteiro_provas_data_idx ON roteiro_provas (data_prova);
    `);

    const migracaoColunas = tabelaPronta.then(() => pool.query(`
        ALTER TABLE roteiro_provas ADD COLUMN IF NOT EXISTS etapa SMALLINT NOT NULL DEFAULT 1;
        ALTER TABLE roteiro_provas ADD COLUMN IF NOT EXISTS tipo VARCHAR(12) NOT NULL DEFAULT 'parcial';
        CREATE INDEX IF NOT EXISTS roteiro_provas_etapa_tipo_idx ON roteiro_provas (etapa, tipo, data_prova);
    `));

    function validar(body) {
        const materia = typeof body?.materia === 'string' ? body.materia.trim() : '';
        const data = typeof body?.data_prova === 'string' ? body.data_prova : '';
        const conteudo = typeof body?.conteudo === 'string' ? body.conteudo.trim() : '';
        const etapa = Number(body?.etapa);
        const tipo = typeof body?.tipo === 'string' ? body.tipo : '';
        if (!materia || materia.length > 80) return { erro: 'Informe uma matéria válida.' };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data + 'T00:00:00Z'))) return { erro: 'Informe uma data válida.' };
        if (!Number.isInteger(etapa) || etapa < 1 || etapa > 4) return { erro: 'Selecione uma etapa válida (1 a 4).' };
        if (!['parcial', 'bimestral'].includes(tipo)) return { erro: 'Selecione se a prova é parcial ou bimestral.' };
        if (conteudo.length > 10000) return { erro: 'O conteúdo deve ter no máximo 10.000 caracteres.' };
        return { materia, data, conteudo, etapa, tipo };
    }

    // O roteiro é único para a turma: todos os usuários autenticados podem consultar.
    app.get('/api/roteiro-provas', exigirLogin, async (req, res) => {
        try {
            await migracaoColunas;
            const r = await pool.query(`
                SELECT id, materia, TO_CHAR(data_prova, 'YYYY-MM-DD') AS data_prova,
                       conteudo, etapa, tipo, criado_em, atualizado_em
                FROM roteiro_provas ORDER BY etapa ASC, CASE tipo WHEN 'parcial' THEN 1 ELSE 2 END, data_prova ASC, materia ASC, id ASC
            `);
            res.set('Cache-Control', 'no-store');
            res.json({ sucesso: true, provas: r.rows, podeEditar: req.session.usuario.tipo === 'admin' });
        } catch (e) {
            console.error('Erro ao consultar roteiro de provas:', e);
            res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar o roteiro de provas.' });
        }
    });

    app.post('/api/roteiro-provas', exigirLogin, exigirAdmin, async (req, res) => {
        try {
            await tabelaPronta;
            const d = validar(req.body);
            if (d.erro) return res.status(400).json({ sucesso: false, mensagem: d.erro });
            const r = await pool.query(`
                INSERT INTO roteiro_provas (materia, data_prova, conteudo, etapa, tipo)
                VALUES ($1,$2,$3,$4,$5)
                RETURNING id, materia, TO_CHAR(data_prova, 'YYYY-MM-DD') AS data_prova, conteudo, etapa, tipo
            `, [d.materia, d.data, d.conteudo, d.etapa, d.tipo]);
            res.status(201).json({ sucesso: true, prova: r.rows[0] });
        } catch (e) {
            console.error('Erro ao adicionar prova:', e);
            res.status(500).json({ sucesso: false, mensagem: 'Não foi possível salvar a prova.' });
        }
    });

    app.put('/api/roteiro-provas/:id', exigirLogin, exigirAdmin, async (req, res) => {
        try {
            await tabelaPronta;
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: 'Prova inválida.' });
            const d = validar(req.body);
            if (d.erro) return res.status(400).json({ sucesso: false, mensagem: d.erro });
            const r = await pool.query(`
                UPDATE roteiro_provas SET materia=$1, data_prova=$2, conteudo=$3, etapa=$4, tipo=$5, atualizado_em=NOW()
                WHERE id=$6
                RETURNING id, materia, TO_CHAR(data_prova, 'YYYY-MM-DD') AS data_prova, conteudo, etapa, tipo
            `, [d.materia, d.data, d.conteudo, d.etapa, d.tipo, id]);
            if (!r.rowCount) return res.status(404).json({ sucesso: false, mensagem: 'Prova não encontrada.' });
            res.json({ sucesso: true, prova: r.rows[0] });
        } catch (e) {
            console.error('Erro ao editar prova:', e);
            res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar a prova.' });
        }
    });

    app.delete('/api/roteiro-provas/:id', exigirLogin, exigirAdmin, async (req, res) => {
        try {
            await tabelaPronta;
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: 'Prova inválida.' });
            const r = await pool.query('DELETE FROM roteiro_provas WHERE id=$1 RETURNING id', [id]);
            if (!r.rowCount) return res.status(404).json({ sucesso: false, mensagem: 'Prova não encontrada.' });
            res.json({ sucesso: true });
        } catch (e) {
            console.error('Erro ao excluir prova:', e);
            res.status(500).json({ sucesso: false, mensagem: 'Não foi possível excluir a prova.' });
        }
    });
};
