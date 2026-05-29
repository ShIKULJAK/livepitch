"use client";

import { useEffect, useMemo, useState } from "react";
import { DominantFoot, PlayerStatus, SportType } from "@prisma/client";
import { useParams, useRouter } from "next/navigation";
import { usePlayers, useTeams, useUpdatePlayer } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canCreatePlayers, canEditEntity } from "@/lib/permissions";
import { SPORT_OPTIONS } from "@/lib/constants/sports";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { NationalityBadge } from "@/components/ui/nationality-badge";
import { Select } from "@/components/ui/select";

const statusOptions: Array<{ value: PlayerStatus; label: string }> = [
  { value: PlayerStatus.ACTIVE, label: "Aktivan" },
  { value: PlayerStatus.INJURED, label: "Povrijedjen" },
  { value: PlayerStatus.SUSPENDED, label: "Suspendovan" },
  { value: PlayerStatus.INACTIVE, label: "Neaktivan" },
];

const dominantFootOptions: Array<{ value: DominantFoot; label: string }> = [
  { value: DominantFoot.LEFT, label: "Lijeva" },
  { value: DominantFoot.RIGHT, label: "Desna" },
  { value: DominantFoot.BOTH, label: "Obje" },
];

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function EditPlayerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const playersQuery = usePlayers();
  const teamsQuery = useTeams();
  const updatePlayer = useUpdatePlayer(params.id);
  const canEditByRole = canCreatePlayers(user?.role);
  const player = (playersQuery.data ?? []).find((item) => item.id === params.id);
  const canEdit = canEditByRole && canEditEntity(user, player);

  const [draft, setDraft] = useState<{
    sport?: SportType;
    teamId?: string;
    firstName?: string;
    lastName?: string;
    position?: string;
    number?: string;
    dateOfBirth?: string;
    placeOfBirth?: string;
    nationalities?: string[];
    heightCm?: string;
    weightKg?: string;
    status?: PlayerStatus;
    dominantFoot?: DominantFoot;
    clubHistory?: Array<{ id?: string; teamId: string; teamName: string; fromYear: string; toYear: string }>;
    bio?: string;
    radarDefending?: string;
    radarPhysical?: string;
    radarSpeed?: string;
    radarPassing?: string;
    radarGameIQ?: string;
    achievements?: string;
    strengths?: string;
    improvements?: string;
    coachNote?: string;
  }>({});
  const [nationalityInput, setNationalityInput] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const imagePreviewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const sourceNationalities = useMemo(() => {
    if (!player) return [];
    return player.nationalities.length ? player.nationalities : player.nationality ? [player.nationality] : [];
  }, [player]);
  const nationalities = draft.nationalities ?? sourceNationalities;
  const clubHistoryDraft =
    draft.clubHistory ??
    (player?.clubHistory ?? []).map((item) => ({
      id: item.id,
      teamId: item.teamId,
      teamName: item.teamName,
      fromYear: String(item.fromYear),
      toYear: item.toYear ? String(item.toYear) : "",
    }));

  const selectedSport = draft.sport ?? player?.sport ?? SportType.FOOTBALL;
  const availableTeams = useMemo(
    () => (teamsQuery.data ?? []).filter((team) => team.sport === selectedSport),
    [teamsQuery.data, selectedSport]
  );

  function addNationality() {
    const value = nationalityInput.trim();
    if (!value || nationalities.includes(value)) return;
    setDraft((current) => ({ ...current, nationalities: [...nationalities, value] }));
    setNationalityInput("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!player) return;
    const formData = new FormData();
    formData.set("sport", draft.sport ?? player.sport);
    formData.set("teamId", draft.teamId ?? player.teamId);
    formData.set("firstName", draft.firstName ?? player.firstName ?? "");
    formData.set("lastName", draft.lastName ?? player.lastName ?? "");
    formData.set("position", draft.position ?? player.position);
    formData.set("number", draft.number ?? (player.number ? String(player.number) : ""));
    formData.set("dateOfBirth", `${draft.dateOfBirth ?? toDateInput(player.dateOfBirth)}T00:00:00.000Z`);
    formData.set("placeOfBirth", draft.placeOfBirth ?? player.placeOfBirth ?? "");
    formData.set("nationalities", nationalities.join("|"));
    formData.set("heightCm", draft.heightCm ?? (player.heightCm ? String(player.heightCm) : ""));
    formData.set("weightKg", draft.weightKg ?? (player.weightKg ? String(player.weightKg) : ""));
    formData.set("status", draft.status ?? player.status);
    formData.set("dominantFoot", draft.dominantFoot ?? player.dominantFoot);
    formData.set("bio", draft.bio ?? player.bio ?? "");
    formData.set("radarDefending", draft.radarDefending ?? String(player.radarDefending ?? 60));
    formData.set("radarPhysical", draft.radarPhysical ?? String(player.radarPhysical ?? 60));
    formData.set("radarSpeed", draft.radarSpeed ?? String(player.radarSpeed ?? 60));
    formData.set("radarPassing", draft.radarPassing ?? String(player.radarPassing ?? 60));
    formData.set("radarGameIQ", draft.radarGameIQ ?? String(player.radarGameIQ ?? 60));
    formData.set(
      "achievements",
      (draft.achievements ?? (player.achievements ?? ["Team Spirit Award", "Most Improved Player", "Fair Play Award"]).join("\n"))
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .join("|")
    );
    formData.set(
      "strengths",
      (draft.strengths ?? (player.strengths ?? ["Tactical awareness", "Positioning", "Work ethic"]).join("\n"))
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .join("|")
    );
    formData.set(
      "improvements",
      (draft.improvements ?? (player.improvements ?? ["Endurance", "Crossing", "Shooting"]).join("\n"))
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .join("|")
    );
    formData.set("coachNote", draft.coachNote ?? player.coachNote ?? "Danilo pokazuje stabilan napredak i dobar odnos prema treningu.");
    formData.set(
      "clubHistory",
      JSON.stringify(
        clubHistoryDraft.map((entry) => ({
          id: entry.id,
          teamId: entry.teamId,
          fromYear: Number(entry.fromYear) || new Date().getFullYear(),
          toYear: entry.toYear.trim() ? Number(entry.toYear) : null,
        }))
      )
    );
    if (image) formData.set("profileImage", image);

    await updatePlayer.mutateAsync(formData);
    router.push("/players");
  }

  if (!canEdit) {
    return (
      <Card className="p-6 text-sm" style={{ color: "var(--danger)" }}>
        You can only edit players that you created.
      </Card>
    );
  }

  if (playersQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  if (!player) {
    return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Player not found.</Card>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Edit ${player.fullName}`} description="Update player profile and squad details." />
      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <FormField label="Sport" tooltip="Sport category." required>
            <Select
              value={selectedSport}
              onChange={(event) => {
                const value = event.target.value as SportType;
                setDraft((current) => ({ ...current, sport: value }));
              }}
            >
              {SPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Team" tooltip="Current team assignment." required>
            <Select
              value={draft.teamId ?? player.teamId}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, teamId: value }));
              }}
              required
            >
              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="First Name" tooltip="Player first name." required>
            <Input
              value={draft.firstName ?? player.firstName ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, firstName: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Last Name" tooltip="Player last name." required>
            <Input
              value={draft.lastName ?? player.lastName ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, lastName: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Position" tooltip="Primary playing position." required>
            <Input
              value={draft.position ?? player.position}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, position: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Jersey Number" tooltip="Official match jersey number." required>
            <Input
              type="number"
              min={1}
              max={99}
              value={draft.number ?? (player.number ? String(player.number) : "")}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, number: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Date of Birth" tooltip="Date of birth for age and eligibility." required>
            <Input
              type="date"
              value={draft.dateOfBirth ?? toDateInput(player.dateOfBirth)}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, dateOfBirth: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Place of Birth" tooltip="City/place of birth." required>
            <Input
              value={draft.placeOfBirth ?? player.placeOfBirth ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, placeOfBirth: value }));
              }}
              required
            />
          </FormField>
          <div className="space-y-2 md:col-span-2">
            <FormField label="Citizenship / Nationality" tooltip="Multiple nationalities can be saved.">
              <Input
                value={nationalityInput}
                onChange={(event) => {
                  setNationalityInput(event.target.value);
                }}
              />
            </FormField>
            <div className="flex gap-2">
              <Button type="button" onClick={addNationality}>
                Add
              </Button>
              <div className="flex flex-wrap gap-2">
                {nationalities.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="rounded-full border px-3 py-1 text-xs"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => setDraft((current) => ({ ...current, nationalities: nationalities.filter((value) => value !== item) }))}
                  >
                    <NationalityBadge nationality={item} /> x
                  </button>
                ))}
              </div>
            </div>
          </div>
          <FormField label="Height (cm)" tooltip="Player height." required>
            <Input
              type="number"
              min={1}
              value={draft.heightCm ?? (player.heightCm ? String(player.heightCm) : "")}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, heightCm: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Weight (kg)" tooltip="Player weight." required>
            <Input
              type="number"
              min={1}
              value={draft.weightKg ?? (player.weightKg ? String(player.weightKg) : "")}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({ ...current, weightKg: value }));
              }}
              required
            />
          </FormField>
          <FormField label="Status" tooltip="Current availability status.">
            <Select
              value={draft.status ?? player.status}
              onChange={(event) => {
                const value = event.target.value as PlayerStatus;
                setDraft((current) => ({ ...current, status: value }));
              }}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Dominant Foot" tooltip="Preferred playing foot.">
            <Select
              value={draft.dominantFoot ?? player.dominantFoot}
              onChange={(event) => {
                const value = event.target.value as DominantFoot;
                setDraft((current) => ({ ...current, dominantFoot: value }));
              }}
            >
              {dominantFootOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Player Bio" tooltip="Short player description/bio." className="md:col-span-2">
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
              rows={3}
              maxLength={1200}
              value={draft.bio ?? player.bio ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((current) => ({ ...current, bio: value }));
              }}
              placeholder="Kratki opis igrača..."
            />
          </FormField>
          <div className="grid gap-3 md:col-span-2 md:grid-cols-5">
            <FormField label="Defending" tooltip="0-100">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.radarDefending ?? String(player.radarDefending ?? 60)}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, radarDefending: value }));
                }}
              />
            </FormField>
            <FormField label="Physical" tooltip="0-100">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.radarPhysical ?? String(player.radarPhysical ?? 60)}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, radarPhysical: value }));
                }}
              />
            </FormField>
            <FormField label="Speed" tooltip="0-100">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.radarSpeed ?? String(player.radarSpeed ?? 60)}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, radarSpeed: value }));
                }}
              />
            </FormField>
            <FormField label="Passing" tooltip="0-100">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.radarPassing ?? String(player.radarPassing ?? 60)}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, radarPassing: value }));
                }}
              />
            </FormField>
            <FormField label="Game IQ" tooltip="0-100">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.radarGameIQ ?? String(player.radarGameIQ ?? 60)}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, radarGameIQ: value }));
                }}
              />
            </FormField>
          </div>
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <FormField label="Achievements" tooltip="Jedna stavka po redu.">
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
                rows={4}
                value={draft.achievements ?? (player.achievements ?? ["Team Spirit Award", "Most Improved Player", "Fair Play Award"]).join("\n")}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, achievements: value }));
                }}
              />
            </FormField>
            <FormField label="Strengths" tooltip="Jedna stavka po redu.">
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
                rows={4}
                value={draft.strengths ?? (player.strengths ?? ["Tactical awareness", "Positioning", "Work ethic"]).join("\n")}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, strengths: value }));
                }}
              />
            </FormField>
            <FormField label="Areas for Improvement" tooltip="Jedna stavka po redu.">
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
                rows={4}
                value={draft.improvements ?? (player.improvements ?? ["Endurance", "Crossing", "Shooting"]).join("\n")}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, improvements: value }));
                }}
              />
            </FormField>
            <FormField label="Coach's Note" tooltip="Napomena trenera.">
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }}
                rows={4}
                value={draft.coachNote ?? player.coachNote ?? "Danilo pokazuje stabilan napredak i dobar odnos prema treningu."}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, coachNote: value }));
                }}
              />
            </FormField>
          </div>
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              Istorija klubova
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  const currentYear = new Date().getFullYear();
                  const fallbackTeamId = draft.teamId ?? player.teamId;
                  const fallbackTeamName =
                    availableTeams.find((team) => team.id === fallbackTeamId)?.name ?? player.team ?? "Tim";
                  setDraft((current) => ({
                    ...current,
                    clubHistory: [
                      ...clubHistoryDraft,
                      {
                        id: undefined,
                        teamId: fallbackTeamId,
                        teamName: fallbackTeamName,
                        fromYear: String(currentYear),
                        toYear: "",
                      },
                    ],
                  }));
                }}
              >
                Dodaj klub
              </Button>
            </div>
            <div className="space-y-2">
              {clubHistoryDraft.map((entry, index) => (
                <div key={`${entry.id ?? "new"}-${index}`} className="grid gap-2 rounded-lg border p-2 md:grid-cols-[1fr_120px_120px_40px]" style={{ borderColor: "var(--border)" }}>
                  <Select
                    value={entry.teamId}
                    onChange={(event) => {
                      const nextTeamId = event.currentTarget.value;
                      const nextTeamName = availableTeams.find((team) => team.id === nextTeamId)?.name ?? entry.teamName;
                      setDraft((current) => ({
                        ...current,
                        clubHistory: clubHistoryDraft.map((item, i) =>
                          i === index ? { ...item, teamId: nextTeamId, teamName: nextTeamName } : item
                        ),
                      }));
                    }}
                  >
                    {availableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1900}
                    max={3000}
                    value={entry.fromYear}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setDraft((current) => ({
                        ...current,
                        clubHistory: clubHistoryDraft.map((item, i) => (i === index ? { ...item, fromYear: value } : item)),
                      }));
                    }}
                  />
                  <Input
                    type="number"
                    min={1900}
                    max={3000}
                    placeholder="danas"
                    value={entry.toYear}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setDraft((current) => ({
                        ...current,
                        clubHistory: clubHistoryDraft.map((item, i) => (i === index ? { ...item, toYear: value } : item)),
                      }));
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        clubHistory: clubHistoryDraft.filter((_, i) => i !== index),
                      }));
                    }}
                  >
                    -
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            {player.profileImageUrl ? (
              <div>
                <p className="mb-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Current profile image
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={player.profileImageUrl}
                  alt={`${player.fullName} profile`}
                  width={150}
                  height={150}
                  className="rounded-xl border object-cover"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            ) : null}
            <FormField label="Player Profile Image" tooltip="Upload PNG/JPG/WEBP. Image is auto-resized to 150x150 and compressed to <=300KB.">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(event) => setImage(event.currentTarget.files?.[0] ?? null)}
              />
            </FormField>
            {imagePreviewUrl ? (
              <div>
                <p className="mb-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  New image preview
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="New player profile preview"
                  width={150}
                  height={150}
                  className="rounded-xl border object-cover"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            ) : null}
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Leave empty to keep existing image.
            </p>
          </div>
          {updatePlayer.isError ? (
            <p className="text-sm md:col-span-2" style={{ color: "var(--danger)" }}>
              {(updatePlayer.error as Error).message}
            </p>
          ) : null}
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <Button type="button" onClick={() => router.push("/players")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={updatePlayer.isPending}>
              {updatePlayer.isPending ? "Saving..." : "Save Player"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
