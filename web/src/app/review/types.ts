export type ReviewRequest = {
  usersOrGroups: string[];
  from: string;
  to: string;
};

export type SimpleRole = { id: string; displayName: string };
export type UserReview = {
  user: { id: string; displayName: string };
  activeRoles: SimpleRole[];
  eligiblePimRoles: SimpleRole[];
  operations: {
    operation: string;
    targets: {
      id?: string;
      displayName?: string;
      modifiedProperties?: {
        displayName?: string;
        oldValue?: string;
        newValue?: string;
      }[];
    }[];
    permissions: {
      name: string;
      isPrivileged: boolean;
      grantedByRoleIds: string[];
      grantConditions?: string[] | null;
      matchedConditionsPerRole?: (string | null)[] | null;
    }[];
  }[];
  addedRoles: SimpleRole[];
  removedRoles: SimpleRole[];
};

export type ReviewResponse = { results: UserReview[] };

export type RoleDetails = {
  id?: string;
  name?: string;
  description?: string;
  resourceScopes?: string[];
  resourceScopesDetailed?: { value: string; description: string }[];
  rolePermissions: {
    condition?: string | null;
  actions: { id: string; action: string; privileged: boolean }[];
  }[];
} | null;
