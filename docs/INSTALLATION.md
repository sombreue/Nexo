# Nexo — Installation and Setup Guide

This guide explains how to create your own independent instance of Nexo, from downloading the source code to deploying your website online.

Nexo is a web platform designed to organize school activities, assignments, exams, study schedules, and other useful tools in one place.

By following this guide, you will create your own installation, with a separate database, user accounts, configuration, and public URL.

## Table of contents

1. [Requirements](#1-requirements)
2. [Create your own repository](#2-create-your-own-repository)
3. [Download the project](#3-download-the-project)
4. [Install dependencies](#4-install-dependencies)
5. [Configure environment variables](#5-configure-environment-variables)
6. [Create your database](#6-create-your-database)
7. [Initialize the database](#7-initialize-the-database)
8. [Run Nexo locally](#8-run-nexo-locally)
9. [Create your administrator account](#9-create-your-administrator-account)
10. [Deploy Nexo](#10-deploy-nexo)
11. [Customize your installation](#11-customize-your-installation)
12. [Legacy SQLite migration](#12-legacy-sqlite-migration)
13. [Troubleshooting](#13-troubleshooting)
14. [Security recommendations](#14-security-recommendations)
15. [Launch checklist](#15-launch-checklist)

---

## 1. Requirements

Before starting, make sure you have the following:

- **Git** — to download and manage the source code.
- **Node.js and npm** — to run the application and install its dependencies.
- **A GitHub account** — to store your own copy of the project.
- **A PostgreSQL database** — to store users and application data.
- **A hosting account** — to publish your website online.

Recommended tools:

- Visual Studio Code for editing the source code.
- Neon for a managed PostgreSQL database.
- Render for application hosting.

Check whether Git and Node.js are installed:

```bash
git --version
node --version
npm --version
```

If any command is not recognized, install the corresponding tool and restart your terminal.

Use a Node.js version compatible with the project's dependencies.

## 2. Create your own repository

You have two options for creating your own copy of Nexo.

### Option A — Fork the repository

1. Open the original Nexo repository on GitHub.
2. Click **Fork**.
3. Choose your GitHub account as the destination.
4. Create the fork.

A fork preserves the relationship with the original repository, making it easier to receive upstream changes.

### Option B — Create an independent copy

If you want a repository that is completely independent of the original:

1. Download or clone the project.
2. Create a new, empty repository on your GitHub account.
3. Follow the instructions below to upload your copy.

An independent repository does not automatically receive updates from the original project.

**Original repository:** https://github.com/sombreue/Nexo

> The original repository may change over time. Check its current structure and instructions before proceeding.

## 3. Download the project

Open a terminal in the directory where you want to store the project.

Clone your repository:

```bash
git clone YOUR_REPOSITORY_URL
cd YOUR_REPOSITORY_FOLDER
```

Replace the example values with your repository URL and folder name.

If you created a fork, use the URL of your fork rather than the original repository.

Open the project in Visual Studio Code:

```bash
code .
```

If the `code` command is unavailable, open the folder directly from Visual Studio Code.

## 4. Install dependencies

Make sure you are in the project's root directory.

Install the dependencies listed in `package.json`:

```bash
npm install
```

If the repository contains a valid `package-lock.json`, you can use the following command for a reproducible installation:

```bash
npm ci
```

Use `npm ci` when the lockfile is present and consistent with `package.json`.

Do not install additional packages unless they are required by the project or by a feature you intend to add.

## 5. Configure environment variables

The repository includes a `.env.example` file. Copy it to `.env`.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

Configure these variables in `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection string for your own PostgreSQL database. Required. |
| `NODE_ENV` | Use `development` locally and `production` when deployed. |
| `PORT` | Local HTTP port. The app defaults to `3000` if this variable is absent; hosting providers may set it for you. |
| `SESSION_SECRET` | Secret used to protect sessions. Required when `NODE_ENV=production`. |

Example:

```env
DATABASE_URL=YOUR_POSTGRESQL_CONNECTION_STRING
NODE_ENV=development
PORT=3000
SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
```

Generate a strong, unique session secret with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `SESSION_SECRET`; do not use the example text literally. The `.gitignore` file already excludes `.env`, `node_modules/`, and `database/`. Never commit secrets or database credentials.

### Important

- Replace every placeholder with your own value.
- Never copy production credentials from another installation.
- Never commit `.env` to Git.
- Keep `.env` listed in `.gitignore`.
- Use a different session secret for each installation.
- Configure production variables through your hosting provider's environment settings.

Do not publish your database connection string or session secret in screenshots, logs, or public repositories.

## 6. Create your database

Nexo uses PostgreSQL to store application data.

You can create a separate database using a provider such as Neon.

1. Create an account with your chosen database provider.
2. Create a new PostgreSQL project.
3. Obtain its connection string.
4. Configure the connection string in your local `.env` file.
5. Verify that the database is accessible from your development environment.

Use your own database. Do not connect your installation to the original project's database.

Keep the database credentials private and make sure the connection string is compatible with the application's PostgreSQL driver and SSL requirements.

## 7. Initialize the database

For a fresh installation, you do **not** need to run `migrar.js`. The normal server startup creates or checks the base tables. The `001_multi_turmas` migration is a separate step required for the class schema and routes.

After configuring `.env`, start Nexo with `npm start` and wait for the base table setup to finish. Stop the server with `Ctrl+C`, then apply the class migration:

```bash
npm run db:migrate:multi-turmas
```

This runs `migrations/001_multi_turmas.sql` in a transaction and records the applied version. Back up the database before running it. Start Nexo again with `npm start`. The PostgreSQL account must have permission to create and alter the application's tables and indexes.

The separate `migrar.js` script is for transferring data from a legacy SQLite file at `database/tarefas.db`. See [Section 12](#12-legacy-sqlite-migration). Do not run it for an empty installation.

If initialization fails, check the full terminal output, the `DATABASE_URL`, database availability, and the database user's permissions.

## 8. Run Nexo locally

Check the scripts available in `package.json`.

If the project defines a `start` script, run:

```bash
npm start
```

If it defines a development script, use the appropriate command, such as:

```bash
npm run dev
```

The exact command depends on the scripts provided by the current version of the project.

Open the local address printed by the application in your terminal. For many Express applications, this is a localhost address, but the actual port depends on the project's configuration.

Verify that:

- The home page loads.
- The application connects to PostgreSQL.
- Login and session handling work.
- Database-backed pages load correctly.
- No unexpected errors appear in the terminal.

## 9. Create your administrator account

A fresh database does **not** automatically receive an administrator. The normal user-management endpoints require an existing administrator, so a new installation needs a one-time bootstrap step.

### 9.1 Start the server once

Run `npm start`, wait for the table-creation process to finish, then stop the server with `Ctrl+C`.

### 9.2 Create a temporary script

Create `create-admin.js` in the project root and paste this code:

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

### 9.3 Run it

In Windows PowerShell, set credentials for this terminal session only:

```powershell
$env:ADMIN_USERNAME = "choose-an-admin-username"
$securePassword = Read-Host "Administrator password" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
node create-admin.js
Remove-Item Env:ADMIN_USERNAME
Remove-Item Env:ADMIN_PASSWORD
Remove-Variable securePassword
```

Use your own values. The PowerShell prompt above masks the password while you type it. On macOS or Linux, set the username, prompt for the password without echoing it, run the script, then clear both variables:

```bash
export ADMIN_USERNAME="choose-an-admin-username"
read -rsp "Administrator password: " ADMIN_PASSWORD
echo
export ADMIN_PASSWORD
node create-admin.js
unset ADMIN_USERNAME ADMIN_PASSWORD
```

The script hashes the password with bcrypt and does not overwrite an existing account. After confirming that you can sign in and open the admin panel, **delete `create-admin.js`**. Do not commit or deploy the temporary script.

## 10. Deploy Nexo

After confirming that Nexo works locally, you can publish your instance online. This guide uses Render as an example hosting provider.

### Create the web service

1. Push your project to your own GitHub repository.
2. Sign in to Render.
3. Create a new Web Service.
4. Connect your repository.
5. Select the appropriate branch.
6. Set the build command to `npm install`.
7. Set the start command to `npm start`.
8. Add the required environment variables.
9. Deploy the application.

### Configure production

Set these production environment variables:

- `DATABASE_URL`: your own PostgreSQL connection string.
- `SESSION_SECRET`: a strong, unique random secret.
- `NODE_ENV=production`.

Do not upload your local `.env` file. Enter values in the hosting provider's environment settings. The current server uses the host-provided `PORT` when available, configures Express proxy trust, and enables secure session cookies when `NODE_ENV=production`.

Confirm that the server listens on the port supplied by the hosting environment when applicable.

If the application uses secure cookies, sessions, or proxy settings, verify that these are correctly configured for HTTPS and the hosting provider.

### Verify the deployment

After deployment:

1. Open the public URL provided by your hosting provider.
2. Test login and logout.
3. Test database-backed features.
4. Check the deployment logs.
5. Verify that your installation is using your own database and credentials.

Do not consider the deployment complete until the essential features work in the production environment.

## 11. Customize your installation

Once the application is running, you can adapt it to your own needs.

Depending on the features available in your version of Nexo, you may customize:

- The website name and branding.
- The logo and favicon.
- Themes and visual styles.
- School subjects and academic schedules.
- Assignments, projects, and exam information.
- User accounts and administrative permissions.

Before changing source files, create a backup or commit your changes to Git.

If you maintain a fork, consider keeping your customizations in separate commits to make future updates easier to manage.

Remember that changing source code does not automatically update your production website. You may need to commit, push, and redeploy your changes.

## 12. Legacy SQLite migration

The repository includes `migrar.js`, which transfers users and tasks from a legacy SQLite database at `database/tarefas.db` into PostgreSQL.

**Do not run this script for a fresh installation** unless you intentionally have that SQLite database and want to migrate its data. It expects the SQLite file to exist and uses `DATABASE_URL` as the PostgreSQL destination.

Before migration, back up the SQLite file, confirm the destination database, review the tables and fields transferred by the script, then verify user/task counts and test the results. The script does not necessarily migrate every newer Nexo feature, such as personalized themes, personal tables, or exam schedules.

## 13. Troubleshooting

### The application cannot connect to PostgreSQL

Check that `DATABASE_URL` is set correctly, the database is online, and the database provider's connection requirements are satisfied.

### The application reports missing environment variables

Review your `.env` file and the environment variables configured in your hosting dashboard. In production, the current server exits if `SESSION_SECRET` is missing.

Make sure the variable names match those expected by the application.

### The application fails to start

Inspect the terminal or hosting logs. Check the Node.js version, the dependencies, and the start script defined in `package.json`.

### Database tables are missing

Verify that server startup completed successfully and that it is connected to the intended database. The normal server startup creates the application's tables; `migrar.js` is only for legacy SQLite data.

### Login does not work

Check the authentication logic, user records, password hashing, session configuration, and server logs.

Do not store passwords in plaintext or disable authentication to bypass the problem.

### The website works locally but fails after deployment

Compare local and production environment variables, confirm the host uses `npm install` and `npm start`, check database connectivity, and inspect production logs.

## 14. Security recommendations

Every Nexo installation should be operated independently and responsibly.

- Use your own database and hosting configuration.
- Keep passwords and session secrets private.
- Never commit `.env` files or credentials.
- Use HTTPS in production.
- Keep dependencies updated and review security advisories.
- Restrict administrative access to trusted users.
- Back up important data regularly.
- Test database migrations before applying risky changes.
- Avoid collecting unnecessary personal information.
- Make sure you have permission to publish any data, images, or content you add.

If you are deploying Nexo for a school, classroom, or group of students, consider applicable privacy requirements before collecting or storing personal data.

---

## 15. Launch checklist

Before considering your installation ready, verify that:

- [ ] Your repository belongs to your account.
- [ ] Dependencies install successfully.
- [ ] Your environment variables are configured.
- [ ] Your PostgreSQL database is separate from the original installation.
- [ ] Database migrations complete successfully.
- [ ] Your administrator account works.
- [ ] The application runs locally.
- [ ] The production deployment is accessible.
- [ ] Authentication and essential features work online.
- [ ] No secrets or credentials are exposed in the repository.

**You now have the foundation for an independent Nexo installation.**

Refer to the project's README and source code whenever implementation details differ from the examples in this guide.
