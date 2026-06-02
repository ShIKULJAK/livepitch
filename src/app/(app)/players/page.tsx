"use client";

import Link from "next/link";
import { useDeletePlayer, usePlayers, useTeams } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NationalityBadge, NationalityList } from "@/components/ui/nationality-badge";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { canCreatePlayers, canEditEntity } from "@/lib/permissions";

function toPlayerSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPlayerInitials(firstName?: string | null, lastName?: string | null, fullName?: string | null) {
  const fn = firstName?.trim();
  const ln = lastName?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();

  const parts = (fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return "IG";
}

type PlayerViewTab = "ALL" | "BY_TEAM" | "GOAL_SCORERS" | "TOP_ASSISTS" | "TOP_RATED";

const playerViewTabs: Array<{ id: PlayerViewTab; label: string }> = [
  { id: "ALL", label: "All Players" },
  { id: "BY_TEAM", label: "By Team" },
  { id: "GOAL_SCORERS", label: "Goal Scorers" },
  { id: "TOP_ASSISTS", label: "Top Assists" },
  { id: "TOP_RATED", label: "Top Rated" },
];

function getPlayerOverall(player: {
  radarDefending?: number | null;
  radarPhysical?: number | null;
  radarSpeed?: number | null;
  radarPassing?: number | null;
  radarGameIQ?: number | null;
}) {
  const radarValues = [
    player.radarDefending ?? 60,
    player.radarPhysical ?? 60,
    player.radarSpeed ?? 60,
    player.radarPassing ?? 60,
    player.radarGameIQ ?? 60,
  ];
  return Math.round(radarValues.reduce((sum, current) => sum + current, 0) / radarValues.length);
}

function getPlayerGoals(player: { goals?: number | null }) {
  return player.goals ?? 0;
}

function getPlayerAssists(player: { assists?: number | null }) {
  return player.assists ?? 0;
}

export default function PlayersPage() {
  const { t } = useI18n();
  const playersQuery = usePlayers();
  const teamsQuery = useTeams();
  const { user } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [tournamentFilter, setTournamentFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [nationalityFilter, setNationalityFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("OVR_DESC");
  const [activeTab, setActiveTab] = useState<PlayerViewTab>("ALL");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [openMenuPlayerId, setOpenMenuPlayerId] = useState<string | null>(null);
  const canCreate = canCreatePlayers(user?.role);
  const deletePlayer = useDeletePlayer();

  const teamOptions = useMemo(
    () =>
      (teamsQuery.data ?? [])
        .map((team) => ({ id: team.id, name: team.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teamsQuery.data]
  );

  const positionOptions = useMemo(
    () =>
      Array.from(
        new Set((playersQuery.data ?? []).map((player) => player.position.trim()).filter((position) => position.length > 0))
      ).sort((a, b) => a.localeCompare(b)),
    [playersQuery.data]
  );
  const nationalityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (playersQuery.data ?? [])
            .flatMap((player) => (player.nationalities.length ? player.nationalities : player.nationality ? [player.nationality] : []))
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [playersQuery.data]
  );

  const rows = useMemo(
    () => {
      const filtered = (playersQuery.data ?? []).filter((player) => {
        const matchesQuery = player.fullName.toLowerCase().includes(query.toLowerCase().trim());
        const matchesTournament = tournamentFilter === "ALL";
        const matchesTeam = teamFilter === "ALL" || player.teamId === teamFilter;
        const matchesPosition = positionFilter === "ALL" || player.position === positionFilter;
        const playerNationalities = player.nationalities.length
          ? player.nationalities
          : player.nationality
            ? [player.nationality]
            : [];
        const matchesNationality =
          nationalityFilter === "ALL" || playerNationalities.some((item) => item.toLowerCase() === nationalityFilter.toLowerCase());
        return matchesQuery && matchesTournament && matchesTeam && matchesPosition && matchesNationality;
      });

      const sorted = [...filtered];
      if (activeTab === "BY_TEAM") {
        sorted.sort((a, b) => a.team.localeCompare(b.team) || a.fullName.localeCompare(b.fullName));
      } else if (activeTab === "GOAL_SCORERS") {
        sorted.sort((a, b) => getPlayerGoals(b) - getPlayerGoals(a) || a.fullName.localeCompare(b.fullName));
        return sorted.filter((player) => getPlayerGoals(player) > 0);
      } else if (activeTab === "TOP_ASSISTS") {
        sorted.sort((a, b) => getPlayerAssists(b) - getPlayerAssists(a) || a.fullName.localeCompare(b.fullName));
        return sorted.filter((player) => getPlayerAssists(player) > 0);
      } else if (activeTab === "TOP_RATED") {
        sorted.sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a) || a.fullName.localeCompare(b.fullName));
      } else if (sortBy === "OVR_DESC") {
        sorted.sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));
      } else if (sortBy === "AGE_DESC") {
        sorted.sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
      } else if (sortBy === "AGE_ASC") {
        sorted.sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
      } else if (sortBy === "NAME_ASC") {
        sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
      }
      return sorted;
    },
    [playersQuery.data, query, tournamentFilter, teamFilter, positionFilter, nationalityFilter, sortBy, activeTab]
  );
  const selectedPlayer = useMemo(() => {
    if (!rows.length) return null;
    return rows.find((item) => item.id === selectedPlayerId) ?? rows[0];
  }, [rows, selectedPlayerId]);

  function renderAttrBar(value: number) {
    const safe = Math.max(0, Math.min(100, value));
    return (
      <div className="space-y-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${safe}%`,
              background: "linear-gradient(90deg, #75e21a 0%, #9beb3c 100%)",
            }}
          />
        </div>
        <p className="text-right text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {safe}
        </p>
      </div>
    );
  }

  function renderRadar(values: number[]) {
    const labels = ["DEF", "PHY", "SPD", "PAS", "IQ"];
    const size = 170;
    const center = size / 2;
    const maxRadius = 58;
    const points = values.map((raw, index) => {
      const safe = Math.max(0, Math.min(100, raw));
      const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
      const radius = (safe / 100) * maxRadius;
      return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
    });
    const axis = values.map((_, index) => {
      const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
      return {
        x: center + Math.cos(angle) * maxRadius,
        y: center + Math.sin(angle) * maxRadius,
      };
    });

    return (
      <div className="mx-auto w-[210px]">
        <svg viewBox={`0 0 210 210`} className="mx-auto h-[210px] w-[210px]">
          <g transform="translate(20,20)">
          {[20, 40, 60, 80, 100].map((step) => {
            const layerPoints = values.map((_, index) => {
              const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
              const radius = (step / 100) * maxRadius;
              return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
            });
            return (
              <polygon
                key={step}
                points={layerPoints.join(" ")}
                fill="none"
                stroke="color-mix(in srgb, var(--border) 75%, transparent)"
                strokeWidth="1"
              />
            );
          })}
          {axis.map((node, index) => (
            <line
              key={`axis-${labels[index]}`}
              x1={center}
              y1={center}
              x2={node.x}
              y2={node.y}
              stroke="color-mix(in srgb, var(--border) 75%, transparent)"
              strokeWidth="1"
            />
          ))}
          <polygon
            points={points.join(" ")}
            fill="color-mix(in srgb, #6c4aff 55%, transparent)"
            stroke="color-mix(in srgb, #8e7cff 70%, #6c4aff 30%)"
            strokeWidth="2"
          />
          {axis.map((node, index) => {
            const dx = node.x - center;
            const dy = node.y - center;
            const labelX = node.x + Math.sign(dx || 1) * 18;
            const labelY = node.y + (dy < -8 ? -10 : dy > 8 ? 12 : 4);
            const value = Math.max(0, Math.min(100, values[index] ?? 0));
            return (
              <text
                key={`label-${labels[index]}`}
                x={labelX}
                y={labelY}
                fontSize="11"
                fill="var(--text-secondary)"
                textAnchor={dx > 8 ? "start" : dx < -8 ? "end" : "middle"}
              >
                {labels[index][0] + labels[index].slice(1).toLowerCase()} {value}
              </text>
            );
          })}
          </g>
        </svg>
      </div>
    );
  }

  function renderPlayerPanel(player: NonNullable<typeof selectedPlayer>) {
    const radarValues = [
      player.radarDefending ?? 60,
      player.radarPhysical ?? 60,
      player.radarSpeed ?? 60,
      player.radarPassing ?? 60,
      player.radarGameIQ ?? 60,
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: "var(--border)" }}>
          {player.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.profileImageUrl}
              alt={player.fullName}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border object-cover"
              style={{ borderColor: "var(--border)" }}
            />
          ) : (
            <span
              className="inline-flex h-16 w-16 items-center justify-center rounded-full border text-base font-semibold"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
            >
              {getPlayerInitials(player.firstName, player.lastName, player.fullName)}
            </span>
          )}
          <div>
            <p className="text-lg font-semibold text-white">{player.fullName}</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {player.team} • {player.position}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
            <p style={{ color: "var(--text-secondary)" }}>Age</p>
            <p className="font-semibold text-white">{player.age ?? "-"}</p>
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
            <p style={{ color: "var(--text-secondary)" }}>Number</p>
            <p className="font-semibold text-white">{player.number ?? "-"}</p>
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
            <p style={{ color: "var(--text-secondary)" }}>Height</p>
            <p className="font-semibold text-white">{player.heightCm ? `${player.heightCm} cm` : "-"}</p>
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
            <p style={{ color: "var(--text-secondary)" }}>Weight</p>
            <p className="font-semibold text-white">{player.weightKg ? `${player.weightKg} kg` : "-"}</p>
          </div>
        </div>
        <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-white">Overview</p>
          <div className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <span style={{ color: "var(--text-secondary)" }}>Nationality</span>
            <NationalityList nationalities={player.nationalities} fallback={player.nationality} className="text-white" />
            <span style={{ color: "var(--text-secondary)" }}>Date of Birth</span>
            <span className="text-white">{player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString() : "-"}</span>
            <span style={{ color: "var(--text-secondary)" }}>Dominant Foot</span>
            <span className="text-white">{player.dominantFoot}</span>
          </div>
        </div>
        <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-white">Player Radar</p>
          {renderRadar(radarValues)}
        </div>
        <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-white">Key Attributes</p>
          <div className="space-y-2 text-xs">
            <div>
              <p style={{ color: "var(--text-secondary)" }}>Defending</p>
              {renderAttrBar(player.radarDefending ?? 60)}
            </div>
            <div>
              <p style={{ color: "var(--text-secondary)" }}>Physical</p>
              {renderAttrBar(player.radarPhysical ?? 60)}
            </div>
            <div>
              <p style={{ color: "var(--text-secondary)" }}>Speed</p>
              {renderAttrBar(player.radarSpeed ?? 60)}
            </div>
            <div>
              <p style={{ color: "var(--text-secondary)" }}>Passing</p>
              {renderAttrBar(player.radarPassing ?? 60)}
            </div>
            <div>
              <p style={{ color: "var(--text-secondary)" }}>Game IQ</p>
              {renderAttrBar(player.radarGameIQ ?? 60)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("players.title")}
        description={t("players.description")}
        actions={
          canCreate ? (
            <Link href="/players/create">
              <Button variant="primary">Create Player</Button>
            </Link>
          ) : null
        }
      />
      <Card className="p-4 md:p-5">
        <div className="space-y-4 border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            {playerViewTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className="border-b-2 pb-2 font-semibold transition-colors"
                  style={{
                    borderColor: isActive ? "var(--primary)" : "transparent",
                    color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  }}
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedPlayerId(null);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select className="min-w-[160px] flex-1 md:flex-none md:w-44" value={tournamentFilter} onChange={(event) => setTournamentFilter(event.currentTarget.value)}>
              <option value="ALL">All Tournaments</option>
            </Select>
            <Select className="min-w-[160px] flex-1 md:flex-none md:w-44" value={teamFilter} onChange={(event) => setTeamFilter(event.currentTarget.value)}>
              <option value="ALL">All Teams</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
            <Select className="min-w-[160px] flex-1 md:flex-none md:w-44" value={positionFilter} onChange={(event) => setPositionFilter(event.currentTarget.value)}>
              <option value="ALL">All Positions</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </Select>
            <Select className="min-w-[170px] flex-1 md:flex-none md:w-44" value={nationalityFilter} onChange={(event) => setNationalityFilter(event.currentTarget.value)}>
              <option value="ALL">All Nationalities</option>
              {nationalityOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select className="min-w-[170px] flex-1 md:flex-none md:w-44" value={sortBy} onChange={(event) => setSortBy(event.currentTarget.value)}>
              <option value="OVR_DESC">Sort by: Overall Rating</option>
              <option value="AGE_DESC">Sort by: Age Desc</option>
              <option value="AGE_ASC">Sort by: Age Asc</option>
              <option value="NAME_ASC">Sort by: Name A-Z</option>
            </Select>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border text-sm"
              style={{
                borderColor: viewMode === "list" ? "var(--primary)" : "var(--border)",
                color: viewMode === "list" ? "var(--primary)" : "var(--text-secondary)",
              }}
              aria-label="View list"
              onClick={() => setViewMode("list")}
            >
              ☰
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border text-sm"
              style={{
                borderColor: viewMode === "grid" ? "var(--primary)" : "var(--border)",
                color: viewMode === "grid" ? "var(--primary)" : "var(--text-secondary)",
              }}
              aria-label="Overall view"
              onClick={() => setViewMode("grid")}
            >
              ⊞
            </button>
            <Input placeholder={t("common.search")} className="w-full md:ml-auto md:w-56" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto lp-scrollbar">
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: "var(--surface-2)" }}>
                  <tr>
                    {["#", "Player", "Team", "Position", "Nat", "Age", "OVR", "Apps", "Goals", "Assists", "Rating", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-center text-xs uppercase" style={{ color: "var(--text-secondary)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((player, index) => {
                    const canEditRow = canEditEntity(user, player);
                    const radarValues = [
                      player.radarDefending ?? 60,
                      player.radarPhysical ?? 60,
                      player.radarSpeed ?? 60,
                      player.radarPassing ?? 60,
                      player.radarGameIQ ?? 60,
                    ];
                    const overall = getPlayerOverall(player);
                    const isSelected = selectedPlayer?.id === player.id;
                    const nat = player.nationalities[0] ?? player.nationality ?? null;
                    const apps = "-";
                    const goals = getPlayerGoals(player);
                    const assists = getPlayerAssists(player);
                    const rating = overall;

                    return (
                      <tr
                        key={player.id}
                        className="cursor-pointer border-t transition-colors"
                        style={{
                          borderColor: "var(--border)",
                          backgroundColor: isSelected ? "color-mix(in srgb, var(--surface-2) 70%, transparent)" : "transparent",
                        }}
                        onClick={() => {
                          setSelectedPlayerId(player.id);
                          setOpenMenuPlayerId(null);
                          if (window.matchMedia("(max-width: 1279px)").matches) {
                            setMobilePanelOpen(true);
                          }
                        }}
                      >
                        <td className="px-4 py-3 text-center">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {player.profileImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={player.profileImageUrl}
                                alt={player.fullName}
                                width={34}
                                height={34}
                                className="h-[34px] w-[34px] rounded-full border object-cover"
                                style={{ borderColor: "var(--border)" }}
                              />
                            ) : (
                              <span
                                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border text-xs font-semibold"
                                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                              >
                                {getPlayerInitials(player.firstName, player.lastName, player.fullName)}
                              </span>
                            )}
                            <div>
                              <p className="font-medium">{player.fullName}</p>
                              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                {player.number ? `#${player.number}` : "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{player.team}</td>
                        <td className="px-4 py-3 text-center">{player.position}</td>
                        <td className="px-4 py-3 text-center">
                          <NationalityBadge nationality={nat} />
                        </td>
                        <td className="px-4 py-3 text-center">{player.age ?? "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="rounded-md px-2 py-1 text-xs font-semibold"
                            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)", color: "var(--primary)" }}
                          >
                            {overall}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">{apps}</td>
                        <td className="px-4 py-3 text-center">{goals}</td>
                        <td className="px-4 py-3 text-center">{assists}</td>
                        <td className="px-4 py-3 text-center">{rating}</td>
                        <td className="relative px-4 py-3">
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1 text-xs"
                              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenMenuPlayerId((current) => (current === player.id ? null : player.id));
                              }}
                            >
                              ...
                            </button>
                          </div>
                          {openMenuPlayerId === player.id ? (
                            <div
                              className="absolute right-2 top-10 z-20 w-36 rounded-lg border p-1 text-xs shadow-lg"
                              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                            >
                              <Link
                                href={`/players/${toPlayerSlug(player.fullName)}`}
                                className="block rounded-md px-2 py-1 hover:opacity-90"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Open profile
                              </Link>
                              {canEditRow ? (
                                <>
                                  <Link
                                    href={`/players/${player.id}/edit`}
                                    className="block rounded-md px-2 py-1 hover:opacity-90"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    Edit player
                                  </Link>
                                  <button
                                    type="button"
                                    className="block w-full rounded-md px-2 py-1 text-left hover:opacity-90"
                                    style={{ color: "var(--danger)" }}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (!window.confirm(`Delete ${player.fullName}?`)) return;
                                      deletePlayer.mutate(player.id);
                                      setOpenMenuPlayerId(null);
                                    }}
                                  >
                                    Delete player
                                  </button>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="h-fit p-4 xl:sticky xl:top-20">
            {selectedPlayer ? (
              renderPlayerPanel(selectedPlayer)
            ) : (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Nema igrača za prikaz.
              </p>
            )}
          </Card>
        </div>
      </Card>

      {playersQuery.isLoading ? <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>{t("players.loading")}</Card> : null}
      {playersQuery.isError ? <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>{(playersQuery.error as Error).message}</Card> : null}
      {mobilePanelOpen && selectedPlayer ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(2, 8, 22, 0.7)" }}
            onClick={() => setMobilePanelOpen(false)}
            aria-label="Zatvori panel"
          />
          <div
            className="absolute right-0 top-0 h-full w-[92%] max-w-[360px] overflow-y-auto border-l p-4 shadow-2xl"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Player Overview</p>
              <Button type="button" variant="ghost" onClick={() => setMobilePanelOpen(false)}>
                Close
              </Button>
            </div>
            {renderPlayerPanel(selectedPlayer)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
