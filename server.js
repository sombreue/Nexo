require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`[START] Iniciando servidor | NODE_ENV=${process.env.NODE_ENV || "development"} | PORT=${PORT}`);

// O Render fica atrás de um proxy HTTPS. Confiar no primeiro proxy permite
// que express-session reconheça a conexão original como HTTPS e envie o
// cookie de sessão com Secure corretamente.
app.set("trust proxy", 1);

app.use(express.json({ limit: "300kb" }));
app.use(express.urlencoded({ extended: true }));

if (!process.env.DATABASE_URL) {
    console.error("ERRO: DATABASE_URL não foi encontrada.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const sessionMaxAge = 1000 * 60 * 60 * 24;

class PostgresSessionStore extends session.Store {
    constructor(pool, maxAge) {
        super();
        this.pool = pool;
        this.maxAge = maxAge;

        this.limpeza = setInterval(() => {
            this.pool.query("DELETE FROM sessoes WHERE expires_at <= NOW()")
                .catch(erro => console.error("Erro ao limpar sessões expiradas:", erro));
        }, 60 * 60 * 1000);

        this.limpeza.unref?.();
    }

    get(sid, callback) {
        this.pool.query("SELECT sess FROM sessoes WHERE sid = $1 AND expires_at > NOW()", [sid])
            .then(r => callback(null, r.rows[0]?.sess ?? null))
            .catch(callback);
    }

    set(sid, sess, callback) {
        const expiresAt = new Date(Date.now() + this.maxAge);
        this.pool.query(
            "INSERT INTO sessoes (sid, sess, expires_at) VALUES ($1, $2::jsonb, $3) ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expires_at = EXCLUDED.expires_at",
            [sid, JSON.stringify(sess), expiresAt]
        ).then(() => callback?.(null)).catch(erro => callback?.(erro));
    }

    destroy(sid, callback) {
        this.pool.query("DELETE FROM sessoes WHERE sid = $1", [sid])
            .then(() => callback?.(null)).catch(erro => callback?.(erro));
    }

    touch(sid, sess, callback) {
        const expiresAt = new Date(Date.now() + this.maxAge);
        this.pool.query("UPDATE sessoes SET expires_at = $1, sess = $2::jsonb WHERE sid = $3", [expiresAt, JSON.stringify(sess), sid])
            .then(() => callback?.(null)).catch(erro => callback?.(erro));
    }
}


pool.query("SELECT NOW()")
    .then(() => console.log("POSTGRESQL CONECTADO!"))
    .catch(erro => console.error("Erro ao conectar ao PostgreSQL:", erro));

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    console.error("ERRO: SESSION_SECRET não foi configurada em produção.");
    process.exit(1);
}

app.use(session({
    store: new PostgresSessionStore(pool, sessionMaxAge),
    secret: process.env.SESSION_SECRET || "desenvolvimento-apenas",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: sessionMaxAge,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));

app.get("/favicon.ico", (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.sendFile(path.join(__dirname, "public", "imagens", "favicon.ico"));
});

// A EXPEC pode ser desativada pelo administrador. Quando estiver inativa,
// usuários comuns não conseguem acessá-la nem diretamente pelo endereço.
// Administradores continuam podendo entrar para reativá-la.
app.get("/expec.html", async (req, res, next) => {
    try {
        if (!req.session?.usuario) return res.redirect("/login.html");

        const resultado = await pool.query("SELECT ativa FROM feira_config WHERE id = 1");
        const ativa = resultado.rows[0]?.ativa ?? false;

        if (!ativa && req.session.usuario.tipo !== "admin") {
            return res.redirect("/");
        }

        res.sendFile(path.join(__dirname, "public", "expec.html"));
    } catch (erro) {
        console.error("Erro ao verificar acesso à EXPEC:", erro);
        return res.redirect("/");
    }
});

app.get("/admin-panel.html", (req, res) => {
    if (!req.session?.usuario) return res.redirect("/login.html");
    if (req.session.usuario.tipo !== "admin") return res.redirect("/");
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    });
    res.sendFile(path.join(__dirname, "public", "admin-panel.html"));
});

app.use(express.static("public", { index: false }));

