"use client";

import { useEffect, useMemo, useState } from "react";
import { DominantFoot, PlayerStatus, SportType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCreatePlayer, useTeams } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { COUNTRY_OPTIONS } from "@/lib/constants/countries";
import { SPORT_OPTIONS } from "@/lib/constants/sports";
import { canEditContent } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
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

export default function CreatePlayerPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const teamsQuery = useTeams();
  const createPlayer = useCreatePlayer();
  const canCreate = canEditContent(user?.role);

  const [sport, setSport] = useState<SportType>(SportType.FOOTBALL);
  const [teamId, setTeamId] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [nationalityInput, setNationalityInput] = useState("");
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [status, setStatus] = useState<PlayerStatus>(PlayerStatus.ACTIVE);
  const [dominantFoot, setDominantFoot] = useState<DominantFoot>(DominantFoot.RIGHT);
  const [bio, setBio] = useState("");
  const [radarDefending, setRadarDefending] = useState("60");
  const [radarPhysical, setRadarPhysical] = useState("60");
  const [radarSpeed, setRadarSpeed] = useState("60");
  const [radarPassing, setRadarPassing] = useState("60");
  const [radarGameIQ, setRadarGameIQ] = useState("60");
  const [achievements, setAchievements] = useState("Team Spirit Award\nMost Improved Player\nFair Play Award");
  const [strengths, setStrengths] = useState("Tactical awareness\nPositioning\nWork ethic");
  const [improvements, setImprovements] = useState("Endurance\nCrossing\nShooting");
  const [coachNote, setCoachNote] = useState("Danilo pokazuje stabilan napredak i dobar odnos prema treningu.");
  const [image, setImage] = useState<File | null>(null);
  const imagePreviewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const teams = useMemo(
    () =>
      (teamsQuery.data ?? []).filter(
        (team) => team.sport === sport && team.name.toLowerCase().includes(teamSearch.trim().toLowerCase())
      ),
    [teamsQuery.data, sport, teamSearch]
  );

  function addNationality() {
    if (!nationalityInput.trim()) return;
    if (nationalities.includes(nationalityInput.trim())) return;
    setNationalities((current) => [...current, nationalityInput.trim()]);
    setNationalityInput("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("sport", sport);
    formData.set("teamId", teamId);
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);
    formData.set("position", position);
    formData.set("number", number);
    formData.set("dateOfBirth", `${dateOfBirth}T00:00:00.000Z`);
    formData.set("placeOfBirth", placeOfBirth);
    formData.set("nationalities", nationalities.join("|"));
    formData.set("heightCm", heightCm);
    formData.set("weightKg", weightKg);
    formData.set("status", status);
    formData.set("dominantFoot", dominantFoot);
    formData.set("bio", bio);
    formData.set("radarDefending", radarDefending);
    formData.set("radarPhysical", radarPhysical);
    formData.set("radarSpeed", radarSpeed);
    formData.set("radarPassing", radarPassing);
    formData.set("radarGameIQ", radarGameIQ);
    formData.set("achievements", achievements.split("\n").map((item) => item.trim()).filter(Boolean).join("|"));
    formData.set("strengths", strengths.split("\n").map((item) => item.trim()).filter(Boolean).join("|"));
    formData.set("improvements", improvements.split("\n").map((item) => item.trim()).filter(Boolean).join("|"));
    formData.set("coachNote", coachNote);
    if (image) formData.set("profileImage", image);

    await createPlayer.mutateAsync(formData);
    router.push("/players");
  }

  if (!canCreate) {
    return (
      <Card className="p-6 text-sm" style={{ color: "var(--danger)" }}>
        You do not have permission to create players.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Create Player" description="Add a player with team, profile details, and image." />
      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <FormField label="Sport" tooltip="Sport category used to filter teams and player records." required>
            <Select value={sport} onChange={(event) => setSport(event.currentTarget.value as SportType)}>
              {SPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Search Team" tooltip="Filter teams by name before selecting." helperText="Team list is filtered by selected sport.">
            <Input placeholder="Search teams..." value={teamSearch} onChange={(event) => setTeamSearch(event.currentTarget.value)} />
          </FormField>
          <FormField label="Team" tooltip="Team this player belongs to." required>
            <Select value={teamId} onChange={(event) => setTeamId(event.currentTarget.value)} required>
              <option value="">Select Team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="First Name" tooltip="Player given name." required>
            <Input placeholder="First Name" value={firstName} onChange={(event) => setFirstName(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Last Name" tooltip="Player family name." required>
            <Input placeholder="Last Name" value={lastName} onChange={(event) => setLastName(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Position" tooltip="Primary playing position (e.g. GK, DF, MF, FW)." required>
            <Input placeholder="Position" value={position} onChange={(event) => setPosition(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Jersey Number" tooltip="Match shirt number for this player." required>
            <Input type="number" min={1} max={99} placeholder="Jersey Number" value={number} onChange={(event) => setNumber(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Date of Birth" tooltip="Used for age and eligibility checks." required>
            <Input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Place of Birth" tooltip="City/place where player was born." required>
            <Input placeholder="Place of Birth" value={placeOfBirth} onChange={(event) => setPlaceOfBirth(event.currentTarget.value)} required />
          </FormField>
          <div className="space-y-2 md:col-span-2">
            <div className="flex gap-2">
              <FormField label="Citizenship / Nationality" tooltip="You can add multiple nationalities.">
                <Input list="country-list" placeholder="Nationality" value={nationalityInput} onChange={(event) => setNationalityInput(event.currentTarget.value)} />
              </FormField>
              <Button onClick={addNationality}>Add</Button>
            </div>
            <datalist id="country-list">
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.name}>
                  {option.name}
                </option>
              ))}
            </datalist>
            <div className="flex flex-wrap gap-2">
              {nationalities.map((item) => {
                return (
                  <button
                    key={item}
                    type="button"
                    className="rounded-full border px-3 py-1 text-xs"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => setNationalities((current) => current.filter((value) => value !== item))}
                  >
                    <NationalityBadge nationality={item} /> x
                  </button>
                );
              })}
            </div>
          </div>
          <FormField label="Height (cm)" tooltip="Player height in centimeters." required>
            <Input type="number" min={1} placeholder="Height (cm)" value={heightCm} onChange={(event) => setHeightCm(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Weight (kg)" tooltip="Player weight in kilograms." required>
            <Input type="number" min={1} placeholder="Weight (kg)" value={weightKg} onChange={(event) => setWeightKg(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Status" tooltip="Current player availability status.">
            <Select value={status} onChange={(event) => setStatus(event.currentTarget.value as PlayerStatus)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Dominant Foot" tooltip="Preferred foot used for passing and shooting.">
            <Select value={dominantFoot} onChange={(event) => setDominantFoot(event.currentTarget.value as DominantFoot)}>
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
              value={bio}
              onChange={(event) => setBio(event.currentTarget.value)}
              placeholder="Kratki opis igrača..."
            />
          </FormField>
          <div className="grid gap-3 md:col-span-2 md:grid-cols-5">
            <FormField label="Defending" tooltip="0-100">
              <Input type="number" min={0} max={100} value={radarDefending} onChange={(event) => setRadarDefending(event.currentTarget.value)} />
            </FormField>
            <FormField label="Physical" tooltip="0-100">
              <Input type="number" min={0} max={100} value={radarPhysical} onChange={(event) => setRadarPhysical(event.currentTarget.value)} />
            </FormField>
            <FormField label="Speed" tooltip="0-100">
              <Input type="number" min={0} max={100} value={radarSpeed} onChange={(event) => setRadarSpeed(event.currentTarget.value)} />
            </FormField>
            <FormField label="Passing" tooltip="0-100">
              <Input type="number" min={0} max={100} value={radarPassing} onChange={(event) => setRadarPassing(event.currentTarget.value)} />
            </FormField>
            <FormField label="Game IQ" tooltip="0-100">
              <Input type="number" min={0} max={100} value={radarGameIQ} onChange={(event) => setRadarGameIQ(event.currentTarget.value)} />
            </FormField>
          </div>
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <FormField label="Achievements" tooltip="Jedna stavka po redu.">
              <textarea className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }} rows={4} value={achievements} onChange={(event) => setAchievements(event.currentTarget.value)} />
            </FormField>
            <FormField label="Strengths" tooltip="Jedna stavka po redu.">
              <textarea className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }} rows={4} value={strengths} onChange={(event) => setStrengths(event.currentTarget.value)} />
            </FormField>
            <FormField label="Areas for Improvement" tooltip="Jedna stavka po redu.">
              <textarea className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }} rows={4} value={improvements} onChange={(event) => setImprovements(event.currentTarget.value)} />
            </FormField>
            <FormField label="Coach's Note" tooltip="Napomena trenera.">
              <textarea className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-1)" }} rows={4} value={coachNote} onChange={(event) => setCoachNote(event.currentTarget.value)} />
            </FormField>
          </div>
          <FormField label="Player Profile Image" tooltip="Upload PNG/JPG/WEBP. Image is auto-resized to 150x150 and compressed to <=300KB." className="md:col-span-2">
            <Input
              className="md:col-span-2"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => setImage(event.currentTarget.files?.[0] ?? null)}
            />
          </FormField>
          {imagePreviewUrl ? (
            <div className="md:col-span-2">
              <p className="mb-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                Selected image preview
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreviewUrl}
                alt="Selected player profile preview"
                width={150}
                height={150}
                className="rounded-xl border object-cover"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          ) : null}
          <p className="text-xs md:col-span-2" style={{ color: "var(--text-secondary)" }}>
            Player image is processed server-side to 150x150 and max 300KB.
          </p>
          {createPlayer.isError ? (
            <p className="text-sm md:col-span-2" style={{ color: "var(--danger)" }}>
              {(createPlayer.error as Error).message}
            </p>
          ) : null}
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <Button onClick={() => router.push("/players")}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={createPlayer.isPending}>
              {createPlayer.isPending ? "Creating..." : "Create Player"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
