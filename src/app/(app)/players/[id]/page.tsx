"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDeletePlayer, usePlayers } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canCreatePlayers, canEditEntity } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { NationalityList } from "@/components/ui/nationality-badge";
import { formatDateDDMMYYYY } from "@/lib/utils/date";

function toPlayerSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function StatPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      className="rounded-xl border px-3 py-2"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "color-mix(in srgb, var(--surface-1) 65%, transparent)",
      }}
    >
      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AttributeRing({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-semibold"
        style={{
          borderColor: "color-mix(in srgb, #4f7cff 65%, var(--border))",
          boxShadow: "0 0 0 2px color-mix(in srgb, #4f7cff 20%, transparent) inset",
        }}
      >
        {safe}
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
    </div>
  );
}

function RadarChart({
  values,
}: {
  values: Array<{ key: string; label: string; value: number }>;
}) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 84;
  const points = values.map((item, index) => {
    const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / values.length;
    const radius = (Math.max(0, Math.min(100, item.value)) / 100) * maxRadius;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      labelX: cx + (maxRadius + 26) * Math.cos(angle),
      labelY: cy + (maxRadius + 26) * Math.sin(angle),
      value: item.value,
      label: item.label,
    };
  });
  const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const levels = [20, 40, 60, 80, 100];

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
        Player Radar
      </p>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block h-[240px] w-[240px]">
        {levels.map((level) => {
          const ring = values
            .map((_, index) => {
              const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / values.length;
              const radius = (level / 100) * maxRadius;
              return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
            })
            .join(" ");
          return (
            <polygon
              key={level}
              points={ring}
              fill="none"
              stroke="color-mix(in srgb, var(--border) 70%, transparent)"
              strokeWidth="1"
            />
          );
        })}
        {values.map((_, index) => {
          const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / values.length;
          const x = cx + maxRadius * Math.cos(angle);
          const y = cy + maxRadius * Math.sin(angle);
          return <line key={index} x1={cx} y1={cy} x2={x} y2={y} stroke="color-mix(in srgb, var(--border) 75%, transparent)" strokeWidth="1" />;
        })}
        <polygon
          points={polygonPoints}
          fill="color-mix(in srgb, #4f7cff 32%, transparent)"
          stroke="#4f7cff"
          strokeWidth="2"
        />
        {points.map((point) => (
          <circle key={`${point.label}-dot`} cx={point.x} cy={point.y} r="3" fill="#8fb0ff" />
        ))}
        {points.map((point) => (
          <text
            key={point.label}
            x={point.labelX}
            y={point.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-secondary)"
            fontSize="10"
          >
            {point.label} {point.value}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function PlayerDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const playersQuery = usePlayers();
  const deletePlayer = useDeletePlayer();
  const { user } = useCurrentUser();
  const player = (playersQuery.data ?? []).find((item) => item.id === params.id || toPlayerSlug(item.fullName) === params.id);
  const canEdit = canCreatePlayers(user?.role) && canEditEntity(user, player);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const seasonOverviewQuery = useQuery({
    queryKey: ["player-season-overview", params.id, selectedSeasonId],
    enabled: Boolean(params.id),
    queryFn: async () => {
      const qs = selectedSeasonId ? `?seasonId=${encodeURIComponent(selectedSeasonId)}` : "";
      const response = await fetch(`/api/players/${params.id}/overview${qs}`);
      if (!response.ok) throw new Error("Failed to load season overview");
      const json = (await response.json()) as {
        data: {
          season: number;
          selectedSeasonId: string | null;
          seasons: Array<{ seasonId: string; seasonLabel: string | null }>;
          rows: Array<{
            competition: string;
            matches: number;
            goals: number;
            assists: number;
            minutes: number;
            rating: number;
          }>;
          total: {
            competition: string;
            matches: number;
            goals: number;
            assists: number;
            minutes: number;
            rating: number;
          };
        };
      };
      return json.data;
    },
  });

  useEffect(() => {
    if (!seasonOverviewQuery.data?.selectedSeasonId) return;
    if (!selectedSeasonId) {
      setSelectedSeasonId(seasonOverviewQuery.data.selectedSeasonId);
    }
  }, [seasonOverviewQuery.data?.selectedSeasonId, selectedSeasonId]);

  useEffect(() => {
    if (!player) return;
    const canonicalSlug = toPlayerSlug(player.fullName);
    if (params.id !== canonicalSlug) {
      router.replace(`/players/${canonicalSlug}`);
    }
  }, [params.id, player, router]);

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
    {
      label: "Citizenship / Nationality",
      value: <NationalityList nationalities={player?.nationalities} fallback={player?.nationality} />,
    },
    { label: "Height", value: player?.heightCm ? `${player.heightCm} cm` : null },
    { label: "Weight", value: player?.weightKg ? `${player.weightKg} kg` : null },
    { label: "Status", value: player?.status },
    { label: "Dominant Foot", value: player?.dominantFoot },
    { label: "Age", value: player?.age },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "");

  const clubHistory = (player?.clubHistory ?? []).slice().sort((a, b) => b.fromYear - a.fromYear);
  const radarValues = [
    { key: "def", label: "Def", value: player?.radarDefending ?? 60 },
    { key: "phy", label: "Phy", value: player?.radarPhysical ?? 60 },
    { key: "spd", label: "Spd", value: player?.radarSpeed ?? 60 },
    { key: "pas", label: "Pas", value: player?.radarPassing ?? 60 },
    { key: "iq", label: "IQ", value: player?.radarGameIQ ?? 60 },
  ];

  if (playersQuery.isLoading) return <LoadingSkeleton />;
  if (!player) return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Player not found.</Card>;

  return (
    <div className="space-y-4">
      <Card
        className="overflow-hidden p-5 md:p-6"
        style={{
          background:
            "radial-gradient(circle at 78% -12%, color-mix(in srgb, #3d6fff 22%, transparent) 0%, transparent 44%), linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 90%, #020917) 0%, color-mix(in srgb, var(--surface-2) 85%, #040d1f) 100%)",
        }}
      >
        <div className="grid gap-6 md:grid-cols-[170px_1fr]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              {player.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.profileImageUrl}
                  alt={`${player.fullName} profile`}
                  width={170}
                  height={170}
                  className="h-[170px] w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-[170px] items-center justify-center text-xs uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-2)" }}
                >
                  No Image
                </div>
              )}
            </div>
            <div
              className="hidden rounded-xl border p-3 text-xs md:block"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "color-mix(in srgb, var(--surface-1) 75%, transparent)" }}
            >
              <p className="font-semibold uppercase tracking-wide">Live Pitch</p>
              <p className="mt-1">Player Profile</p>
            </div>
          </div>
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

            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <StatPill label="Pozicija" value={player.position} />
              <StatPill label="Dres" value={player.number ?? "-"} />
              <StatPill label="Godine" value={player.age ?? "-"} />
              <StatPill label="Visina" value={player.heightCm ? `${player.heightCm} cm` : "-"} />
              <StatPill label="Težina" value={player.weightKg ? `${player.weightKg} kg` : "-"} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <ul className="rounded-xl border px-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                  {infoRows.map((row) => (
                    <InfoRow key={row.label} label={row.label} value={row.value as ReactNode} />
                  ))}
                </ul>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Player Bio
                  </p>
                  <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                    {player.bio?.trim() || "Bio nije unesen."}
                  </p>
                  <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                    <p className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Key Attributes
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      <AttributeRing label="Def" value={radarValues[0].value} />
                      <AttributeRing label="Phy" value={radarValues[1].value} />
                      <AttributeRing label="Spd" value={radarValues[2].value} />
                      <AttributeRing label="Pas" value={radarValues[3].value} />
                      <AttributeRing label="IQ" value={radarValues[4].value} />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Positions
                  </p>
                  <div className="grid gap-1 text-sm">
                    <p>
                      <span style={{ color: "var(--text-secondary)" }}>Primary: </span>
                      <span className="font-semibold">{player.position || "-"}</span>
                    </p>
                    <p>
                      <span style={{ color: "var(--text-secondary)" }}>Secondary: </span>
                      <span className="font-semibold">{player.dominantFoot === "BOTH" ? "Flexible role" : "N/A"}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <RadarChart values={radarValues} />
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Season Overview
                    </p>
                    <select
                      className="rounded-md border px-2 py-0.5 text-xs"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface-1)" }}
                      value={selectedSeasonId || seasonOverviewQuery.data?.selectedSeasonId || ""}
                      onChange={(event) => setSelectedSeasonId(event.currentTarget.value)}
                    >
                      {(seasonOverviewQuery.data?.seasons ?? []).map((season) => (
                        <option key={season.seasonId} value={season.seasonId}>
                          {season.seasonLabel ?? season.seasonId}
                        </option>
                      ))}
                    </select>
                  </div>
                  {seasonOverviewQuery.isLoading ? (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Učitavanje...</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-6 gap-2 font-medium" style={{ color: "var(--text-secondary)" }}>
                        <span>Comp</span><span>M</span><span>G</span><span>A</span><span>Min</span><span>Rate</span>
                      </div>
                      {(seasonOverviewQuery.data?.rows ?? []).map((row) => (
                        <div key={row.competition} className="grid grid-cols-6 gap-2">
                          <span>{row.competition}</span>
                          <span>{row.matches}</span>
                          <span>{row.goals}</span>
                          <span>{row.assists}</span>
                          <span>{row.minutes}</span>
                          <span>{row.rating ? row.rating.toFixed(1) : "-"}</span>
                        </div>
                      ))}
                      {seasonOverviewQuery.data?.total ? (
                        <div className="grid grid-cols-6 gap-2 border-t pt-2 font-semibold" style={{ borderColor: "var(--border)" }}>
                          <span>Total</span>
                          <span>{seasonOverviewQuery.data.total.matches}</span>
                          <span>{seasonOverviewQuery.data.total.goals}</span>
                          <span>{seasonOverviewQuery.data.total.assists}</span>
                          <span>{seasonOverviewQuery.data.total.minutes}</span>
                          <span>{seasonOverviewQuery.data.total.rating ? seasonOverviewQuery.data.total.rating.toFixed(1) : "-"}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Istorija klubova
                    </p>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{
                        color: "var(--text-secondary)",
                        backgroundColor: "color-mix(in srgb, var(--surface-1) 80%, transparent)",
                      }}
                    >
                      {clubHistory.length} zapisa
                    </span>
                  </div>

                  {clubHistory.length ? (
                    <ul className="space-y-3">
                      {clubHistory.map((entry, index) => (
                        <li
                          key={entry.id}
                          className="relative rounded-lg border px-3 py-3 pl-5 md:px-4 md:pl-6"
                          style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--surface-1) 72%, transparent)" }}
                        >
                          <span
                            className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                            style={{ backgroundColor: index === 0 && !entry.toYear ? "#4f7cff" : "var(--text-secondary)" }}
                          />
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{entry.teamName}</p>
                              <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                                {index === 0 ? "Aktuelni ili posljednji klub" : "Prethodni klub"}
                              </p>
                            </div>
                            <span
                              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
                              style={{
                                color: entry.toYear ? "var(--text-secondary)" : "#8fb0ff",
                                backgroundColor: entry.toYear
                                  ? "color-mix(in srgb, var(--surface-1) 70%, transparent)"
                                  : "color-mix(in srgb, #4f7cff 16%, transparent)",
                              }}
                            >
                              {entry.fromYear} - {entry.toYear ?? "danas"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div
                      className="rounded-lg border px-3 py-4 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-secondary)",
                        backgroundColor: "color-mix(in srgb, var(--surface-1) 70%, transparent)",
                      }}
                    >
                      Nema podataka o promjeni klubova.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <p className="mb-2 text-sm font-semibold">Achievements</p>
                <ul className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {(player.achievements?.length ? player.achievements : ["Team Spirit Award", "Most Improved Player", "Fair Play Award"]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <p className="mb-2 text-sm font-semibold">Strengths</p>
                <ul className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {(player.strengths?.length ? player.strengths : ["Tactical awareness", "Positioning", "Work ethic"]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <p className="mb-2 text-sm font-semibold">Areas for Improvement</p>
                <ul className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {(player.improvements?.length ? player.improvements : ["Endurance", "Crossing", "Shooting"]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <p className="mb-2 text-sm font-semibold">Coach&apos;s Note</p>
                <p className="text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                  {player.coachNote?.trim() || `${player.firstName ?? player.fullName} pokazuje stabilan napredak i dobar odnos prema treningu.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
