# EntraRoleAssignmentAuditor

Full-stack app to perform access reviews of Entra ID users.

- Backend: .NET 9 Minimal API, Microsoft Identity (OBO) + Microsoft Graph
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui components

## What it does

- Search and select users and groups from Entra ID
- Choose a time period for review
- Backend processing per user:
  - Aggregates directory audit logs within the selected window
  - Maps operation names (ActivityDisplayName) to required Graph permissions via `server/Data/permissions-map.json`
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

Create two app registrations:

1. SPA (frontend)

- Type: Single-page application
- Redirect URI: <http://localhost:5173>
- Expose no API. Add delegated permissions to the backend API scope once created.

2. Web API (backend)

- Type: Web API (confidential)
- Redirect URI (Web): <http://localhost:5099/signin-oidc> (not used directly but required by some portals)
- Expose an API: api://<BACKEND_APP_ID> with scope access_as_user
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

VITE_AAD_TENANT_ID=YOUR_TENANT_ID
VITE_AAD_CLIENT_ID=FRONTEND_SPA_APP_ID
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

## Notes

- The permission-to-role mapping is a sample in `server/Data/permissions-map.json`. Extend it to your operations and policies.
