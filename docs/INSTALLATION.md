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
12. [Troubleshooting](#12-troubleshooting)
13. [Security recommendations](#13-security-recommendations)

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

**Original repository:** https://github.com/sombreue/site

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

Nexo requires environment variables for configuration, including its database connection.

Create a local `.env` file in the project root if the application uses dotenv.

Example:

```env
DATABASE_URL=YOUR_POSTGRESQL_CONNECTION_STRING
SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
NODE_ENV=development
```

This is an illustrative example, not a guaranteed list of every variable required by your version of Nexo. Check the application source code and hosting configuration to identify all required variables.

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

The project includes a database migration script named `migrar.js`.

Before running it, inspect the script to understand which tables or changes it creates.

If the script is configured to run directly with Node.js, the command may be:

```bash
node migrar.js
```

Confirm the correct migration command in `package.json` or the project's source code before executing it.

Run migrations only against your own database.

If initialization fails, review the terminal output and verify:

- The connection string is correct.
- The database is available.
- The required environment variables are loaded.
- The database user has the necessary permissions.

Do not repeatedly run migration scripts without understanding whether they are safe to execute more than once.

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

Before using your installation, you need an administrator account.

**Follow the account-creation method implemented by your version of Nexo.** Do not assume that the application automatically creates an administrator during migration.

Check the authentication code and existing user-management instructions to determine how the first administrator is created.

Depending on the implementation, this may involve an existing registration flow, a dedicated initialization procedure, or a database operation.

Never make a regular user an administrator simply by editing an arbitrary database value without understanding the application's authorization logic.

Once your administrator account is ready, sign in and verify that you can access the administrative panel.

## 10. Deploy Nexo

After confirming that Nexo works locally, you can publish your instance online.

This guide uses Render as an example hosting provider.

### Create the web service

1. Push your project to your own GitHub repository.
2. Sign in to Render.
3. Create a new Web Service.
4. Connect your repository.
5. Select the appropriate branch.
6. Configure the build and start commands based on `package.json`.
7. Add the required environment variables.
8. Deploy the application.

### Configure production

Set the environment variables required by the application, including:

- Your own PostgreSQL connection string.
- A unique, secure session secret.
- `NODE_ENV=production`, if required by the application.

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

## 12. Troubleshooting

### The application cannot connect to PostgreSQL

Check that `DATABASE_URL` is set correctly, the database is online, and the database provider's connection requirements are satisfied.

### The application reports missing environment variables

Review your `.env` file and the environment variables configured in your hosting dashboard.

Make sure the variable names match those expected by the application.

### The application fails to start

Inspect the terminal or hosting logs. Check the Node.js version, the dependencies, and the start script defined in `package.json`.

### Database tables are missing

Verify that the migration script completed successfully and that it targeted the correct database.

### Login does not work

Check the authentication logic, user records, password hashing, session configuration, and server logs.

Do not store passwords in plaintext or disable authentication to bypass the problem.

### The website works locally but fails after deployment

Compare the local and production environment variables, start commands, Node.js versions, database connectivity, and production logs.

## 13. Security recommendations

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

## Final checklist

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
