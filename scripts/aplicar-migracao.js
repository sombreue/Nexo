require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    console.error("ERRO: configure DATABASE_URL antes de aplicar a migração.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});

async function aplicar() {
    const cliente = await pool.connect();

    try {
        for (const nome of ["001_multi_turmas.sql", "002_expec_por_turma.sql"]) {
            const arquivo = path.join(__dirname, "..", "migrations", nome);
            const sql = fs.readFileSync(arquivo, "utf8");
            console.log(`[MIGRAÇÃO] Aplicando ${nome}...`);
            await cliente.query(sql);
        }
        const resultado = await cliente.query(`
            SELECT
                (SELECT COUNT(*)::int FROM turmas) AS turmas,
                (SELECT COUNT(*)::int FROM usuarios) AS usuarios,
                (SELECT COUNT(*)::int FROM tarefas) AS tarefas,
                (SELECT COUNT(*)::int FROM trabalhos) AS trabalhos,
                (SELECT COUNT(*)::int FROM feira_equipes) AS "equipesExpec",
                (SELECT COUNT(*)::int FROM feira_decoracoes) AS "decoracoesExpec"
        `);
        console.log("[MIGRAÇÃO] Concluída. Resumo do banco:");
        console.table(resultado.rows[0]);
    } catch (erro) {
        console.error("[MIGRAÇÃO] Falha; confira o erro abaixo. A transação da migração será revertida quando possível.");
        console.error(erro);
        process.exitCode = 1;
    } finally {
        cliente.release();
        await pool.end();
    }
}

aplicar();
