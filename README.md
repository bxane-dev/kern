# KERN

**KERN** is a developer command center for GitHub activity, deployments, build logs, uptime checks, issues, pull requests, and personal TODOs.

![KERN](https://img.shields.io/badge/KERN-Developer_Command_Center-111111?style=for-the-badge)

## Included

- GitHub repository overview
- Open issues and pull requests
- Public GitHub activity feed
- Vercel deployment history
- Latest Vercel deployment build events
- Render deployment history
- Configurable uptime/latency checks
- Local priority-based TODO board
- Global command palette with `Ctrl/Cmd + K`
- Optional password protection with an HTTP-only session cookie
- Responsive desktop, tablet, and mobile layouts
- 60-second live refresh
- Protected write-action control plane
- Create GitHub issues from KERN
- Dispatch GitHub Actions workflows
- Redeploy an existing Vercel deployment
- Trigger normal or clean-cache Render deploys
- Native Electron desktop application
- Windows NSIS installer
- Linux AppImage and DEB packages
- Desktop credential/settings manager
- Supabase/Postgres persistent TODO storage
- Database-ready incident, alert, audit-event, and settings tables
- Automatic local TODO fallback when cloud persistence is unavailable
- Automatic downtime, latency, and failed-deployment alerts
- Persistent alert acknowledgement and incident history with Supabase
- Native Electron notifications and browser notifications
- Alert fingerprinting and automatic recovery resolution

## Stack

- Electron 44
- electron-builder
- Next.js 16 App Router
- React 19
- TypeScript
- Lucide React
- Native CSS
- GitHub REST API
- Optional Vercel REST API
- Optional Render REST API

## Desktop installers

KERN can be installed as a native desktop application. The desktop bundle contains the production Next.js server, so end users do not need Node.js or npm installed.

### Windows

Download `KERN-Setup-<version>-x64.exe` from the **Desktop Installers** workflow artifact or a tagged GitHub Release. The assisted installer supports Start Menu/Desktop shortcuts and lets the user choose the installation directory.

### Linux

Two packages are built:

- `KERN-<version>-x64.AppImage` — portable cross-distribution app
- `KERN-<version>-x64.deb` — installable Debian/Ubuntu package

The installed desktop app adds **Settings → Desktop configuration**, where GitHub/Vercel/Render credentials, KERN password, project IDs, and uptime monitors can be configured locally. Sensitive values use Electron `safeStorage` when OS encryption is available.

### Build installers yourself

```bash
npm install

# Windows
npm run desktop:win

# Linux
npm run desktop:linux
```

Artifacts are written to `dist/`.

To publish installer files as a GitHub Release, push a version tag such as `v0.2.0`.

## Run locally

```bash
git clone https://github.com/bxane-dev/kern.git
cd kern
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

### Access

```env
KERN_PASSWORD=choose-a-long-password
```

If `KERN_PASSWORD` is not set, KERN runs without a login screen in **read-only mode**. All provider mutation endpoints remain locked. Set a strong password before enabling write actions on any deployment.

### GitHub

```env
GITHUB_OWNER=bxane-dev
GITHUB_TOKEN=
```

`GITHUB_TOKEN` is optional for public read-only repositories, but recommended to increase API limits. Keep it server-side.

To use KERN's GitHub write actions with a fine-grained token, grant only the repositories KERN should control and enable **Issues: Read and write** plus **Actions: Read and write**.

### Vercel

```env
VERCEL_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_ID=
```

Set `VERCEL_TOKEN` to enable deployment history and latest deployment build events. Team/project IDs are optional filters.

### Render

```env
RENDER_API_KEY=
RENDER_SERVICE_ID=
```

Both variables are required for Render deployment history.

### Persistent storage

KERN supports a dedicated Supabase/Postgres database for persistent operational data.

1. Create a dedicated Supabase project for KERN.
2. Run `supabase/kern_schema.sql` in that project's SQL editor.
3. Configure:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=your-server-side-secret-key
```

KERN also accepts the legacy `SUPABASE_SERVICE_ROLE_KEY` on servers for compatibility, but new deployments should use a modern Supabase secret key.

The Supabase key is server-only. KERN never exposes it to browser code. Tables have RLS enabled and access for `anon` and `authenticated` is explicitly revoked.

If Supabase is not configured, the TODO board automatically falls back to browser-local storage. KERN Desktop intentionally does not accept a Supabase secret key: secret keys belong only on a hosted/backend deployment, never in a shipped client application.

### Uptime monitors

Use semicolon-separated `Name|URL` entries:

```env
KERN_MONITORS=XAN|https://xan.example.com;API|https://api.example.com/health
```

KERN performs server-side checks when dashboard data refreshes. Each refresh also evaluates monitor failures, slow responses, and the latest deployment state.

Use `KERN_LATENCY_WARN_MS` to control the latency warning threshold (default: `1500` ms). Active conditions appear immediately in **Alerts**. When Supabase persistence is configured, KERN deduplicates them by fingerprint, records critical incidents, and automatically resolves alerts/incidents after recovery.

The web app can send browser notifications after permission is granted. The installed desktop application uses native Electron system notifications.

## Security

Provider tokens are only read in server code and are not included in API responses. KERN's optional access password is converted to a deterministic server-side session value and stored in an HTTP-only, same-site cookie. Write endpoints also enforce same-origin requests and refuse to execute at all when `KERN_PASSWORD` is unset.

For an internet-facing deployment:

1. Set `KERN_PASSWORD`.
2. Do not prefix provider secrets with `NEXT_PUBLIC_`.
3. Use scoped provider tokens where possible.
4. Rotate any token you accidentally commit or expose.

## Commands

```bash
npm run dev
npm run typecheck
npm run build
npm start
npm run desktop:dev
npm run desktop:win
npm run desktop:linux
```

## Deploy

KERN is ready for Vercel or any Node.js host that supports Next.js.

For Vercel, import `bxane-dev/kern`, configure the environment variables above, and deploy.

For Render, create a Node web service with:

- Build command: `npm install && npm run build`
- Start command: `npm start`

## Data behavior

GitHub, deployment, log, and uptime data is fetched live from server routes. TODOs use Supabase/Postgres when configured and fall back to browser `localStorage` when persistence is unavailable.

The included schema stores TODOs, operational alerts, incident history, audit events, and KERN settings. Alert/incident rows are derived from real provider and monitor state; KERN does not fabricate health events.