app.get("/", (req, res) => {
    if (!req.session.usuario) return res.redirect("/login.html");

    // No celular, a página inicial é o Hoje; no PC, é o Início.
    // O detector considera apenas telefones, evitando tratar tablets como celular.
    const userAgent = String(req.headers["user-agent"] || "");
    const celular = /Mobi|Android.*Mobile|iPhone|iPod/i.test(userAgent);
    // O administrador global começa pela página de seleção de turmas.
    if (req.session.usuario.tipo === "admin") {
        return res.sendFile(path.join(__dirname, "public", "admin-index.html"));
    }

    const paginaInicial = celular ? "hoje.html" : "index.html";
    res.sendFile(path.join(__dirname, "public", paginaInicial));
});

async function criarTabelas() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sessoes (
            sid TEXT PRIMARY KEY,
            sess JSONB NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        );
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS sessoes_expires_at_idx ON sessoes (expires_at);
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            usuario TEXT NOT NULL UNIQUE,
            senha TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'usuario'))
        );
    `);


    await pool.query(`
        CREATE TABLE IF NOT EXISTS planilhas (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            nome VARCHAR(100) NOT NULL,
            colunas JSONB NOT NULL DEFAULT '["Coluna 1", "Coluna 2"]'::jsonb,
            linhas JSONB NOT NULL DEFAULT '[]'::jsonb,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS planilhas_usuario_idx
        ON planilhas (usuario_id, atualizado_em DESC);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS temas_personalizados (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            nome VARCHAR(30) NOT NULL,
            cores VARCHAR(160) NOT NULL,
            logo_data TEXT,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS temas_personalizados_usuario_idx
        ON temas_personalizados (usuario_id);
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas (
            id SERIAL PRIMARY KEY,
            data TEXT NOT NULL,
            materia TEXT NOT NULL,
            descricao TEXT NOT NULL DEFAULT '',
            subtitulo TEXT,
            data_entrega TEXT
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS feira_equipes (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            tema TEXT NOT NULL,
            professor TEXT,
            integrantes TEXT
        );
    `);
    await pool.query(`ALTER TABLE feira_equipes ADD COLUMN IF NOT EXISTS lider TEXT;`);
    await pool.query(`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS data_entrega TEXT;`);
    await pool.query(`ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS subtitulo TEXT;`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS feira_config (
            id SERIAL PRIMARY KEY,
            data_apresentacao TIMESTAMP NOT NULL
        );
    `);
    await pool.query(`ALTER TABLE feira_config ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT FALSE;`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS feira_membros (
            id SERIAL PRIMARY KEY,
            equipe_id INTEGER NOT NULL REFERENCES feira_equipes(id) ON DELETE CASCADE,
            nome TEXT NOT NULL
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS feira_decoracoes (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            preco NUMERIC(10,2) NOT NULL DEFAULT 0,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
}

function exigirLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({ sucesso: false, mensagem: "Você precisa estar logado." });
    }
    next();
}

function exigirAdmin(req, res, next) {
    if (!req.session.usuario || req.session.usuario.tipo !== "admin") {
        return res.status(403).json({ sucesso: false, mensagem: "Acesso permitido apenas para administradores." });
    }
    next();
}

app.post("/api/login", async (req, res) => {
    const usuarioInformado = typeof req.body?.usuario === "string" ? req.body.usuario : "";
    console.log(`[LOGIN] Tentativa | Usuário: ${usuarioInformado || "(vazio)"}`);

    try {
        const { usuario, senha } = req.body;
        if (!usuario || !senha) {
            console.log(`[LOGIN] FALHA | Usuário: ${usuarioInformado || "(vazio)"} | Motivo: campos obrigatórios ausentes`);
            return res.status(400).json({ sucesso: false, mensagem: "Preencha usuário e senha." });
        }

        const resultado = await pool.query(
            "SELECT id, usuario, senha, tipo FROM usuarios WHERE usuario = $1",
            [usuario]
        );
        if (!resultado.rows.length) {
            console.log(`[LOGIN] FALHA | Usuário: ${usuarioInformado} | Motivo: usuário não encontrado`);
            return res.status(401).json({ sucesso: false, mensagem: "Usuário ou senha incorretos." });
        }

        const usuarioBanco = resultado.rows[0];
        if (!(await bcrypt.compare(senha, usuarioBanco.senha))) {
            console.log(`[LOGIN] FALHA | Usuário: ${usuarioBanco.usuario} | Motivo: senha incorreta`);
            return res.status(401).json({ sucesso: false, mensagem: "Usuário ou senha incorretos." });
        }

        req.session.usuario = {
            id: usuarioBanco.id,
            usuario: usuarioBanco.usuario,
            tipo: usuarioBanco.tipo
        };

        req.session.save(erroSessao => {
            if (erroSessao) {
                console.error("Erro ao salvar sessão de login:", erroSessao);
                return res.status(500).json({ sucesso: false, mensagem: "Não foi possível manter a sessão de login." });
            }

            const tipoLog = usuarioBanco.tipo === "admin" ? "ADM" : "USER";
            console.log(`[LOGIN] SUCESSO | Usuário: ${usuarioBanco.usuario} | Tipo: ${tipoLog}`);
            res.json({ sucesso: true, tipo: usuarioBanco.tipo });
        });
    } catch (erro) {
        console.error("Erro no login:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ sucesso: true }));
});

app.get("/api/usuario", exigirLogin, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ sucesso: true, usuario: req.session.usuario });
});

app.get("/api/sessao", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!req.session?.usuario) return res.json({ logado: false, tipo: null, usuario: null });
    res.json({ logado: true, id: req.session.usuario.id, tipo: req.session.usuario.tipo, usuario: req.session.usuario, nomeUsuario: req.session.usuario.usuario });
});

