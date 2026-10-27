# Remover a EXPEC

## Arquivos e código

1. Remova links e botões que levem a `/expec.html`.
2. Em `server.js`, remova a rota `GET /expec.html`, as rotas `/api/feira/*` e a criação/alteração das tabelas `feira_*` em `criarTabelas()`.
3. Remova `public/expec.html`, `public/expec-logica.js` e `public/expec-tema-claro-correcao.css`.
4. Remova somente as regras específicas da EXPEC em `public/agenda-estilos.css` e `public/agenda-tema-claro-correcao.css`. Esses arquivos também são usados pela agenda.

## Dados do banco

A remoção do código não apaga os dados. Se as tabelas também precisarem ser removidas, faça backup e execute:

```sql
DROP TABLE IF EXISTS feira_membros;
DROP TABLE IF EXISTS feira_decoracoes;
DROP TABLE IF EXISTS feira_equipes;
DROP TABLE IF EXISTS feira_config;
```
