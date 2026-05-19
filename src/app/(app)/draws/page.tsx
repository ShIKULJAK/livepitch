"use client";

import Link from "next/link";
import { useDrawCompetitions } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DrawsPage() {
  const drawCompetitionsQuery = useDrawCompetitions();

  return (
    <div className="space-y-4">
      <PageHeader title="Izvlacenje" description="Manage group draws and knockout bracket generation for competitions." />

      {drawCompetitionsQuery.isLoading ? (
        <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading competitions...
        </Card>
      ) : null}

      {drawCompetitionsQuery.isError ? (
        <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
          {(drawCompetitionsQuery.error as Error).message}
        </Card>
      ) : null}

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
    </div>
  );
}
