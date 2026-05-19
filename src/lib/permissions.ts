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

type UserLike = { id?: string | null; role?: string | null } | null | undefined;
type Ownable = unknown;

export const canCreateCompetitions = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER"]);
export const canCreateTeams = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER"]);
export const canCreateMatches = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER", "EDITOR"]);
export const canCreatePlayers = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER", "EDITOR"]);
export const canCreateDraws = (role?: string | null) => hasAnyRole(role, ["ADMIN", "MANAGER"]);

function readCreatedById(entity: Ownable) {
  if (!entity || typeof entity !== "object") return null;
  const value = (entity as { createdById?: unknown }).createdById;
  return typeof value === "string" ? value : null;
}

export function isOwner(user: UserLike, entity: Ownable) {
  const createdById = readCreatedById(entity);
  if (!user?.id || !createdById) return false;
  return user.id === createdById;
}

export function canEditOwnedEntity(user: UserLike, entity: Ownable) {
  if (!user?.role) return false;
  if (isAdmin(user.role)) return true;
  if (!hasAnyRole(user.role, ["MANAGER", "EDITOR"])) return false;
  return isOwner(user, entity);
}

export const canDeleteOwnedEntity = canEditOwnedEntity;
export const canEditEntity = canEditOwnedEntity;
export const canDeleteEntity = canDeleteOwnedEntity;

