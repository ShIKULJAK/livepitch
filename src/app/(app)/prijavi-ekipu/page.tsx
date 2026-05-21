"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CompetitionType } from "@prisma/client";
import { useApplicableCompetitions } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function TeamApplicationsEntryPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CompetitionType | "ALL">("ALL");
  const competitionsQuery = useApplicableCompetitions({ q: query || undefined, type });

  const isLoadingCompetitions = competitionsQuery.isLoading || competitionsQuery.isFetching;
  const empty = useMemo(
    () => !isLoadingCompetitions && (competitionsQuery.data?.length ?? 0) === 0,
    [isLoadingCompetitions, competitionsQuery.data]
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Prijavi ekipu" description="Odaberite takmičenje i pošaljite prijavu ekipe po generacijama." />
      <FilterBar>
        <Input
          placeholder="Pronađi turnir"
          className="max-w-sm"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Select className="w-56" value={type} onChange={(event) => setType(event.currentTarget.value as CompetitionType | "ALL")}>
          <option value="ALL">Sve</option>
          <option value={CompetitionType.TOURNAMENT}>Turnir</option>
          <option value={CompetitionType.LEAGUE}>Liga</option>
          <option value={CompetitionType.FRIENDLY_MATCH}>Prijateljske</option>
        </Select>
      </FilterBar>

      <div className="space-y-3">
        {competitionsQuery.data?.map((competition) => (
          <Link key={competition.id} href={`/prijavi-ekipu/${competition.id}`}>
            <Card className="cursor-pointer p-4 transition hover:opacity-90">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{competition.name}</h3>
                <span className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border)" }}>
                  {competition.type}
                </span>
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Sezona: {competition.seasonLabel ?? "N/A"} • Sport: {competition.sport}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {isLoadingCompetitions ? (
        <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Učitavanje...
        </Card>
      ) : null}
      {empty ? (
        <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Nema rezultata za zadani filter.
        </Card>
      ) : null}
    </div>
  );
}
