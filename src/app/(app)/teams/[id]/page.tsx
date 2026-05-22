"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeleteTeam, useTeams } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canCreateTeams, canEditEntity } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <li
      className="grid gap-2 border-b py-2.5 text-sm md:grid-cols-[170px_1fr]"
      style={{ borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}
    >
      <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="font-semibold">{String(value)}</p>
    </li>
  );
}

export default function TeamDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamsQuery = useTeams();
  const deleteTeam = useDeleteTeam();
  const { user } = useCurrentUser();
  const team = (teamsQuery.data ?? []).find((item) => item.id === params.id);
  const canEdit = canCreateTeams(user?.role) && canEditEntity(user, team);
  const location = [team?.city, team?.country].filter(Boolean).join(", ");
  const infoRows = [
    { label: "Sport", value: team?.sport },
    { label: "Team Name", value: team?.name },
    { label: "Short Name", value: team?.shortName },
    { label: "City", value: team?.city },
    { label: "Country", value: team?.country },
    { label: "Coach", value: team?.coach },
    { label: "Competition", value: team?.competition },
    { label: "Played", value: team?.played },
    { label: "Wins", value: team?.wins },
    { label: "Draws", value: team?.draws },
    { label: "Losses", value: team?.losses },
    { label: "Goals For", value: team?.goalsFor },
    { label: "Goals Against", value: team?.goalsAgainst },
    { label: "Points", value: team?.points },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "");

  if (teamsQuery.isLoading) return <LoadingSkeleton />;
  if (!team) return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Team not found.</Card>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={team.name}
        description={location || undefined}
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Link href={`/teams/${team.id}/edit`}>
                <Button>Edit</Button>
              </Link>
              <Button
                variant="danger"
                onClick={() => {
                  if (!window.confirm(`Delete ${team.name}?`)) return;
                  deleteTeam.mutate(team.id, { onSuccess: () => router.push("/teams") });
                }}
                disabled={deleteTeam.isPending}
              >
                Delete
              </Button>
            </div>
          ) : null
        }
      />
      <Card className="p-5">
        <div className="grid gap-6 md:grid-cols-[180px_1fr]">
          <div className="flex items-start justify-center md:justify-start">
            {team.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.profileImageUrl}
                alt={`${team.name} profile`}
                width={160}
                height={160}
                className="rounded-2xl border object-cover shadow-sm"
                style={{ borderColor: "var(--border)" }}
              />
            ) : (
              <div
                className="flex h-40 w-40 items-center justify-center rounded-2xl border text-xs uppercase tracking-[0.12em]"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface-2)" }}
              >
                No Image
              </div>
            )}
          </div>
          <ul className="rounded-xl border px-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            {infoRows.map((row) => (
              <InfoRow key={row.label} label={row.label} value={row.value as string | number} />
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