require("./rotas-sugestoes-contas")(app, pool);
require("./turmas")(app, pool, exigirLogin, exigirAdmin);

// APIs individuais do aluno. Elas precisam ser registradas no processo real
// do Render; os antigos scripts fix-*.js não devem ser executados em runtime.
require("./calendario-pessoal")(app, pool, exigirLogin);
require("./tarefas-pessoais")(app, pool, exigirLogin);
require("./notas")(app, pool, exigirLogin);
require("./estudos")(app, pool, exigirLogin);
require("./sticky-notes")(app, pool, exigirLogin);
require("./fila-saidas")(app, pool, exigirLogin, exigirAdmin);
require("./roteiro-provas")(app, pool, exigirLogin, exigirAdmin);
require("./horario-turma")(app, pool, exigirLogin, exigirAdmin);
require("./materias")(app, pool, exigirLogin, exigirAdmin);
require("./notificacoes")(app, pool);

// =========================
// TEMAS PERSONALIZADOS
// =========================

const CORES_TEMA_VALIDAS = 8;
const MAX_TEMAS_POR_USUARIO = 3;
const MAX_LOGO_DATA = 180000;

function normalizarCoresTema(valor) {
    if (typeof valor !== "string") return null;
    const partes = valor.split(",");
    if (partes.length !== CORES_TEMA_VALIDAS) return null;

    const limpas = partes.map(cor => cor.trim().toLowerCase());
    if (limpas.some(cor => !/^[0-9a-f]{6}$/.test(cor))) return null;

    return limpas.join(",");
}

function validarNomeTema(nome) {
    return typeof nome === "string" &&
        nome.trim().length >= 1 &&
        nome.trim().length <= 30;
}

function validarLogoData(logoData) {
    if (logoData == null || logoData === "") return null;
    if (typeof logoData !== "string" || logoData.length > MAX_LOGO_DATA) return false;
    if (!/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logoData)) return false;
    return logoData;
}

