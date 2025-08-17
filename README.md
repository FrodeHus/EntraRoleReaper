# ![logo](/web/public/entrarolereaper_logo.png) RoleReaper

Full-stack app to perform access reviews of Entra ID users.

- Backend: .NET 9 Minimal API, Microsoft Identity (OBO) + Microsoft Graph
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui components

## What it does

- Search and select users and groups from Entra ID
- Choose a time period for review
- Backend processing per user:
  - Aggregates directory audit logs within the selected window
  - Maps operation names (ActivityDisplayName) to required Graph permissions via `server/Configuration/permissions-map.json`
  - Determines which permissions are actually granted today via the user’s current directory roles and surfaces the granting role names
  - Flags privileged permissions and includes Entra PIM data: eligible roles and currently active PIM assignments (if API permissions allow)
  - Suggests least-privilege roles using a minimal set-cover of required permissions derived from the user’s operations, preferring roles with fewer privileged actions and smaller overall scope
- UI highlights:
  - Permissions grouped by granting role with badges (PIM, Privileged) and an expandable Targets section
  - Suggested roles include a “Why suggested” note (covered required permissions, privileged count, total allowed)

## Prereqs

- .NET SDK 9+ installed
- Node.js 18+ and pnpm or npm
- Entra ID tenant and ability to create app registrations

## Azure AD/Entra app registrations

Create app registration:

Web API (backend)

- Type: Web API (confidential)
- Redirect URI (Web): <http://localhost:5099/signin-oidc> (not used directly but required by some portals)
- Redirect URI (Single Page Application): <http://localhost:5173>
- Expose an API: api://entra-role-reaper with scope access_as_user
- Client secret: create and store securely

Grant admin consent to API permissions required by the API to call Microsoft Graph on-behalf-of the user:

- Microsoft Graph delegated scopes (admin consent):
  - User.Read
  - User.ReadBasic.All
  - User.Read.All
  - Group.Read.All
  - Directory.Read.All
  - AuditLog.Read.All
  - RoleManagement.Read.Directory
  - RoleEligibilitySchedule.Read.Directory (required to read PIM eligible roles)
  - RoleAssignmentSchedule.Read.Directory (required to read PIM active assignments)

Note on PIM: To include Microsoft Entra PIM information in reviews (eligible and active PIM assignments), the API needs the schedule read scopes above. Without them, the app still works but won’t display PIM labels or eligibility.

Note: Some endpoints require elevated delegated permissions. Adjust as needed.

## Configure local environment

Backend: create `server/appsettings.Development.json` with your values:

{
"AzureAd": {
"Instance": "<https://login.microsoftonline.com/>",
"TenantId": "YOUR_TENANT_ID",

## Docker compose (server + web)

This repo includes Dockerfiles for both the API (server) and the web SPA, plus a docker-compose file to run the full stack locally with least privileges.

1. Create a `.env` file at the repo root with your values:

```dotenv
AZUREAD_TENANT_ID=
AZUREAD_CLIENT_ID=
AZUREAD_CLIENT_SECRET=
AZUREAD_AUDIENCE=
AZUREAD_DOMAIN=
# Web (SPA) MSAL settings
VITE_API_SCOPE=
```

Notes:

- AZUREAD\_\* configure the API's Microsoft Identity Platform OBO flow.
- VITE\_\* configure the SPA's MSAL client and API scope at build time.
- The SPA is served at <http://localhost:5173> and proxies /api/\* to the API container.

1. Build and run the stack:

```bash
docker compose build
docker compose up
```

The web UI will be available at <http://localhost:5173>.

Security hardening applied:

- Non-root users in both containers.
- Read-only root filesystem with a tmpfs mounted at /tmp.
- Dropped all Linux capabilities and no-new-privileges.
- Nginx listens on an unprivileged port (8080) inside the container.

"ClientId": "BACKEND_APP_ID",
"ClientSecret": "BACKEND_APP_CLIENT_SECRET",
"Audience": "api://BACKEND_APP_ID",
"Domain": "yourtenant.onmicrosoft.com"
},
"Cors": {
"AllowedOrigins": ["http://localhost:5173"]
}
}

Frontend: copy `.env.example` to `.env` and set:


VITE_API_SCOPE=api://BACKEND_APP_ID/access_as_user
VITE_API_URL=<http://localhost:5099>

## Run

- Restore/build API and web

Backend:

- cd server
- dotnet restore
- dotnet run

Frontend:

- cd web
- npm install
- npm run dev

Open <http://localhost:5173>

## Environment variables (runtime)

| Key / Name | Values | Default | Purpose |
|------------|--------|---------|---------|
| ROLE_REAPER_RESET_DB | 0 / 1 | 0 (unset) | When 1, drop & recreate the SQLite cache DB on startup and re-seed the operation map. When 0/unset, preserve existing DB (seed only if empty). Useful for schema/cache iteration in dev. |
| ROLE_REAPER_DIAG | 0 / 1 | 0 (unset) | Enables diagnostic mode: EF Core sensitive data logging, detailed errors, and global exception logging. Avoid in production (may log sensitive values). |
| Cache:SqlitePath | Path | /tmp/rolereaper_cache.sqlite | (Configuration key or env var) File path for SQLite cache; used when `Cache:SqliteConnection` not supplied. |
| Cache:SqliteConnection | Connection string | (none) | Full ADO.NET SQLite connection string. Overrides `Cache:SqlitePath` when present. |

Tip: Set `ROLE_REAPER_RESET_DB=1` only while actively evolving cache schema; unset for stable runs to retain cached role/permission data between restarts.

## Notes

- The permission-to-role mapping is a sample in `server/Data/permissions-map.json`. Extend it to your operations and policies.
