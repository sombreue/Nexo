# Nexo — Guia de instalação e hospedagem própria

Este guia explica como criar e manter sua própria instalação independente do Nexo. Você encontrará instruções para configurar o ambiente local, conectar um banco PostgreSQL, criar o primeiro administrador, publicar o site, personalizar os arquivos e resolver problemas comuns.

O Nexo é uma aplicação web de organização escolar e estudos, desenvolvida com Node.js, Express e PostgreSQL. Cada instalação independente deve ter seu próprio repositório, banco de dados, credenciais, contas de usuário e endereço público.

> **Importante:** as instruções foram preparadas com base na estrutura atual do repositório. Como o código e os serviços de hospedagem podem mudar, confira o `package.json`, o `.env.example` e os logs do servidor se algo estiver diferente.

## Sumário

1. [Requisitos](#1-requisitos)
2. [Criar seu próprio repositório](#2-criar-seu-próprio-repositório)
3. [Instalar as ferramentas](#3-instalar-as-ferramentas)
4. [Baixar o projeto](#4-baixar-o-projeto)
5. [Configurar as variáveis de ambiente](#5-configurar-as-variáveis-de-ambiente)
6. [Criar um banco PostgreSQL](#6-criar-um-banco-postgresql)
7. [Inicializar o banco e executar o Nexo](#7-inicializar-o-banco-e-executar-o-nexo)
8. [Criar o primeiro administrador](#8-criar-o-primeiro-administrador)
9. [Publicar no Render](#9-publicar-no-render)
10. [Personalizar a instalação](#10-personalizar-a-instalação)
11. [Atualizações e backups](#11-atualizações-e-backups)
12. [Migrar dados antigos do SQLite](#12-migrar-dados-antigos-do-sqlite)
13. [Solução de problemas](#13-solução-de-problemas)
14. [Segurança e privacidade](#14-segurança-e-privacidade)
15. [Checklist final](#15-checklist-final)

## 1. Requisitos

Você precisará de:

- Uma conta no GitHub para armazenar seu código.
- Git para baixar e gerenciar o repositório.
- Node.js e npm para executar a aplicação.
- Um banco de dados PostgreSQL.
- Um serviço de hospedagem caso queira deixar o site acessível pela internet.

O `package.json` atual declara dependências como Express, `pg` (cliente PostgreSQL), `express-session`, `bcrypt`, `dotenv` e `better-sqlite3`.

Serviços que você pode usar (são exemplos, não requisitos obrigatórios):

- GitHub para hospedar o código.
- Neon ou outro provedor PostgreSQL.
- Render ou outro serviço compatível com Node.js.

Verifique se Git e Node.js estão instalados:

```bash
git --version
node --version
npm --version
```

Use uma versão LTS do Node.js compatível com as dependências. Atualmente, o repositório não fixa uma versão exata do Node.js no `package.json`.

## 2. Criar seu próprio repositório

Repositório original: [github.com/sombreue/Nexo](https://github.com/sombreue/Nexo)

Você pode escolher uma destas opções.

### Opção A — Fazer um fork

1. Abra o repositório original no GitHub.
2. Clique em **Fork** e selecione sua conta.
3. Crie o fork.

Um fork mantém a relação com o projeto original, o que facilita comparar e incorporar atualizações futuras.

### Opção B — Criar um repositório independente

1. Crie um repositório novo e vazio na sua conta do GitHub.
2. Clone o repositório original seguindo a próxima seção.
3. Troque o endereço remoto pelo endereço do seu repositório e envie o código.

Depois de clonar, por exemplo:

```bash
git remote set-url origin SUA_URL_DO_NOVO_REPOSITORIO
git push -u origin main
```

Substitua o marcador pela URL real do seu repositório. Confira a branch atual com `git branch --show-current`. Se não for `main`, use no comando o nome informado.

Um repositório independente não recebe automaticamente as atualizações do original.

## 3. Instalar as ferramentas

Instale Git, Node.js e npm seguindo as instruções oficiais de cada ferramenta. Um editor como o Visual Studio Code é recomendado, mas não obrigatório.

Após instalar, abra um terminal novo e execute os comandos de verificação da Seção 1.

## 4. Baixar o projeto

Abra um terminal na pasta em que deseja armazenar o projeto:

```bash
git clone https://github.com/sombreue/Nexo.git
cd Nexo
```

Se você criou um fork, use a URL do seu fork.

Instale as dependências:

```bash
npm install
```

O `package.json` atual define `npm start` como comando de inicialização. Não há um comando separado de desenvolvimento definido no momento.

Para abrir a pasta no Visual Studio Code, você pode usar:

```bash
code .
```

Se o comando `code` não funcionar, abra a pasta pela interface do editor.

## 5. Configurar as variáveis de ambiente

O repositório contém o arquivo `.env.example`. Copie-o para criar um arquivo local chamado `.env`.

No PowerShell do Windows:

```powershell
Copy-Item .env.example .env
```

No macOS ou Linux:

```bash
cp .env.example .env
```

Configure as variáveis abaixo no arquivo `.env`:

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | String de conexão do seu próprio banco PostgreSQL. Obrigatória. |
| `NODE_ENV` | Use `development` localmente e `production` quando publicar o site. |
| `PORT` | Porta HTTP local. A aplicação usa `3000` por padrão se a variável estiver ausente; a hospedagem pode fornecer outra porta. |
| `SESSION_SECRET` | Segredo usado para proteger as sessões. Obrigatório quando `NODE_ENV=production`. |

Exemplo:

```env
DATABASE_URL=SUA_STRING_DE_CONEXAO_POSTGRESQL
NODE_ENV=development
PORT=3000
SESSION_SECRET=SEU_SEGREDO_LONGO_E_ALEATORIO
```

Gere um segredo de sessão forte e exclusivo com Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para `SESSION_SECRET`. Não use o texto de exemplo literalmente.

O arquivo `.gitignore` já exclui `.env`, `node_modules/` e `database/`. Mantenha essa proteção e nunca envie credenciais ou segredos para o GitHub.

## 6. Criar um banco PostgreSQL

Crie um banco PostgreSQL novo no provedor de sua preferência. Se optar pelo Neon:

1. Crie um projeto.
2. Abra os detalhes de conexão.
3. Copie a string de conexão PostgreSQL.
4. Cole essa string no valor de `DATABASE_URL` do seu arquivo `.env`.

Cada instalação independente do Nexo deve usar seu próprio banco. Nunca conecte sua cópia ao banco de dados do projeto original.

O usuário PostgreSQL precisa ter permissão para criar e alterar as tabelas e os índices utilizados pela aplicação.

## 7. Inicializar o banco e executar o Nexo

Em uma instalação nova, **não é necessário executar `migrar.js`**. A inicialização normal do servidor cria ou verifica as tabelas necessárias à versão atual da aplicação.

Depois de configurar o `.env`, execute:

```bash
npm start
```

O comando executa `start.js`, que carrega as variáveis de ambiente e inicia `server.js`. Durante a inicialização, o servidor verifica a conexão com PostgreSQL e cria ou atualiza as tabelas previstas no código.

Aguarde as mensagens indicando que o PostgreSQL conectou, que a preparação das tabelas terminou e que o servidor está ouvindo em uma porta. Se ocorrer um erro, leia a mensagem completa do terminal.

Se estiver usando a porta local padrão, abra:

`http://localhost:3000`

Se definiu outro valor para `PORT`, use essa porta.

Confirme que a página abre e que não existem erros do servidor ou do banco antes de continuar.

## 8. Criar o primeiro administrador

Um banco recém-criado **não recebe automaticamente uma conta de administrador**. As rotas normais de gerenciamento de usuários exigem um administrador já autenticado. Por isso, é necessária uma etapa inicial única.

O script temporário abaixo cria uma conta de administrador diretamente no seu próprio banco PostgreSQL. Use-o apenas na sua instalação.

### 8.1 Inicie o servidor uma vez

Execute `npm start`, aguarde a criação das tabelas terminar e pare o servidor com `Ctrl+C`.

### 8.2 Crie um script temporário

Na raiz do projeto, crie um arquivo chamado `create-admin.js` e cole este código:

```javascript
require("dotenv").config();

const bcrypt = require("bcrypt");
const { Pool } = require("pg");

async function main() {
  const { DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

  if (!DATABASE_URL || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error("Set DATABASE_URL, ADMIN_USERNAME, and ADMIN_PASSWORD first.");
  }
  if (ADMIN_USERNAME.length < 3 || ADMIN_USERNAME.length > 50) {
    throw new Error("The administrator username must be 3–50 characters long.");
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("Use a password with at least 12 characters.");
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (usuario, senha, tipo)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (usuario) DO NOTHING
       RETURNING id, usuario, tipo`,
      [ADMIN_USERNAME, passwordHash]
    );

    if (result.rowCount === 0) {
      throw new Error("That username already exists; no account was changed.");
    }
    console.log("Administrator created:", result.rows[0].usuario);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error("Could not create administrator:", error.message);
  process.exitCode = 1;
});
```

### 8.3 Execute o script

No PowerShell do Windows, defina as credenciais apenas para a sessão atual do terminal:

```powershell
$env:ADMIN_USERNAME = "escolha-um-nome-de-administrador"
$env:ADMIN_PASSWORD = "use-uma-senha-exclusiva-com-pelo-menos-12-caracteres"
node create-admin.js
Remove-Item Env:ADMIN_USERNAME
Remove-Item Env:ADMIN_PASSWORD
```

Substitua os exemplos por seus próprios valores. Evite compartilhar o terminal enquanto a senha estiver visível no histórico de comandos. No macOS ou Linux, use `export ADMIN_USERNAME="..."`, `export ADMIN_PASSWORD="..."`, execute `node create-admin.js` e depois `unset ADMIN_USERNAME ADMIN_PASSWORD`.

O script gera um hash bcrypt da senha e não substitui uma conta já existente. Se o nome de usuário já existir, escolha outro ou investigue a conta existente usando uma ferramenta confiável.

### 8.4 Exclua o script temporário

Depois de confirmar que consegue entrar e abrir o painel administrativo, **exclua `create-admin.js`**. Não envie esse script ao repositório nem o publique na hospedagem.

Mantenha as credenciais administrativas privadas.

## 9. Publicar no Render

Estas instruções descrevem uma publicação típica no Render. A interface e os limites dos planos podem mudar; consulte o painel e a documentação atual do serviço.

1. Envie seu repositório ao GitHub.
2. Entre no Render e crie um **Web Service**.
3. Conecte seu repositório e selecione a branch de publicação.
4. Defina o comando de build como `npm install`.
5. Defina o comando de inicialização como `npm start`.
6. Adicione as variáveis de ambiente abaixo.
7. Faça o deploy e confira os logs de build e execução.

Configure estas variáveis de produção:

| Variável | Valor em produção |
| --- | --- |
| `DATABASE_URL` | String de conexão do seu próprio banco PostgreSQL. |
| `SESSION_SECRET` | Segredo aleatório forte e exclusivo. |
| `NODE_ENV` | `production` |
| `PORT` | Normalmente fornecida pela hospedagem; não fixe uma porta sem necessidade. |

Não envie o arquivo local `.env`. Cadastre cada valor nas configurações de ambiente do provedor.

O servidor usa a variável `PORT` da hospedagem quando disponível. Ele também configura a confiança no proxy do Express e ativa cookies de sessão seguros quando `NODE_ENV=production`.

Depois do deploy:

- Abra a URL pública fornecida pela hospedagem.
- Teste login e logout.
- Confira o painel administrativo.
- Teste as páginas principais que leem ou gravam dados.
- Verifique os logs de execução.
- Confirme que a aplicação está conectada ao seu próprio banco.

Um deploy concluído não garante que todos os recursos foram testados; faça essas verificações manualmente.

## 10. Personalizar a instalação

Você pode adaptar sua cópia às suas necessidades. Os locais comuns para revisar incluem:

- Identidade visual, títulos das páginas, logo e favicon na pasta `public/`.
- Páginas, folhas de estilo e JavaScript do navegador em `public/`.
- Rotas, autenticação e comportamento do banco em `server.js` e nos módulos de rotas.
- Dependências e comando de inicialização em `package.json`.
- Conexão com o banco e configurações de execução em `.env`.

O arquivo responsável por cada recurso pode mudar conforme o projeto evolui. Antes de editar, pesquise no código pelo nome da página, pelo texto, pela rota ou pelo ID do elemento.

Depois de alterar o código:

1. Teste localmente.
2. Confira o console do navegador e o terminal do servidor.
3. Registre as alterações em um commit do Git.
4. Envie as mudanças ao seu repositório.
5. Aguarde a nova publicação e teste o site online.

Se quer manter uma versão independente, faça as alterações no seu próprio repositório, não no original.

## 11. Atualizações e backups

### Atualizar o código

Se você mantém um fork, pode comparar sua cópia com o projeto original e incorporar atualizações quando fizer sentido. Revise conflitos com cuidado, principalmente em `server.js`, módulos de rotas e configuração do banco.

Se criou um repositório totalmente independente, será necessário trazer as atualizações manualmente ou configurar um remoto adicional.

Faça um commit ou backup antes de mesclar atualizações ou alterar código relacionado ao banco.

### Fazer backup do banco

Use as ferramentas de backup ou exportação do provedor PostgreSQL. Guarde os backups em local seguro e teste a restauração. Um backup do código não inclui os dados armazenados no PostgreSQL.

Faça backup separado dos arquivos enviados ou armazenados localmente, caso sua instalação use esses recursos. Não coloque dumps com dados pessoais em repositórios públicos.

## 12. Migrar dados antigos do SQLite

O repositório inclui `migrar.js`, que transfere usuários e tarefas de um banco SQLite legado localizado em `database/tarefas.db` para PostgreSQL.

**Não execute esse script em uma instalação nova**, a menos que você tenha esse banco SQLite antigo e queira migrar seus dados. O script espera que o arquivo exista e usa `DATABASE_URL` como destino PostgreSQL.

Antes de migrar:

1. Faça backup do arquivo SQLite.
2. Crie ou selecione o banco PostgreSQL de destino.
3. Configure `DATABASE_URL` para esse destino.
4. Revise quais tabelas e campos o script transfere.
5. Execute a migração em um ambiente controlado.
6. Confira a quantidade de usuários e tarefas e teste os dados.

O script trata usuários e tarefas antigos; não é uma ferramenta geral de migração de todos os recursos do Nexo. Não presuma que ele transfere temas personalizados, tabelas pessoais, roteiro de provas ou todos os recursos mais recentes. Verifique o código antes de depender dele.

## 13. Solução de problemas

### A variável `DATABASE_URL` está ausente

Confirme que o arquivo `.env` existe na raiz do projeto durante o desenvolvimento local ou que a variável está configurada no painel da hospedagem em produção. Confira a grafia do nome.

### A conexão PostgreSQL falha

Confirme que o banco está online, que a string de conexão está correta, que o usuário tem as permissões necessárias e que os requisitos de rede e SSL do provedor estão atendidos.

### O servidor encerra em produção

O servidor atual exige `SESSION_SECRET` quando `NODE_ENV=production`. Adicione a variável às configurações de ambiente da hospedagem e publique novamente.

### A página não abre

Confira se `npm start` continua em execução, use a porta exibida no terminal e verifique os logs. Em produção, confirme que o deploy terminou e use a URL pública fornecida pelo serviço.

### O login não funciona

Confirme que a conta existe no mesmo banco PostgreSQL usado pela aplicação em execução. Verifique o nome de usuário, a senha e a configuração de sessão. As senhas são armazenadas como hashes bcrypt; nunca as substitua por texto puro.

### O script de administrador informa que o nome já existe

O script não substitui contas existentes. Escolha outro nome ou confira a conta com uma ferramenta administrativa confiável. Não exclua nem altere contas sem entender o impacto.

### Faltam tabelas ou recursos

Confirme que a inicialização terminou sem erros e que a aplicação está conectada ao banco correto. A inicialização normal cria as tabelas da aplicação; `migrar.js` serve apenas para dados legados do SQLite.

### A alteração aparece localmente, mas não online

Confirme que registrou e enviou a alteração para a branch publicada pelo provedor. Depois, verifique os logs do deploy e o cache do navegador.

## 14. Segurança e privacidade

- Use um banco separado e segredos exclusivos para cada instalação.
- Nunca publique `.env`, credenciais do banco, segredos de sessão ou senhas administrativas.
- Use uma senha administrativa forte e limite o acesso a pessoas confiáveis.
- Use HTTPS em produção.
- Mantenha as dependências e o Node.js atualizados.
- Faça backups e proteja-os contra acesso público.
- Teste mudanças arriscadas em outro banco antes de aplicá-las em produção.
- Colete apenas as informações pessoais necessárias.
- Se usar o Nexo com estudantes ou uma comunidade escolar, verifique as leis de privacidade aplicáveis e obtenha as autorizações necessárias para os dados e conteúdos publicados.
- Leia a [licença MIT do projeto](../LICENSE) e cumpra seus termos.

O projeto é fornecido “no estado em que se encontra”. Você é responsável pela sua hospedagem, dados, segurança, backups e obrigações legais.

## 15. Checklist final

- [ ] Criei ou fiz fork do meu próprio repositório.
- [ ] Instalei as dependências sem erros.
- [ ] Criei um banco PostgreSQL separado.
- [ ] Configurei `DATABASE_URL` e um `SESSION_SECRET` exclusivo.
- [ ] Confirmei que o arquivo `.env` não será enviado ao Git.
- [ ] O Nexo inicia localmente e cria as tabelas necessárias.
- [ ] Criei e testei a primeira conta de administrador.
- [ ] Excluí o script temporário de criação do administrador.
- [ ] Publiquei com `npm install` e `npm start`.
- [ ] Testei login, painel administrativo e recursos essenciais online.
- [ ] Tenho um plano de backup do banco.
- [ ] Confirmei que nenhum segredo ou dado privado está exposto.

**Sua instalação independente do Nexo estará pronta para uso quando todas essas verificações forem concluídas.**
