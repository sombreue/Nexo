-- Separa configuração e conteúdo da EXPEC por turma.
-- Dados legados são vinculados à turma mais antiga para não duplicá-los.

BEGIN;

ALTER TABLE feira_config ADD COLUMN IF NOT EXISTS turma_id BIGINT;
ALTER TABLE feira_equipes ADD COLUMN IF NOT EXISTS turma_id BIGINT;
ALTER TABLE feira_decoracoes ADD COLUMN IF NOT EXISTS turma_id BIGINT;
ALTER TABLE feira_membros ADD COLUMN IF NOT EXISTS turma_id BIGINT;

UPDATE feira_config
SET turma_id = (SELECT id FROM turmas ORDER BY id LIMIT 1)
WHERE turma_id IS NULL;

UPDATE feira_equipes
SET turma_id = (SELECT id FROM turmas ORDER BY id LIMIT 1)
WHERE turma_id IS NULL;

UPDATE feira_decoracoes
SET turma_id = (SELECT id FROM turmas ORDER BY id LIMIT 1)
WHERE turma_id IS NULL;

UPDATE feira_membros m
SET turma_id = e.turma_id
FROM feira_equipes e
WHERE m.equipe_id = e.id AND m.turma_id IS NULL;

ALTER TABLE feira_config ALTER COLUMN turma_id SET NOT NULL;
ALTER TABLE feira_equipes ALTER COLUMN turma_id SET NOT NULL;
ALTER TABLE feira_decoracoes ALTER COLUMN turma_id SET NOT NULL;
ALTER TABLE feira_membros ALTER COLUMN turma_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feira_config_turma_fk') THEN
        ALTER TABLE feira_config ADD CONSTRAINT feira_config_turma_fk
            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feira_equipes_turma_fk') THEN
        ALTER TABLE feira_equipes ADD CONSTRAINT feira_equipes_turma_fk
            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feira_decoracoes_turma_fk') THEN
        ALTER TABLE feira_decoracoes ADD CONSTRAINT feira_decoracoes_turma_fk
            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feira_membros_turma_fk') THEN
        ALTER TABLE feira_membros ADD CONSTRAINT feira_membros_turma_fk
            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feira_equipes_id_turma_uk') THEN
        ALTER TABLE feira_equipes ADD CONSTRAINT feira_equipes_id_turma_uk UNIQUE (id, turma_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feira_membros_equipe_turma_fk') THEN
        ALTER TABLE feira_membros ADD CONSTRAINT feira_membros_equipe_turma_fk
            FOREIGN KEY (equipe_id, turma_id) REFERENCES feira_equipes(id, turma_id) ON DELETE CASCADE;
    END IF;
END; $$;

CREATE UNIQUE INDEX IF NOT EXISTS feira_config_turma_uk ON feira_config (turma_id);
CREATE INDEX IF NOT EXISTS feira_equipes_turma_idx ON feira_equipes (turma_id, id);
CREATE INDEX IF NOT EXISTS feira_decoracoes_turma_idx ON feira_decoracoes (turma_id, id);
CREATE INDEX IF NOT EXISTS feira_membros_turma_equipe_idx ON feira_membros (turma_id, equipe_id);

INSERT INTO schema_migrations (versao)
VALUES ('002_expec_por_turma')
ON CONFLICT (versao) DO NOTHING;

COMMIT;
