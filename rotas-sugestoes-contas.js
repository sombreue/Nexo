const bcrypt = require("bcrypt");

module.exports = function instalarRotasSugestoesContas(app, pool) {
    function exigirLogin(req, res, next) {
        if (!req.session?.usuario) {
            return res.status(401).json({ sucesso: false, mensagem: "Você precisa estar logado." });
        }
        next();
    }

    function exigirAdmin(req, res, next) {
        if (!req.session?.usuario) {
            return res.status(401).json({ sucesso: false, mensagem: "Você precisa estar logado." });
        }
        if (req.session.usuario.tipo !== "admin") {
            return res.status(403).json({ sucesso: false, mensagem: "Acesso permitido somente para administradores." });
        }
        next();
    }

    const tabelaSugestoesPronta = pool.query(`
        CREATE TABLE IF NOT EXISTS sugestoes (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            sugestao TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'sugestao',
            data TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `).then(() => pool.query(`
        ALTER TABLE sugestoes ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'sugestao'
    `));

    const tabelaPedidosPronta = pool.query(`
        CREATE TABLE IF NOT EXISTS pedidos_conta (
            id SERIAL PRIMARY KEY,
            usuario TEXT NOT NULL,
            senha_hash TEXT NOT NULL,
            data TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    tabelaSugestoesPronta.catch(e => console.error("Erro ao preparar sugestões:", e));
    tabelaPedidosPronta.catch(e => console.error("Erro ao preparar pedidos de conta:", e));

    app.post("/api/sugestoes", exigirLogin, async (req, res) => {
        try {
            await tabelaSugestoesPronta;
            const nomeUsuario = String(req.session.usuario.usuario || "").trim();
            const sugestao = String(req.body.sugestao || "").trim();
            const tipo = String(req.body.tipo || "sugestao").trim();
            if (!nomeUsuario || !sugestao) return res.status(400).json({ sucesso: false, mensagem: "Não foi possível identificar seu usuário ou a mensagem está vazia." });
            if (!["sugestao", "bug"].includes(tipo)) return res.status(400).json({ sucesso: false, mensagem: "Tipo de envio inválido." });
            if (nomeUsuario.length > 80 || sugestao.length > 1000) return res.status(400).json({ sucesso: false, mensagem: "A mensagem ultrapassou o limite permitido." });
            await pool.query("INSERT INTO sugestoes (nome, sugestao, tipo) VALUES ($1, $2, $3)", [nomeUsuario, sugestao, tipo]);
            res.status(201).json({ sucesso: true, mensagem: "Enviado com sucesso!" });
        } catch (e) {
            console.error("Erro ao salvar sugestão:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
        }
    });

    app.get("/api/sugestoes", exigirAdmin, async (req, res) => {
        try {
            await tabelaSugestoesPronta;
            const resultado = await pool.query("SELECT id, nome, sugestao, tipo, data FROM sugestoes ORDER BY data DESC, id DESC");
            res.json({ sucesso: true, sugestoes: resultado.rows });
        } catch (e) {
            console.error("Erro ao carregar sugestões:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
        }
    });

    app.delete("/api/sugestoes/:id", exigirAdmin, async (req, res) => {
        try {
            await tabelaSugestoesPronta;
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
            const resultado = await pool.query("DELETE FROM sugestoes WHERE id = $1", [id]);
            if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Sugestão não encontrada." });
            res.json({ sucesso: true, mensagem: "Sugestão excluída com sucesso." });
        } catch (e) {
            console.error("Erro ao excluir sugestão:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
        }
    });

    app.post("/api/pedidos-conta", async (req, res) => {
        try {
            await tabelaPedidosPronta;
            const usuario = String(req.body.usuario || "").trim();
            const senha = String(req.body.senha || "");
            if (!usuario || !senha) return res.status(400).json({ sucesso: false, mensagem: "Preencha usuário e senha." });
            if (usuario.length < 3) return res.status(400).json({ sucesso: false, mensagem: "O usuário precisa ter pelo menos 3 caracteres." });
            if (usuario.length > 50) return res.status(400).json({ sucesso: false, mensagem: "O usuário é muito longo." });
            if (senha.length < 4) return res.status(400).json({ sucesso: false, mensagem: "A senha precisa ter pelo menos 4 caracteres." });
            if (senha.length > 200) return res.status(400).json({ sucesso: false, mensagem: "A senha é muito longa." });
            const existente = await pool.query("SELECT id FROM usuarios WHERE LOWER(usuario) = LOWER($1)", [usuario]);
            if (existente.rows.length) return res.status(409).json({ sucesso: false, mensagem: "Esse usuário já existe." });
            const pedido = await pool.query("SELECT id FROM pedidos_conta WHERE LOWER(usuario) = LOWER($1)", [usuario]);
            if (pedido.rows.length) return res.status(409).json({ sucesso: false, mensagem: "Já existe um pedido pendente para esse usuário." });
            const senhaHash = await bcrypt.hash(senha, 10);
            await pool.query("INSERT INTO pedidos_conta (usuario, senha_hash) VALUES ($1, $2)", [usuario, senhaHash]);
            res.status(201).json({ sucesso: true, mensagem: "Pedido enviado! Aguarde a aprovação do administrador." });
        } catch (e) {
            console.error("Erro ao criar pedido de conta:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
        }
    });

    app.get("/api/pedidos-conta", exigirAdmin, async (req, res) => {
        try {
            await tabelaPedidosPronta;
            const resultado = await pool.query("SELECT id, usuario, data FROM pedidos_conta ORDER BY data ASC, id ASC");
            res.json({ sucesso: true, pedidos: resultado.rows });
        } catch (e) {
            console.error("Erro ao carregar pedidos de conta:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
        }
    });

    app.post("/api/pedidos-conta/:id/aceitar", exigirAdmin, async (req, res) => {
        try {
            await tabelaPedidosPronta;
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
            const pedido = await pool.query("SELECT id, usuario, senha_hash FROM pedidos_conta WHERE id = $1", [id]);
            if (!pedido.rows.length) return res.status(404).json({ sucesso: false, mensagem: "Pedido não encontrado." });
            const dados = pedido.rows[0];
            const existente = await pool.query("SELECT id FROM usuarios WHERE LOWER(usuario) = LOWER($1)", [dados.usuario]);
            if (existente.rows.length) {
                await pool.query("DELETE FROM pedidos_conta WHERE id = $1", [id]);
                return res.status(409).json({ sucesso: false, mensagem: "Esse usuário já existe. O pedido foi removido." });
            }
            const turmaPadrao = await pool.query("SELECT id FROM turmas WHERE ativa = TRUE ORDER BY id ASC LIMIT 1");
            if (!turmaPadrao.rowCount) return res.status(409).json({ sucesso: false, mensagem: "Crie uma turma ativa antes de aprovar contas." });
            await pool.query(
                "INSERT INTO usuarios (usuario, senha, tipo, turma_id) VALUES ($1, $2, 'usuario', $3)",
                [dados.usuario, dados.senha_hash, turmaPadrao.rows[0].id]
            );
            await pool.query("DELETE FROM pedidos_conta WHERE id = $1", [id]);
            res.json({ sucesso: true, mensagem: `Conta de ${dados.usuario} aprovada.` });
        } catch (e) {
            console.error("Erro ao aceitar pedido de conta:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
        }
    });

    app.delete("/api/pedidos-conta/:id", exigirAdmin, async (req, res) => {
        try {
            await tabelaPedidosPronta;
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
            const resultado = await pool.query("DELETE FROM pedidos_conta WHERE id = $1", [id]);
            if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Pedido não encontrado." });
            res.json({ sucesso: true, mensagem: "Pedido recusado." });
        } catch (e) {
            console.error("Erro ao recusar pedido de conta:", e);
            res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
        }
    });

    // A API de trabalhos é carregada por este módulo porque o Render inicia
    // diretamente o server.js e todas as rotas precisam ser registradas nele.
    require("./rotas-trabalhos")(app, pool);

    // Compatibilidade com páginas antigas.
    app.get("/api/sessao", (req, res) => {
        res.set("Cache-Control", "no-store");
        if (!req.session?.usuario) return res.json({ logado: false, tipo: null, usuario: null });
        res.json({ logado: true, tipo: req.session.usuario.tipo, usuario: req.session.usuario });
    });

    console.log("APIs de sugestões, pedidos de conta, trabalhos e sessão instaladas.");
};
