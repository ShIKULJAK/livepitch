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
    return <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>Loading player...</Card>;
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
                    {item} x
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
