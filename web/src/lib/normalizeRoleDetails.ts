import type { RoleDetails } from "../app/review/types";

// Normalize raw API JSON for /api/roles/{id} into RoleDetails shape (grouped rolePermissions)
export function normalizeRoleDetails(json: any): RoleDetails {
  if (!json) return null;
  const rolePermissionsRaw = json.rolePermissions || [];
  return {
    id: json.id,
    name: json.displayName || json.name,
    description: json.description,
    resourceScopes: json.resourceScopes || [],
    resourceScopesDetailed: json.resourceScopesDetailed || [],
    rolePermissions: rolePermissionsRaw.map((rp: any) => ({
      condition: rp.condition || null,
      actions: (rp.actions || []).map((a: any) => ({
        action: a.action || a,
        privileged: !!a.privileged,
      })),
    })),
  };
}
