"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useDeletePlayer, usePlayers } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canEditContent } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateDDMMYYYY } from "@/lib/utils/date";

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li
      className="grid gap-2 border-b py-2.5 text-sm md:grid-cols-[170px_1fr]"
      style={{ borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}
    >
      <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <div className="font-semibold">{value}</div>
    </li>
  );
}

export default function PlayerDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const playersQuery = usePlayers();
  const deletePlayer = useDeletePlayer();
  const { user } = useCurrentUser();
  const canEdit = canEditContent(user?.role);
  const player = (playersQuery.data ?? []).find((item) => item.id === params.id);
  const infoRows = [
    { label: "Sport", value: player?.sport },
    {
      label: "Team",
      value: player?.team ? (
        <span className="inline-flex items-center gap-2">
          {player.teamProfileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.teamProfileImageUrl}
              alt={`${player.team} logo`}
              width={20}
              height={20}
              className="rounded object-cover"
            />
          ) : null}
          <span>{player.team}</span>
        </span>
      ) : null,
    },
    { label: "First Name", value: player?.firstName },
    { label: "Last Name", value: player?.lastName },
    { label: "Position", value: player?.position },
    { label: "Jersey Number", value: player?.number },
    { label: "Date of Birth", value: player?.dateOfBirth ? formatDateDDMMYYYY(player.dateOfBirth) : null },
    { label: "Place of Birth", value: player?.placeOfBirth },
    { label: "Citizenship / Nationality", value: player?.nationalities.length ? player.nationalities.join(", ") : player?.nationality },
    { label: "Height", value: player?.heightCm ? `${player.heightCm} cm` : null },
    { label: "Weight", value: player?.weightKg ? `${player.weightKg} kg` : null },
    { label: "Status", value: player?.status },
    { label: "Dominant Foot", value: player?.dominantFoot },
    { label: "Age", value: player?.age },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "");

  if (playersQuery.isLoading) return <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading player...</Card>;
  if (!player) return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Player not found.</Card>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={player.fullName}
        description={[player.team, player.position, player.number ? `#${player.number}` : null].filter(Boolean).join(" - ")}
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Link href={`/players/${player.id}/edit`}>
                <Button>Edit</Button>
              </Link>
              <Button
                variant="danger"
                onClick={() => {
                  if (!window.confirm(`Delete ${player.fullName}?`)) return;
                  deletePlayer.mutate(player.id, { onSuccess: () => router.push("/players") });
                }}
                disabled={deletePlayer.isPending}
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
            {player.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.profileImageUrl}
                alt={`${player.fullName} profile`}
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
              <InfoRow key={row.label} label={row.label} value={row.value as ReactNode} />
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
