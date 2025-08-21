# ![logo](/web/public/entrarolereaper_logo.png) RoleReaper

[![.NET](https://github.com/FrodeHus/EntraRoleReaper/actions/workflows/dotnet.yml/badge.svg)](https://github.com/FrodeHus/EntraRoleReaper/actions/workflows/dotnet.yml)

Full-stack app to perform access reviews of Entra ID users.

- Backend: .NET 9 Minimal API, Microsoft Identity (OBO) + Microsoft Graph
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui components

## What it does

Entra Role Reaper uses Entra audit log to find actual activities performed by user(s) and using mappings determine which least privilege roles the user actually should have.

See [Wiki](https://github.com/FrodeHus/EntraRoleReaper.wiki)

## Prereqs

- .NET SDK 9+ installed
- Node.js 18+ and pnpm or npm
- Entra ID tenant and ability to create app registrations