app.get("/api/temas-personalizados", exigirLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nome, cores, logo_data AS "logoData"
             FROM temas_personalizados
             WHERE usuario_id = $1
             ORDER BY id ASC`,
            [req.session.usuario.id]
        );

        res.set("Cache-Control", "no-store");
        res.json({
            sucesso: true,
            temas: resultado.rows,
            limite: MAX_TEMAS_POR_USUARIO
        });
    } catch (erro) {
        console.error("Erro ao buscar temas personalizados:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar seus temas." });
    }
});

app.post("/api/temas-personalizados", exigirLogin, async (req, res) => {
    try {
        const usuarioId = req.session.usuario.id;
        const { nome, cores, logoData } = req.body || {};

        if (!validarNomeTema(nome)) {
            return res.status(400).json({ sucesso: false, mensagem: "O nome do tema deve ter entre 1 e 30 caracteres." });
        }

        const coresNormalizadas = normalizarCoresTema(cores);
        if (!coresNormalizadas) {
            return res.status(400).json({ sucesso: false, mensagem: "As cores do tema são inválidas." });
        }

        const logoNormalizada = validarLogoData(logoData);
        if (logoNormalizada === false) {
            return res.status(400).json({ sucesso: false, mensagem: "A logo é inválida ou grande demais." });
        }

        const cliente = await pool.connect();
        try {
            await cliente.query("BEGIN");
            // Impede duas criações simultâneas de ultrapassarem o limite de 3.
            await cliente.query("SELECT pg_advisory_xact_lock($1)", [usuarioId]);

            const quantidade = await cliente.query(
                "SELECT COUNT(*)::int AS total FROM temas_personalizados WHERE usuario_id = $1",
                [usuarioId]
            );

            if (quantidade.rows[0].total >= MAX_TEMAS_POR_USUARIO) {
                await cliente.query("ROLLBACK");
                return res.status(409).json({ sucesso: false, mensagem: "Você já atingiu o limite de 3 temas personalizados." });
            }

            const resultado = await cliente.query(
                `INSERT INTO temas_personalizados (usuario_id, nome, cores, logo_data)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, nome, cores, logo_data AS "logoData"`,
                [usuarioId, nome.trim(), coresNormalizadas, logoNormalizada]
            );

            await cliente.query("COMMIT");
            res.status(201).json({ sucesso: true, tema: resultado.rows[0] });
        } catch (erroTransacao) {
            await cliente.query("ROLLBACK").catch(() => {});
            throw erroTransacao;
        } finally {
            cliente.release();
        }
    } catch (erro) {
        console.error("Erro ao criar tema personalizado:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao salvar o tema." });
    }
});

app.put("/api/temas-personalizados/:id", exigirLogin, async (req, res) => {
    try {
        const usuarioId = req.session.usuario.id;
        const { nome, cores, logoData } = req.body || {};
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: "Tema inválido." });
        }
        if (!validarNomeTema(nome)) {
            return res.status(400).json({ sucesso: false, mensagem: "O nome do tema deve ter entre 1 e 30 caracteres." });
        }

        const coresNormalizadas = normalizarCoresTema(cores);
        if (!coresNormalizadas) {
            return res.status(400).json({ sucesso: false, mensagem: "As cores do tema são inválidas." });
        }

        const logoNormalizada = validarLogoData(logoData);
        if (logoNormalizada === false) {
            return res.status(400).json({ sucesso: false, mensagem: "A logo é inválida ou grande demais." });
        }

        const resultado = await pool.query(
            `UPDATE temas_personalizados
             SET nome = $1, cores = $2, logo_data = $3, atualizado_em = NOW()
             WHERE id = $4 AND usuario_id = $5
             RETURNING id, nome, cores, logo_data AS "logoData"`,
            [nome.trim(), coresNormalizadas, logoNormalizada, id, usuarioId]
        );

        if (!resultado.rows.length) {
            return res.status(404).json({ sucesso: false, mensagem: "Tema não encontrado." });
        }

        res.json({ sucesso: true, tema: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao editar tema personalizado:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao editar o tema." });
    }
});

app.delete("/api/temas-personalizados/:id", exigirLogin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: "Tema inválido." });
        }

        const resultado = await pool.query(
            "DELETE FROM temas_personalizados WHERE id = $1 AND usuario_id = $2",
            [id, req.session.usuario.id]
        );

        if (!resultado.rowCount) {
            return res.status(404).json({ sucesso: false, mensagem: "Tema não encontrado." });
        }

        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao excluir tema personalizado:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir o tema." });
    }
});

app.get("/api/tarefas", exigirLogin, async (req, res) => {
    try {
        const resultado = await pool.query("SELECT id, data, materia, descricao, subtitulo, data_entrega AS \"dataEntrega\" FROM tarefas ORDER BY data DESC, id DESC");
        res.json({ sucesso: true, tarefas: resultado.rows });
    } catch (erro) {
        console.error("Erro ao buscar tarefas:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar tarefas." });
    }
});

app.post("/api/tarefas", exigirAdmin, async (req, res) => {
    try {
        const { data, materia, descricao = "", subtitulo = "", dataEntrega = null } = req.body;
        const descricaoNormalizada = String(descricao ?? "").trim();
        const subtituloNormalizado = String(subtitulo ?? "").trim();
        if (!data || !materia || (!descricaoNormalizada && !subtituloNormalizado)) return res.status(400).json({ sucesso: false, mensagem: "Digite uma tarefa ou um subtítulo." });
        const entregaNormalizada = descricaoNormalizada ? (dataEntrega || data) : null;
        const resultado = await pool.query(
            "INSERT INTO tarefas (data, materia, descricao, subtitulo, data_entrega) VALUES ($1, $2, $3, $4, $5) RETURNING id, data, materia, descricao, subtitulo, data_entrega AS \"dataEntrega\"",
            [data, materia, descricaoNormalizada, subtituloNormalizado || null, entregaNormalizada]
        );
        res.json({ sucesso: true, tarefa: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao criar tarefa:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar tarefa." });
    }
});

app.put("/api/tarefas/:id", exigirAdmin, async (req, res) => {
    try {
        const { data, materia, descricao = "", subtitulo = "", dataEntrega = null } = req.body;
        const descricaoNormalizada = String(descricao ?? "").trim();
        const subtituloNormalizado = String(subtitulo ?? "").trim();

        if (!data || !materia || (!descricaoNormalizada && !subtituloNormalizado)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Digite uma tarefa ou um subtítulo."
            });
        }

        const entregaNormalizada = descricaoNormalizada ? (dataEntrega || data) : null;
        const resultado = await pool.query(
            `UPDATE tarefas
             SET data = $1, materia = $2, descricao = $3, subtitulo = $4, data_entrega = $5
             WHERE id = $6
             RETURNING id, data, materia, descricao, subtitulo, data_entrega AS \"dataEntrega\"`,
            [data, materia, descricaoNormalizada, subtituloNormalizado || null, entregaNormalizada, req.params.id]
        );

        if (!resultado.rows.length) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Tarefa não encontrada."
            });
        }

        res.json({
            sucesso: true,
            tarefa: resultado.rows[0]
        });
    } catch (erro) {
        console.error("Erro ao editar tarefa:", erro);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao editar tarefa."
        });
    }
});

