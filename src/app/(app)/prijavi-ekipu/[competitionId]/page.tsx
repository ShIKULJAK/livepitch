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
  const [coaches, setCoaches] = useState<CoachRow[]>([{ fullName: "", phone: "", email: "" }]);
  const [place, setPlace] = useState("");
  const [submittedDate, setSubmittedDate] = useState(toDateInput(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function getTeamPlayersForGeneration(selectedTeamId: string, year: number): PlayerRow[] {
    const fromDb = (playersQuery.data ?? []).filter((player) => {
      if (player.teamId !== selectedTeamId) return false;
      if (!player.dateOfBirth) return false;
      return new Date(player.dateOfBirth).getFullYear() === year;
    });

    if (!fromDb.length) return [{ jerseyNumber: "", fullName: "", birthYear: String(year) }];
    return fromDb.map((player) => ({
      jerseyNumber: player.number != null ? String(player.number) : "",
      fullName: player.fullName,
      birthYear: String(year),
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!competition) return;
    if (generationYears.length === 0) {
      setError("Unesite generacije djece.");
      return;
    }

    try {
      await submit.mutateAsync({
        competitionId: competition.id,
        teamId: teamId || null,
        teamName: teamName.trim(),
        generationYears,
        players: generationYears.flatMap((year) =>
          (playersByGeneration[year] ?? [])
            .filter((row) => row.fullName.trim().length > 0 && row.jerseyNumber.trim().length > 0)
            .map((row) => ({
              generationYear: year,
              birthYear: year,
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
    if (teamId) {
      setPlayersByGeneration((current) => ({ ...current, [year]: getTeamPlayersForGeneration(teamId, year) }));
      return;
    }
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
              <Input
                value={teamName}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setTeamName(value);
                }}
                required
              />
            </FormField>
            <FormField label="Poveži postojeći tim (opcionalno)">
              <Select
                value={teamId}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setTeamId(value);
                  const selected = (teamsQuery.data ?? []).find((team) => team.id === value);
                  if (selected) {
                    setTeamName(selected.name);
                    setPlace(selected.city ?? selected.place ?? "");
                    if (selected.coach?.trim()) {
                      setCoaches([{ fullName: selected.coach.trim(), phone: "", email: "" }]);
                    }
                    if (generationYears.length) {
                      setPlayersByGeneration((current) => {
                        const next = { ...current };
                        for (const year of generationYears) {
                          next[year] = getTeamPlayersForGeneration(selected.id, year);
                        }
                        return next;
                      });
                    }
                  }
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
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                list="players-autocomplete-list"
                                value={row.fullName}
                                onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  const matched = (playersQuery.data ?? []).find(
                                    (player) => player.fullName.toLowerCase() === value.trim().toLowerCase()
                                  );
                                  setPlayersByGeneration((current) => ({
                                    ...current,
                                    [year]: rows.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            fullName: value,
                                            jerseyNumber:
                                              matched?.number != null ? String(matched.number) : item.jerseyNumber,
                                            birthYear: String(year),
                                          }
                                        : item
                                    ),
                                  }));
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <Select
                                value={String(year)}
                                disabled
                              >
                                <option value={String(year)}>{year}</option>
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
          <datalist id="players-autocomplete-list">
            {(playersQuery.data ?? []).map((player) => (
              <option key={player.id} value={player.fullName}>
                {player.team ? `${player.team}` : ""}
              </option>
            ))}
          </datalist>

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
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setCoaches((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, fullName: value } : item)));
                    }}
                    required
                  />
                  <Input
                    placeholder="Tel."
                    value={coach.phone}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setCoaches((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, phone: value } : item)));
                    }}
                  />
                  <Input
                    placeholder="E-mail"
                    type="email"
                    value={coach.email}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setCoaches((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, email: value } : item)));
                    }}
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
              <Input
                value={place}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setPlace(value);
                }}
                required
              />
            </FormField>
            <FormField label="Datum" required>
              <Input
                type="date"
                value={submittedDate}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSubmittedDate(value);
                }}
                required
              />
            </FormField>
          </div>

          {error ? <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p> : null}
          {success ? <p className="text-sm" style={{ color: "var(--success)" }}>{success}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="primary" type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Slanje..." : "Prijavi ekipu"}
            </Button>
            <Button type="button" onClick={() => router.push("/prijavi-ekipu")}>
              Odustani
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
