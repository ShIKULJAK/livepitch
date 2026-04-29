export type Role = "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER";

export const isAdmin = (role?: string | null) => role === "ADMIN";
export const isViewer = (role?: string | null) => role === "VIEWER";
export const hasRole = (role: string | undefined | null, expected: Role) => role === expected;

export const hasAnyRole = (role: string | undefined | null, roles: Role[]) =>
  role ? roles.includes(role as Role) : false;

export const canManageTournaments = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER"]);
export const canManageMatches = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER", "EDITOR"]);
export const canManageTeams = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER"]);
export const canEditContent = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER", "EDITOR"]);
export const canManageRoles = (role?: string | null) => isAdmin(role);
export const canAccessBilling = (role?: string | null) => isAdmin(role);
export const canAccessSecurity = (role?: string | null) => isAdmin(role);
export const canAccessIntegrations = (role?: string | null) => isAdmin(role);

