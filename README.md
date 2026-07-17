# Aii Prompt Playbook

Internal Prompt Playbook deployed on **Cloudflare Pages**. Content is stored in **Cloudflare D1** and users authenticate with **Cloudflare Access**. Administrators edit content through the web page after signing in; no GitHub personal access token is used.

> Prerequisite: use a custom domain that is an active Cloudflare zone, such as `prompt.company.com`. Cloudflare Access applications are configured against domains in your Cloudflare account, so do not use the default `*.pages.dev` URL for the internal production site.

## Architecture

```text
Cloudflare Access (company login)
            ↓
Cloudflare Pages (index.html) → Pages Function (/api/playbook) → D1 database
```

The function verifies the Cloudflare Access JWT and allows writes only from email addresses in `ADMIN_EMAILS`.

## One-time Cloudflare setup

### 1. Create and initialize D1

1. In **Workers & Pages → D1 SQL Database**, create a database (for example `aii-prompt-playbook`).
2. Open its **Console** tab and run the contents of [schema.sql](schema.sql).
3. In the Pages project, open **Settings → Bindings → Add → D1 database binding**.
4. Select that database and use `DB` as the binding variable name.

### 2. Deploy the Pages project

1. In **Workers & Pages**, create a Pages project from this GitHub repository.
2. This is a plain HTML project: set **Build command** to `exit 0` and **Build output directory** to `.` (the repository root).
3. Deploy the project, then add your custom domain in **Pages → Custom domains**. Pages Functions will publish `functions/api/playbook.js` as `/api/playbook`.

### 3. Configure Cloudflare Access

1. In **Zero Trust → Settings → Authentication**, configure your company identity provider. Email one-time PIN is also available if you do not have SSO.
2. In **Zero Trust → Access → Applications**, add a **Self-hosted** application for the custom domain, including `/*`.
3. Add an **Allow** policy for the company email domain or the employee group. This makes the whole playbook internal.
4. Copy the application's **Audience (AUD) tag**.

### 4. Add Pages environment variables

In the Pages project, open **Settings → Variables and Secrets** and add these production variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `ADMIN_EMAILS` | `admin@company.com,editor@company.com` | The only users allowed to save changes. |
| `CF_ACCESS_TEAM_DOMAIN` | `your-team.cloudflareaccess.com` | Your Cloudflare Access team domain. |
| `CF_ACCESS_AUD` | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | The Access application's AUD tag. |

Redeploy once after adding the D1 binding and variables.

## Using the playbook

1. Open the Cloudflare Pages URL and complete the company login.
2. An approved administrator selects **ผู้ดูแล**, edits prompts, then chooses **บันทึกให้ทุกคนเห็น**.
3. Changes are written to D1 immediately. No token, Git commit, or deployment wait is required.

On the first save, the built-in prompt list is copied into D1 automatically.

## Security notes

- Do not publish this project to GitHub Pages after configuring the Cloudflare version; GitHub Pages cannot run the API function or Cloudflare Access.
- Keep the Access application on the Pages hostname. The API rejects requests without a valid, correctly signed Access JWT.
- Manage administrators by changing `ADMIN_EMAILS` in Cloudflare, then redeploying the Pages project.
