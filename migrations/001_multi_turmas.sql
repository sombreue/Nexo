-- Nexo: base de dados para suporte a múltiplas turmas
-- Executar uma vez no PostgreSQL/Neon, preferencialmente após backup.
-- Esta migração é transacional e idempotente para permitir reexecução segura.

BEGIN;

CREATE TABLE IF NOT EXISTS turmas (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ano_letivo SMALLINT,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT turmas_nome_ano_uk UNIQUE (nome, ano_letivo)
);

-- Garante uma turma de compatibilidade para os dados que já existem.
INSERT INTO turmas (nome, ano_letivo, ativa)
SELECT 'Turma geral', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM turmas);

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS turma_id BIGINT;

-- Troca a restrição antiga ('admin', 'usuario') pela lista ampliada.
DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'usuarios'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%tipo%'
    LOOP
        EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', c.conname);
    END LOOP;
END; $$;

UPDATE usuarios
SET tipo = 'usuario'
WHERE tipo NOT IN ('admin', 'usuario', 'representante');

ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_tipo_check
    CHECK (tipo IN ('admin', 'usuario', 'representante'));

-- Vincula contas antigas à turma geral sem alterar senhas, IDs ou sessões.
UPDATE usuarios
SET turma_id = (SELECT id FROM turmas ORDER BY id LIMIT 1)
WHERE tipo <> 'admin' AND turma_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'usuarios_turma_fk'
          AND conrelid = 'usuarios'::regclass
    ) THEN
        ALTER TABLE usuarios
            ADD CONSTRAINT usuarios_turma_fk
            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE RESTRICT;
    END IF;
END; $$;

-- Administradores são globais; contas comuns e representantes precisam de turma.
ALTER TABLE usuarios
    DROP CONSTRAINT IF EXISTS usuarios_turma_tipo_check;

ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_turma_tipo_check
    CHECK (
        (tipo = 'admin')
        OR
        (tipo IN ('usuario', 'representante') AND turma_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS usuarios_turma_idx ON usuarios (turma_id, tipo);

-- Uma turma pode ter no máximo um representante principal.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_representante_por_turma_uk
    ON usuarios (turma_id)
    WHERE tipo = 'representante';

-- Agenda coletiva: todos os registros existentes ficam na turma geral.
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS turma_id BIGINT;

UPDATE tarefas
SET turma_id = (SELECT id FROM turmas ORDER BY id LIMIT 1)
WHERE turma_id IS NULL;

ALTER TABLE tarefas
    ALTER COLUMN turma_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tarefas_turma_fk'
          AND conrelid = 'tarefas'::regclass
    ) THEN
        ALTER TABLE tarefas
            ADD CONSTRAINT tarefas_turma_fk
            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE RESTRICT;
    END IF;
END; $$;

CREATE INDEX IF NOT EXISTS tarefas_turma_data_idx
    ON tarefas (turma_id, data DESC, id DESC);

-- Trabalhos e pesquisas coletivos também precisam pertencer a uma turma.
CREATE TABLE IF NOT EXISTS trabalhos (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    materia TEXT NOT NULL,
    prazo TEXT,
    descricao TEXT NOT NULL DEFAULT '',
    vale_ponto BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE trabalhos ADD COLUMN IF NOT EXISTS turma_id BIGINT;

UPDATE trabalhos
SET turma_id = (SELECT id FROM turmas ORDER BY id LIMIT 1)
WHERE turma_id IS NULL;

ALTER TABLE trabalhos
    ALTER COLUMN turma_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'trabalhos_turma_fk'
          AND conrelid = 'trabalhos'::regclass
    ) THEN
        ALTER TABLE trabalhos
            ADD CONSTRAINT trabalhos_turma_fk
            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE RESTRICT;
    END IF;
END; $$;

CREATE INDEX IF NOT EXISTS trabalhos_turma_prazo_idx
    ON trabalhos (turma_id, prazo, id DESC);

-- Catálogo de matérias por turma. O catálogo global atual pode continuar
-- servindo como origem inicial; a cópia por turma permite personalização futura.
CREATE TABLE IF NOT EXISTS turma_materias (
    id BIGSERIAL PRIMARY KEY,
    turma_id BIGINT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT turma_materias_nome_uk UNIQUE (turma_id, nome)
);

CREATE INDEX IF NOT EXISTS turma_materias_turma_idx
    ON turma_materias (turma_id, ativa, nome);

-- Registro mínimo de auditoria para ações administrativas e alterações na agenda.
CREATE TABLE IF NOT EXISTS auditoria_turmas (
    id BIGSERIAL PRIMARY KEY,
    ator_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    turma_id BIGINT REFERENCES turmas(id) ON DELETE SET NULL,
    acao VARCHAR(80) NOT NULL,
    entidade VARCHAR(80) NOT NULL,
    entidade_id TEXT,
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auditoria_turmas_data_idx
    ON auditoria_turmas (criada_em DESC);

CREATE INDEX IF NOT EXISTS auditoria_turmas_turma_data_idx
    ON auditoria_turmas (turma_id, criada_em DESC);

-- Controle simples de migrações aplicadas.
CREATE TABLE IF NOT EXISTS schema_migrations (
    versao VARCHAR(120) PRIMARY KEY,
    aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (versao)
VALUES ('001_multi_turmas')
ON CONFLICT (versao) DO NOTHING;

COMMIT;
