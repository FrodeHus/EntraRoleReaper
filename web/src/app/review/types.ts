export type ReviewRequest = {
  usersOrGroups: string[];
  from: string;
  to: string;
};

export type UserReview = {
  userId: string;
  userDisplayName: string;
  currentRoleIds: string[];
  eligibleRoleIds?: string[];
  usedOperations: string[];
  suggestedRoleIds: string[];
  suggestedRoles?: {
    id?: string;
    name: string;
    coveredRequired: number;
    privilegedAllowed: number;
    totalAllowed: number;
  }[];
  operationCount: number;
  roleMeta?: { name: string; pim: boolean }[];
  operations: {
    operation: string;
    requiredPermissions: string[];
    targets: {
      id?: string;
      displayName?: string;
      type?: string;
      label?: string;
    }[];
    permissionDetails?: {
      name: string;
      privileged: boolean;
      grantedByRoles?: string[];
    }[];
  }[];
};

export type ReviewResponse = { results: UserReview[] };

export type RoleDetails = {
  id?: string;
  name?: string;
  description?: string;
  resourceScopes?: string[];
  resourceScopesDetailed?: { value: string; description: string }[];
  permissions: { action: string; privileged: boolean }[];
} | null;
