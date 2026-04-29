"use client";

import { useMemo, useState } from "react";
import { CompetitionStatus, CompetitionType } from "@prisma/client";
import { FavoriteTargetType } from "@prisma/client";
import { useDeleteCompetition, useCompetitions } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useI18n } from "@/lib/i18n";
import { canManageTournaments } from "@/lib/permissions";
import { formatDateDDMMYYYY } from "@/lib/utils/date";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FavoriteButton } from "@/components/ui/favorite-button";
import Link from "next/link";

const typeOptions: Array<CompetitionType | "ALL"> = ["ALL", "TOURNAMENT", "LEAGUE", "FRIENDLY_MATCH"];
const statusOptions: Array<CompetitionStatus | "ALL"> = ["ALL", "DRAFT", "UPCOMING", "ONGOING", "COMPLETED", "ARCHIVED"];

const badgeMap: Record<CompetitionStatus, "draft" | "upcoming" | "ongoing" | "completed" | "inactive" | "active"> = {
  DRAFT: "draft",
  UPCOMING: "upcoming",
  ONGOING: "ongoing",
  COMPLETED: "completed",
  ARCHIVED: "inactive",
};

function formatDateRange(startDate?: string | null, endDate?: string | null) {
  if (!startDate && !endDate) return "TBD";
  const start = startDate ? formatDateDDMMYYYY(startDate) : "?";
  const end = endDate ? formatDateDDMMYYYY(endDate) : "?";
  return `${start} - ${end}`;
}

export default function TournamentsPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CompetitionType | "ALL">("ALL");
  const [status, setStatus] = useState<CompetitionStatus | "ALL">("ALL");

  const filters = useMemo(() => ({ q: query || undefined, type, status }), [query, type, status]);
  const competitionsQuery = useCompetitions(filters);
  const deleteCompetition = useDeleteCompetition();
  const { user } = useCurrentUser();
  const canManage = canManageTournaments(user?.role);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("tournaments.title")}
        description={t("tournaments.description")}
        actions={
          canManage ? (
            <Link href="/tournaments/create">
              <Button variant="primary">{t("tournaments.create")}</Button>
            </Link>
          ) : undefined
        }
      />

      <FilterBar>
        <Input placeholder={t("common.search")} value={query} onChange={(event) => setQuery(event.currentTarget.value)} className="max-w-sm" />
        <Select className="w-52" value={type} onChange={(event) => setType(event.currentTarget.value as CompetitionType | "ALL")}>
              {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? t("tournaments.allTypes") : t(`competition.type.${option}`)}
            </option>
          ))}
        </Select>
        <Select className="w-52" value={status} onChange={(event) => setStatus(event.currentTarget.value as CompetitionStatus | "ALL")}>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? t("tournaments.allStatuses") : t(`competition.status.${option}`)}
            </option>
          ))}
        </Select>
        <Button onClick={() => competitionsQuery.refetch()} disabled={competitionsQuery.isFetching}>
          {competitionsQuery.isFetching ? t("common.loading") : t("common.refresh")}
        </Button>
      </FilterBar>

      {competitionsQuery.isLoading ? (
        <Card className="p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("common.loading")}
        </Card>
      ) : null}

      {competitionsQuery.isError ? (
        <Card className="p-5 text-sm" style={{ color: "var(--danger)" }}>
          {(competitionsQuery.error as Error).message}
        </Card>
      ) : null}

      <div className="space-y-3">
        {competitionsQuery.data?.map((item) => (
          <Card key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <FavoriteButton targetType={FavoriteTargetType.COMPETITION} targetId={item.id} />
                <h3 className="text-2xl font-semibold">{item.name}</h3>
                <Badge variant={badgeMap[item.status]}>{t(`competition.status.${item.status}`)}</Badge>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {t(`competition.type.${item.type}`)}
                </span>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                {item.location} • {formatDateRange(item.startDate ?? null, item.endDate ?? null)}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span>{item.teamsCount} {t("tournaments.teams")}</span>
                <span>{item.matchesCount} {t("tournaments.matches")}</span>
                <span>{item.liveMatches} {t("tournaments.live")}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/matches?competitionId=${item.id}`}>
                <Button>{t("tournaments.openMatches")}</Button>
              </Link>
              {canManage ? (
                <Link href={`/tournaments/${item.id}/edit`}>
                  <Button>Edit</Button>
                </Link>
              ) : null}
              <Link href={`/draws/${item.id}`}>
                <Button>{item.type === "TOURNAMENT" ? "Open Draw" : "League Info"}</Button>
              </Link>
              {canManage ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (!window.confirm(`Delete ${item.name}?`)) return;
                    deleteCompetition.mutate(item.id);
                  }}
                  disabled={deleteCompetition.isPending}
                >
                  {t("tournaments.delete")}
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {competitionsQuery.data?.length === 0 && !competitionsQuery.isLoading ? (
        <Card className="p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("tournaments.empty")}
        </Card>
      ) : null}
    </div>
  );
}
