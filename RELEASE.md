# KERN v1.0.0 — Stable Release

KERN 1.0.0 is the first stable release of the Developer Command Center.

KERN brings GitHub activity, deployments, logs, uptime, issues, pull requests, TODOs, operational alerts, provider controls, desktop notifications, release updates, and AI-assisted diagnosis into one application.

## Highlights

- Unified GitHub + Vercel + Render operations dashboard
- Windows and Linux desktop installers
- GitHub issue, PR, workflow, deployment, rollback, and restart controls
- Supabase-backed TODOs, alerts, incidents, and audit history
- Automatic uptime/deployment incident detection
- Native desktop and browser notifications
- GitHub Releases auto-updater with **Check now → Download → Restart & install**
- KERN AI read-only operations assistant
- Server-side secret handling and mutation safeguards

## Install

Choose the asset for your platform from this Release:

- **Windows:** `KERN-Setup-1.0.0-x64.exe`
- **Linux portable:** `KERN-1.0.0-x64.AppImage`
- **Debian/Ubuntu:** `KERN-1.0.0-x64.deb`

No terminal is required for normal installation or future updates.

## Updating later

Installed KERN builds use this GitHub Release channel. Open **Settings → Desktop configuration → KERN updates**, select **Check now**, then **Download**, then **Restart & install** when a new version is available.

## Optional integrations

KERN works without every provider enabled. GitHub public data works in read-only mode; Vercel, Render, Supabase persistence, write actions, and KERN AI activate when their respective credentials are configured.

## Security note

KERN AI is read-only and cannot execute deployments, rollbacks, restarts, merges, or other mutation actions. Operational changes stay behind KERN's authenticated control plane.

Windows packages are Authenticode-signed only when a valid signing certificate is configured in the repository's GitHub Actions secrets. Otherwise Windows may display an Unknown publisher warning.

See `CHANGELOG.md` for the complete 1.0.0 feature history.
