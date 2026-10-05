# Changelog

All notable KERN changes are documented here.

## [1.0.0] - 2026-10-05

### Stable release

KERN 1.0.0 is the first stable release of the Developer Command Center.

### Dashboard and integrations

- Unified dashboard for GitHub, Vercel, Render, uptime, logs, issues, pull requests, tasks, alerts, incidents, releases, and provider state.
- Live GitHub repository, activity, issue, and pull-request data.
- Vercel deployment history and deployment build events.
- Render deployment history.
- Server-side uptime and latency checks.
- Responsive desktop, tablet, and mobile interface.
- Command palette with Ctrl/Cmd + K.
- 60-second live refresh.

### Control plane

- Create GitHub issues.
- Close and reopen GitHub issues.
- Dispatch and rerun GitHub Actions workflows.
- Merge pull requests with merge, squash, or rebase.
- Redeploy Vercel deployments.
- Roll back Vercel production to a previous deployment.
- Trigger Render deployments with optional clean-cache rebuilds.
- Restart Render services.
- Confirmation prompts before operational mutations.
- Persistent audit logging when Supabase is configured.

### Persistence and operations

- Supabase/Postgres persistence layer.
- Persistent TODO CRUD.
- Automatic local TODO fallback when Supabase is unavailable.
- Persistent alerts, incidents, audit events, and settings schema.
- Automatic downtime detection.
- Latency threshold alerts.
- Failed-deployment alerts.
- Alert fingerprinting and deduplication.
- Automatic alert and incident recovery resolution.
- Alert acknowledgement.
- Browser and native desktop notifications.

### Desktop application

- Native Electron desktop application.
- Windows x64 NSIS installer.
- Linux x64 AppImage.
- Linux x64 DEB package.
- Bundled Next.js production server; end users do not need Node.js or npm.
- Desktop settings for provider credentials and KERN configuration.
- OS-backed secret storage where supported.
- Native desktop notifications.
- Single-instance desktop behavior.

### Releases and updates

- GitHub Releases update channel.
- In-app update checks.
- Background update checks after launch and every six hours.
- Manual Check now control.
- Explicit download progress.
- Explicit Restart & install action.
- NSIS/AppImage updater metadata and blockmaps.
- Optional Windows Authenticode signing through GitHub Actions secrets.
- Stable release pipeline that creates version tags and publishes installer assets automatically.

### KERN AI

- Read-only AI Operations Assistant.
- Analysis grounded in the current KERN operational snapshot.
- Deployment, log, uptime, alert, incident, issue, pull-request, and activity analysis.
- Failure diagnosis and recommended next actions.
- Vercel AI Gateway integration.
- Configurable AI model.
- Prompt-injection guardrails for untrusted logs, repository descriptions, issues, and provider data.
- AI cannot silently execute control-plane actions.

### Security

- Server-only provider credentials.
- Optional KERN password authentication with HTTP-only session cookies.
- Same-origin validation for mutation routes.
- Write actions disabled when KERN password protection is not configured.
- Supabase secret keys restricted to trusted server deployments.
- RLS-enabled database schema with anonymous/client access revoked.
- Scoped provider-token guidance.
- Read-only AI boundary.

### Notes

- Windows builds remain unsigned unless a valid Authenticode certificate is configured through GitHub Actions secrets.
- Supabase persistence and AI Gateway are optional integrations and require their own credentials/configuration.