app.delete("/api/tarefas/:id", exigirAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
        }
        const resultado = await pool.query("DELETE FROM tarefas WHERE id = $1", [id]);
        if (!resultado.rowCount) {
            return res.status(404).json({ sucesso: false, mensagem: "Tarefa não encontrada." });
        }
        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao excluir tarefa:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir tarefa." });
    }
});

app.get("/api/admin/usuarios", exigirAdmin, async (req, res) => {
    try {
        const resultado = await pool.query("SELECT id, usuario, tipo FROM usuarios ORDER BY id ASC");
        res.json({ sucesso: true, usuarios: resultado.rows, usuarioLogadoId: req.session.usuario.id });
    } catch (erro) {
        console.error("Erro ao listar usuários:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao listar usuários." });
    }
});

app.post("/api/admin/usuarios", exigirAdmin, async (req, res) => {
    try {
        const { usuario, senha, tipo = "usuario" } = req.body;
        if (!usuario || !senha) return res.status(400).json({ sucesso: false, mensagem: "Preencha usuário e senha." });
        if (!["admin", "usuario"].includes(tipo)) return res.status(400).json({ sucesso: false, mensagem: "Tipo de usuário inválido." });
        const senhaHash = await bcrypt.hash(senha, 10);
        const resultado = await pool.query(
            "INSERT INTO usuarios (usuario, senha, tipo) VALUES ($1, $2, $3) RETURNING id, usuario, tipo",
            [usuario, senhaHash, tipo]
        );
        res.json({ sucesso: true, usuario: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao criar usuário:", erro);
        if (erro.code === "23505") return res.status(409).json({ sucesso: false, mensagem: "Esse usuário já existe." });
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar usuário." });
    }
});

app.delete("/api/admin/usuarios/:id", exigirAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
        }

        if (id === req.session.usuario.id) {
            return res.status(400).json({ sucesso: false, mensagem: "Você não pode excluir sua própria conta." });
        }

        const usuarioAlvo = await pool.query("SELECT id, tipo FROM usuarios WHERE id = $1", [id]);
        if (!usuarioAlvo.rows.length) {
            return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado." });
        }

        // Ao excluir uma conta, encerra também todas as sessões dela.
        await pool.query("DELETE FROM sessoes WHERE sess->'usuario'->>'id' = $1::text", [String(id)]);
        await pool.query("DELETE FROM usuarios WHERE id = $1", [id]);
        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao excluir usuário:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir usuário." });
    }
});

app.put("/api/admin/usuarios/:id/senha", exigirAdmin, async (req, res) => {
    try {
        if (!req.body.senha) return res.status(400).json({ sucesso: false, mensagem: "Informe a nova senha." });
        const senhaHash = await bcrypt.hash(req.body.senha, 10);
        await pool.query("UPDATE usuarios SET senha = $1 WHERE id = $2", [senhaHash, req.params.id]);
        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao alterar senha:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao alterar senha." });
    }
});


// =========================
// ADMIN - SESSÕES REMOTAS
// =========================

