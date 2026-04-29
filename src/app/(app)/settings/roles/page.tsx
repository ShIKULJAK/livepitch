"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useUpdateUserRole, useUsers } from "@/hooks/use-competitions";
import { canManageRoles } from "@/lib/permissions";
import { SettingsTemplate } from "@/components/settings/settings-template";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

const roleDescriptions: Record<"ADMIN" | "MANAGER" | "EDITOR" | "VIEWER", string> = {
  ADMIN: "Full access to all features",
  MANAGER: "Manage teams, matches and tournaments",
  EDITOR: "Can edit content and manage matches",
  VIEWER: "View-only access",
};

export default function RolesSettingsPage() {
  const { user } = useCurrentUser();
  const usersQuery = useUsers();
  const updateRole = useUpdateUserRole();

  return (
    <SettingsTemplate
      title="Roles & Permissions"
      description="Manage user roles and access control."
      aside={<Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Only Admin users can change roles.</Card>}
    >
      <div className="space-y-2">
        {(usersQuery.data ?? []).map((entry) => (
          <div key={entry.id} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_180px_180px] md:items-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            <div>
              <p className="font-semibold">{entry.name}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{entry.email}</p>
            </div>
            <p className="text-sm">{roleDescriptions[entry.role]}</p>
            <Select
              value={entry.role}
              disabled={!canManageRoles(user?.role) || updateRole.isPending}
              onChange={(event) => updateRole.mutate({ userId: entry.id, role: event.currentTarget.value as "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER" })}
            >
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </Select>
          </div>
        ))}
      </div>

      {usersQuery.isLoading ? <Card className="mt-3 p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading users...</Card> : null}
      {usersQuery.isError ? <Card className="mt-3 p-4 text-sm" style={{ color: "var(--danger)" }}>{(usersQuery.error as Error).message}</Card> : null}
      {updateRole.isError ? <Card className="mt-3 p-4 text-sm" style={{ color: "var(--danger)" }}>{(updateRole.error as Error).message}</Card> : null}
    </SettingsTemplate>
  );
}
