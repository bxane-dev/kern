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

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Lucide React
- Native CSS
- GitHub REST API
- Optional Vercel REST API
- Optional Render REST API

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

### Uptime monitors

Use semicolon-separated `Name|URL` entries:

```env
KERN_MONITORS=XAN|https://xan.example.com;API|https://api.example.com/health
```

KERN performs server-side checks when dashboard data refreshes.

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
```

## Deploy

KERN is ready for Vercel or any Node.js host that supports Next.js.

For Vercel, import `bxane-dev/kern`, configure the environment variables above, and deploy.

For Render, create a Node web service with:

- Build command: `npm install && npm run build`
- Start command: `npm start`

## Data behavior

GitHub, deployment, log, and uptime data is fetched live from server routes. TODOs are intentionally stored in the browser's `localStorage` so KERN works without a database.

A future multi-user version can move TODOs, incidents, alert history, and user settings to PostgreSQL/Supabase without changing the provider adapter model.
