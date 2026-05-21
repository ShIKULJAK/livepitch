"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCompetitions, usePlayers, useSubmitTeamApplication, useTeams } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type PlayerRow = { jerseyNumber: string; fullName: string; birthYear: string };
type CoachRow = { fullName: string; phone: string; email: string };

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function TeamApplicationFormPage() {
  const params = useParams<{ competitionId: string }>();
  const router = useRouter();
  const competitionsQuery = useCompetitions({});
  const teamsQuery = useTeams();
  const playersQuery = usePlayers();
  const submit = useSubmitTeamApplication();

  const competition = (competitionsQuery.data ?? []).find((item) => item.id === params.competitionId);
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 14 }, (_, index) => currentYear - 5 - index),
    [currentYear]
  );

  const [teamId, setTeamId] = useState<string>("");
  const [teamName, setTeamName] = useState("");
  const [generationYears, setGenerationYears] = useState<number[]>([]);
  const [playersByGeneration, setPlayersByGeneration] = useState<Record<number, PlayerRow[]>>({});
  const [activeSuggestionKey, setActiveSuggestionKey] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<CoachRow[]>([{ fullName: "", phone: "", email: "" }]);
  const [place, setPlace] = useState("");
  const [submittedDate, setSubmittedDate] = useState(toDateInput(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!competition) return;

    try {
      await submit.mutateAsync({
        competitionId: competition.id,
        teamId: teamId || null,
        teamName: teamName.trim(),
        generationYears,
        players: generationYears.flatMap((year) =>
          (playersByGeneration[year] ?? []).map((row) => ({
            generationYear: year,
            birthYear: Number(row.birthYear),
            jerseyNumber: Number(row.jerseyNumber),
            fullName: row.fullName.trim(),
          }))
        ),
        coaches: coaches.map((row) => ({ fullName: row.fullName.trim(), phone: row.phone.trim(), email: row.email.trim() })),
        place: place.trim(),
        submittedDate,
      });
      setSuccess("Prijava je uspješno poslana.");
      setTimeout(() => router.push("/prijavi-ekipu"), 900);
    } catch (submitError) {
      setError((submitError as Error).message);
    }
  }

  function ensureGenerationPlayers(year: number) {
    if (playersByGeneration[year]?.length) return;
    setPlayersByGeneration((current) => ({ ...current, [year]: [{ jerseyNumber: "", fullName: "", birthYear: String(year) }] }));
  }

  function removeGenerationPlayers(year: number) {
    setPlayersByGeneration((current) => {
      const next = { ...current };
      delete next[year];
      return next;
    });
  }

  if (competitionsQuery.isLoading || competitionsQuery.isFetching) {
    return (
      <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
        Učitavanje takmičenja...
      </Card>
    );
  }

  if (competitionsQuery.isError) {
    return (
      <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
        {(competitionsQuery.error as Error).message}
      </Card>
    );
  }

  if (!competition) {
    return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Takmičenje nije pronađeno.</Card>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Prijava: ${competition.name}`} description={`Sezona: ${competition.seasonLabel ?? "N/A"}`} />
      <Card className="p-6">
        <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Ekipa" required>
              <Input value={teamName} onChange={(event) => setTeamName(event.currentTarget.value)} required />
            </FormField>
            <FormField label="Poveži postojeći tim (opcionalno)">
              <Select
                value={teamId}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setTeamId(value);
                  const selected = (teamsQuery.data ?? []).find((team) => team.id === value);
                  if (selected && !teamName) setTeamName(selected.name);
                }}
              >
                <option value="">Ručno unesena ekipa</option>
                {(teamsQuery.data ?? []).map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Godište" required>
            <div className="grid gap-2 md:grid-cols-4">
              {years.map((year) => {
                const active = generationYears.includes(year);
                return (
                  <button
                    key={year}
                    type="button"
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={
                      active
                        ? { borderColor: "var(--primary)", color: "var(--primary)" }
                        : { borderColor: "var(--border)", color: "var(--text-secondary)" }
                    }
                    onClick={() =>
                      setGenerationYears((current) => {
                        if (current.includes(year)) {
                          removeGenerationPlayers(year);
                          return current.filter((item) => item !== year);
                        }
                        ensureGenerationPlayers(year);
                        return [...current, year].sort((a, b) => b - a);
                      })
                    }
                  >
                    Generacija {year}
                  </button>
                );
              })}
            </div>
          </FormField>

          <div className="space-y-3">
            {generationYears.map((year) => {
              const rows = playersByGeneration[year] ?? [{ jerseyNumber: "", fullName: "", birthYear: String(year) }];
              return (
                <div key={`players-${year}`} className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">Igrači - Generacija {year}</h3>
                    <Button
                      type="button"
                      onClick={() =>
                        setPlayersByGeneration((current) => ({
                          ...current,
                          [year]: [...rows, { jerseyNumber: "", fullName: "", birthYear: String(year) }],
                        }))
                      }
                    >
                      Dodaj igrača
                    </Button>
                  </div>
                  <div className="overflow-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                    <table className="w-full min-w-[460px] text-sm">
                      <thead style={{ backgroundColor: "var(--surface-2)" }}>
                        <tr>
                          <th className="p-2 text-left">Igrač</th>
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left">Ime i Prezime</th>
                          <th className="p-2 text-left">Godište</th>
                          <th className="p-2 text-right">Akcija</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={`player-${year}-${index}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2">
                              <Input
                                value={row.jerseyNumber}
                                type="number"
                                min={0}
                                max={99}
                                onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  return (
                                  setPlayersByGeneration((current) => ({
                                    ...current,
                                    [year]: rows.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, jerseyNumber: value } : item
                                    ),
                                  }))
                                  );
                                }}
                                required
                              />
                            </td>
                            <td className="p-2">
                              <div className="relative">
                                <Input
                                  value={row.fullName}
                                  onFocus={() => setActiveSuggestionKey(`${year}-${index}`)}
                                  onBlur={() => setTimeout(() => setActiveSuggestionKey(null), 120)}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value;
                                    return (
                                    setPlayersByGeneration((current) => ({
                                      ...current,
                                      [year]: rows.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, fullName: value } : item
                                      ),
                                    }))
                                    );
                                  }}
                                  required
                                />
                                {activeSuggestionKey === `${year}-${index}` && row.fullName.trim().length >= 2 ? (
                                  <div
                                    className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border"
                                    style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                                  >
                                    {(playersQuery.data ?? [])
                                      .filter((player) => player.fullName.toLowerCase().includes(row.fullName.toLowerCase()))
                                      .slice(0, 8)
                                      .map((player) => {
                                        const birthYear = player.dateOfBirth ? new Date(player.dateOfBirth).getFullYear() : year;
                                        return (
                                          <button
                                            key={player.id}
                                            type="button"
                                            className="block w-full px-2 py-1.5 text-left text-xs hover:opacity-80"
                                            onMouseDown={(event) => {
                                              event.preventDefault();
                                              setPlayersByGeneration((current) => ({
                                                ...current,
                                                [year]: rows.map((item, itemIndex) =>
                                                  itemIndex === index
                                                    ? {
                                                        ...item,
                                                        fullName: player.fullName,
                                                        jerseyNumber: player.number != null ? String(player.number) : item.jerseyNumber,
                                                        birthYear: String(birthYear),
                                                      }
                                                    : item
                                                ),
                                              }));
                                              setActiveSuggestionKey(null);
                                            }}
                                          >
                                            {player.fullName} {player.team ? `• ${player.team}` : ""} {player.number != null ? `• #${player.number}` : ""}
                                          </button>
                                        );
                                      })}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="p-2">
                              <Select
                                value={row.birthYear}
                                onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  return (
                                  setPlayersByGeneration((current) => ({
                                    ...current,
                                    [year]: rows.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, birthYear: value } : item
                                    ),
                                  }))
                                  );
                                }}
                                required
                              >
                                {years.map((optionYear) => (
                                  <option key={`birth-${year}-${optionYear}`} value={String(optionYear)}>
                                    {optionYear}
                                  </option>
                                ))}
                              </Select>
                            </td>
                            <td className="p-2 text-right">
                              <Button
                                type="button"
                                onClick={() =>
                                  setPlayersByGeneration((current) => ({
                                    ...current,
                                    [year]: rows.length > 1 ? rows.filter((_, itemIndex) => itemIndex !== index) : rows,
                                  }))
                                }
                              >
                                -
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{coaches.length > 1 ? "Treneri" : "Trener"}</h3>
              <Button type="button" onClick={() => setCoaches((current) => [...current, { fullName: "", phone: "", email: "" }])}>
                Dodaj trenera
              </Button>
            </div>
            <div className="space-y-3">
              {coaches.map((coach, index) => (
                <div key={`coach-${index}`} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_180px_1fr_auto]" style={{ borderColor: "var(--border)" }}>
                  <Input
                    placeholder="Ime i Prezime"
                    value={coach.fullName}
                    onChange={(event) =>
                      setCoaches((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, fullName: event.currentTarget.value } : item)))
                    }
                    required
                  />
                  <Input
                    placeholder="Tel."
                    value={coach.phone}
                    onChange={(event) =>
                      setCoaches((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, phone: event.currentTarget.value } : item)))
                    }
                    required
                  />
                  <Input
                    placeholder="E-mail"
                    type="email"
                    value={coach.email}
                    onChange={(event) =>
                      setCoaches((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, email: event.currentTarget.value } : item)))
                    }
                  />
                  <Button type="button" onClick={() => setCoaches((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current))}>
                    -
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Mjesto" required>
              <Input value={place} onChange={(event) => setPlace(event.currentTarget.value)} required />
            </FormField>
            <FormField label="Datum" required>
              <Input type="date" value={submittedDate} onChange={(event) => setSubmittedDate(event.currentTarget.value)} required />
            </FormField>
          </div>

          {error ? <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p> : null}
          {success ? <p className="text-sm" style={{ color: "var(--success)" }}>{success}</p> : null}

          <div className="flex justify-end">
            <Button variant="primary" type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Slanje..." : "Prijavi ekipu"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