app.get("/api/admin/sessoes", exigirAdmin, async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                sid,
                sess->'usuario'->>'usuario' AS usuario,
                sess->'usuario'->>'tipo' AS tipo,
                expires_at
            FROM sessoes
            WHERE expires_at > NOW()
              AND sess->'usuario' IS NOT NULL
            ORDER BY usuario ASC, expires_at DESC
        `);

        res.json({
            sucesso: true,
            sessoes: resultado.rows.map(sessao => ({
                sid: sessao.sid,
                usuario: sessao.usuario,
                tipo: sessao.tipo,
                expiraEm: sessao.expires_at,
                atual: sessao.sid === req.sessionID
            }))
        });
    } catch (erro) {
        console.error("Erro ao listar sessões:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao listar sessões." });
    }
});

app.delete("/api/admin/sessoes/:sid", exigirAdmin, async (req, res) => {
    try {
        const sid = String(req.params.sid || "");
        if (!sid) return res.status(400).json({ sucesso: false, mensagem: "Sessão inválida." });
        if (sid === req.sessionID) {
            return res.status(400).json({ sucesso: false, mensagem: "Você não pode encerrar a própria sessão por esta tela." });
        }

        const resultado = await pool.query("DELETE FROM sessoes WHERE sid = $1", [sid]);
        if (!resultado.rowCount) {
            return res.status(404).json({ sucesso: false, mensagem: "Sessão não encontrada ou já encerrada." });
        }

        res.json({ sucesso: true, mensagem: "Sessão encerrada remotamente." });
    } catch (erro) {
        console.error("Erro ao encerrar sessão remotamente:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao encerrar sessão." });
    }
});

// =========================
// EXPEC - CONTAGEM REGRESSIVA
// =========================

app.get("/api/feira/contagem", exigirLogin, async (req, res) => {
    try {
        await pool.query(`
            INSERT INTO feira_config (id, data_apresentacao, ativa)
            VALUES (1, '2026-09-13 08:00:00', true)
            ON CONFLICT (id) DO NOTHING
        `);
        const resultado = await pool.query(`
            SELECT id,
                   (to_char(data_apresentacao, 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00') AS data_apresentacao,
                   ativa
            FROM feira_config
            WHERE id = 1
        `);
        res.json({ sucesso: true, ...resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao buscar contagem da EXPEC:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar contagem." });
    }
});

app.put("/api/feira/contagem", exigirAdmin, async (req, res) => {
    try {
        const { data, ativa } = req.body;
        if (!data) return res.status(400).json({ sucesso: false, mensagem: "Informe a data da apresentação." });
        const dataLocal = String(data).slice(0, 16).replace("T", " ") + ":00";
        await pool.query(
            `INSERT INTO feira_config (id, data_apresentacao, ativa)
             VALUES (1, $1::timestamp, COALESCE($2, true))
             ON CONFLICT (id) DO UPDATE SET data_apresentacao = EXCLUDED.data_apresentacao, ativa = COALESCE($2, feira_config.ativa)`,
            [dataLocal, typeof ativa === "boolean" ? ativa : null]
        );
        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao atualizar contagem da EXPEC:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar contagem." });
    }
});

app.get("/api/feira/status", exigirLogin, async (req, res) => {
    try {
        const resultado = await pool.query("SELECT ativa FROM feira_config WHERE id = 1");
        res.json({ sucesso: true, ativa: resultado.rows[0]?.ativa ?? false });
    } catch (erro) {
        console.error("Erro ao buscar status da EXPEC:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar status." });
    }
});

app.put("/api/feira/status", exigirAdmin, async (req, res) => {
    try {
        const { ativa } = req.body;
        if (typeof ativa !== "boolean") return res.status(400).json({ sucesso: false, mensagem: "Status inválido." });
        await pool.query("UPDATE feira_config SET ativa = $1 WHERE id = 1", [ativa]);
        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao atualizar status da EXPEC:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar status." });
    }
});

app.get("/api/feira/equipes", exigirLogin, async (req, res) => {
    try {
        const resultado = await pool.query("SELECT id, nome, tema, professor, integrantes, lider FROM feira_equipes ORDER BY id ASC");
        res.json({ sucesso: true, equipes: resultado.rows });
    } catch (erro) {
        console.error("Erro ao buscar equipes:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar equipes." });
    }
});

app.post("/api/feira/equipes", exigirAdmin, async (req, res) => {
    try {
        const { nome, tema, professor = "", integrantes = "", lider = "" } = req.body;
        if (!nome || !tema) return res.status(400).json({ sucesso: false, mensagem: "Preencha nome e tema da equipe." });
        const resultado = await pool.query(
            "INSERT INTO feira_equipes (nome, tema, professor, integrantes, lider) VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, tema, professor, integrantes, lider",
            [nome, tema, professor, integrantes, lider]
        );
        res.json({ sucesso: true, equipe: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao criar equipe:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar equipe." });
    }
});

app.put("/api/feira/equipes/:id", exigirAdmin, async (req, res) => {
    try {
        const { nome, tema, professor = "", integrantes = "", lider = "" } = req.body;
        if (!nome || !tema) return res.status(400).json({ sucesso: false, mensagem: "Preencha nome e tema da equipe." });
        const resultado = await pool.query(
            "UPDATE feira_equipes SET nome = $1, tema = $2, professor = $3, integrantes = $4, lider = $5 WHERE id = $6 RETURNING id, nome, tema, professor, integrantes, lider",
            [nome, tema, professor, integrantes, lider, req.params.id]
        );
        if (!resultado.rows.length) return res.status(404).json({ sucesso: false, mensagem: "Equipe não encontrada." });
        res.json({ sucesso: true, equipe: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao editar equipe:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao editar equipe." });
    }
});

app.delete("/api/feira/equipes/:id", exigirAdmin, async (req, res) => {
    try {
        await pool.query("DELETE FROM feira_equipes WHERE id = $1", [req.params.id]);
        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao excluir equipe:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir equipe." });
    }
});

// =========================
// EXPEC - DECORAÇÕES
// =========================

app.get("/api/feira/decoracoes", exigirLogin, async (req, res) => {
    try {
        const resultado = await pool.query("SELECT id, nome, preco FROM feira_decoracoes ORDER BY id ASC");
        res.json({ sucesso: true, decoracoes: resultado.rows });
    } catch (erro) {
        console.error("Erro ao buscar decorações:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar decorações." });
    }
});

app.post("/api/feira/decoracoes", exigirAdmin, async (req, res) => {
    try {
        const nome = String(req.body.nome ?? req.body.descricao ?? "").trim();
        const preco = Number(req.body.preco ?? 0);
        if (!nome) return res.status(400).json({ sucesso: false, mensagem: "Informe a decoração." });
        if (!Number.isFinite(preco) || preco < 0) return res.status(400).json({ sucesso: false, mensagem: "Preço inválido." });
        const resultado = await pool.query(
            "INSERT INTO feira_decoracoes (nome, preco) VALUES ($1, $2) RETURNING id, nome, preco",
            [nome, preco]
        );
        res.status(201).json({ sucesso: true, decoracao: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao criar decoração:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao criar decoração." });
    }
});

app.put("/api/feira/decoracoes/:id", exigirAdmin, async (req, res) => {
    try {
        const nome = String(req.body.nome ?? req.body.descricao ?? "").trim();
        const preco = Number(req.body.preco ?? 0);
        if (!nome) return res.status(400).json({ sucesso: false, mensagem: "Informe a decoração." });
        if (!Number.isFinite(preco) || preco < 0) return res.status(400).json({ sucesso: false, mensagem: "Preço inválido." });
        const resultado = await pool.query(
            "UPDATE feira_decoracoes SET nome = $1, preco = $2, atualizado_em = NOW() WHERE id = $3 RETURNING id, nome, preco",
            [nome, preco, req.params.id]
        );
        if (!resultado.rows.length) return res.status(404).json({ sucesso: false, mensagem: "Decoração não encontrada." });
        res.json({ sucesso: true, decoracao: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao editar decoração:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao editar decoração." });
    }
});

app.delete("/api/feira/decoracoes/:id", exigirAdmin, async (req, res) => {
    try {
        const resultado = await pool.query("DELETE FROM feira_decoracoes WHERE id = $1", [req.params.id]);
        if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Decoração não encontrada." });
        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao excluir decoração:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir decoração." });
    }
});


/* =========================
   PLANILHAS PESSOAIS
========================= */
app.get("/api/planilhas", exigirLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nome, jsonb_array_length(colunas) AS total_colunas,
                    jsonb_array_length(linhas) AS total_linhas, atualizado_em
             FROM planilhas WHERE usuario_id = $1 ORDER BY atualizado_em DESC, id DESC`,
            [req.session.usuario.id]
        );
        res.json({ sucesso: true, planilhas: resultado.rows });
    } catch (erro) {
        console.error("Erro ao listar planilhas:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível carregar suas tabelas." });
    }
});

