"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCompetitionSeasons, useDrawCompetitions } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Select } from "@/components/ui/select";

export default function DrawsPage() {
  const seasonsQuery = useCompetitionSeasons();
  const [seasonYear, setSeasonYear] = useState<string>("ALL");
  const didApplyDefaultSeason = useRef(false);
  useEffect(() => {
    if (!seasonsQuery.data) return;
    if (didApplyDefaultSeason.current) return;
    const currentYear = String(new Date().getFullYear());
    const hasCurrentYear = seasonsQuery.data.years.some((entry) => entry.year === currentYear);
    if (hasCurrentYear) setSeasonYear(currentYear);
    didApplyDefaultSeason.current = true;
  }, [seasonsQuery.data]);
  const drawCompetitionsQuery = useDrawCompetitions(seasonYear !== "ALL" ? seasonYear : undefined);

  return (
    <div className="space-y-4">
      <PageHeader title="Izvlacenje" description="Manage group draws and knockout bracket generation for competitions." />
      <Card className="p-3">
        <div className="max-w-xs">
          <Select value={seasonYear} onChange={(event) => setSeasonYear(event.currentTarget.value)}>
            <option value="ALL">Sve sezone</option>
            {seasonsQuery.data?.years.map((item) => (
              <option key={item.year} value={item.year}>
                {item.year}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {drawCompetitionsQuery.isLoading ? (
        <>
          <LoadingSkeleton />
          <LoadingSkeleton />
        </>
      ) : null}

      {drawCompetitionsQuery.isError ? (
        <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
          {(drawCompetitionsQuery.error as Error).message}
        </Card>
      ) : null}

      {!drawCompetitionsQuery.isLoading ? (
        <div className="space-y-3">
          {drawCompetitionsQuery.data?.map((competition) => (
          <Card key={competition.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">{competition.name}</h3>
                {competition.type === "TOURNAMENT" ? (
                  <Badge variant={competition.hasDraw ? "ongoing" : "draft"}>{competition.hasDraw ? "Draw Ready" : "No Draw"}</Badge>
                ) : (
                  <Badge variant="active">League Format</Badge>
                )}
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {competition.seasonLabel ?? "No season"} - {competition.sport} - {competition.participantsCount} participants
              </p>
            </div>
            <Link href={`/draws/${competition.id}`}>
              <Button variant="primary">
                {competition.type === "TOURNAMENT" ? (competition.hasDraw ? "View Draw" : "Open Draw") : "View League Info"}
              </Button>
            </Link>
          </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