app.post("/api/planilhas", exigirLogin, async (req, res) => {
    try {
        const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
        if (!nome) return res.status(400).json({ sucesso: false, mensagem: "Dê um nome para a tabela." });
        if (nome.length > 100) return res.status(400).json({ sucesso: false, mensagem: "O nome pode ter no máximo 100 caracteres." });
        const resultado = await pool.query(
            "INSERT INTO planilhas (usuario_id, nome) VALUES ($1, $2) RETURNING id, nome",
            [req.session.usuario.id, nome]
        );
        res.status(201).json({ sucesso: true, planilha: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao criar planilha:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível criar a tabela." });
    }
});


app.get("/api/planilhas/:id", exigirLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT id, nome, colunas, linhas, atualizado_em FROM planilhas WHERE id = $1 AND usuario_id = $2",
            [req.params.id, req.session.usuario.id]
        );
        if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Tabela não encontrada ou você não tem acesso a ela." });
        res.json({ sucesso: true, planilha: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao abrir planilha:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível abrir esta tabela." });
    }
});

app.put("/api/planilhas/:id/dados", exigirLogin, async (req, res) => {
    try {
        const { colunas, linhas, nome } = req.body || {};
        if (!Array.isArray(colunas) || colunas.length < 1 || colunas.length > 40 ||
            !colunas.every(c => typeof c === "string" && c.trim().length > 0 && c.length <= 100)) {
            return res.status(400).json({ sucesso: false, mensagem: "A tabela precisa ter de 1 a 40 colunas, com nomes de até 100 caracteres." });
        }
        if (!Array.isArray(linhas) || linhas.length > 500 ||
            !linhas.every(l => Array.isArray(l) && l.length === colunas.length &&
                l.every(c => (typeof c === "string" || typeof c === "number") && String(c).length <= 2000))) {
            return res.status(400).json({ sucesso: false, mensagem: "Dados inválidos: limite de 500 linhas e 2.000 caracteres por célula." });
        }
        const nomeFinal = typeof nome === "string" ? nome.trim() : "";
        if (nomeFinal.length > 100) return res.status(400).json({ sucesso: false, mensagem: "O nome pode ter no máximo 100 caracteres." });
        const resultado = await pool.query(
            `UPDATE planilhas
             SET colunas = $1::jsonb, linhas = $2::jsonb,
                 nome = CASE WHEN $3 <> '' THEN $3 ELSE nome END,
                 atualizado_em = NOW()
             WHERE id = $4 AND usuario_id = $5
             RETURNING id, nome, colunas, linhas, atualizado_em`,
            [JSON.stringify(colunas.map(c => c.trim())), JSON.stringify(linhas.map(l => l.map(c => String(c ?? "")))), nomeFinal, req.params.id, req.session.usuario.id]
        );
        if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Tabela não encontrada ou você não tem acesso a ela." });
        res.json({ sucesso: true, planilha: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao salvar dados da planilha:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível salvar as alterações." });
    }
});

app.patch("/api/planilhas/:id", exigirLogin, async (req, res) => {
    try {
        const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
        if (!nome) return res.status(400).json({ sucesso: false, mensagem: "Informe um nome válido." });
        if (nome.length > 100) return res.status(400).json({ sucesso: false, mensagem: "O nome pode ter no máximo 100 caracteres." });
        const resultado = await pool.query(
            "UPDATE planilhas SET nome = $1, atualizado_em = NOW() WHERE id = $2 AND usuario_id = $3 RETURNING id, nome",
            [nome, req.params.id, req.session.usuario.id]
        );
        if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Tabela não encontrada." });
        res.json({ sucesso: true, planilha: resultado.rows[0] });
    } catch (erro) {
        console.error("Erro ao renomear planilha:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível renomear a tabela." });
    }
});

app.delete("/api/planilhas/:id", exigirLogin, async (req, res) => {
    try {
        const resultado = await pool.query(
            "DELETE FROM planilhas WHERE id = $1 AND usuario_id = $2",
            [req.params.id, req.session.usuario.id]
        );
        if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Tabela não encontrada." });
        res.json({ sucesso: true });
    } catch (erro) {
        console.error("Erro ao excluir planilha:", erro);
        res.status(500).json({ sucesso: false, mensagem: "Não foi possível excluir a tabela." });
    }
});

criarTabelas()
    .then(() => {
        console.log("[START] Tabelas verificadas/criadas. Iniciando Express...");
        app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
    })
    .catch(erro => {
        console.error("Erro ao criar tabelas:", erro);
        process.exit(1);
    });
