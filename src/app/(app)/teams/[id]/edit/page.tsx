"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SportType } from "@prisma/client";
import { useTeams, useUpdateTeam } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SPORT_OPTIONS } from "@/lib/constants/sports";
import { canCreateTeams, canEditEntity } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Select } from "@/components/ui/select";

export default function EditTeamPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const teamsQuery = useTeams();
  const updateTeam = useUpdateTeam(params.id);
  const canEditByRole = canCreateTeams(user?.role);

  const team = (teamsQuery.data ?? []).find((item) => item.id === params.id);
  const canEdit = canEditByRole && canEditEntity(user, team);

  const [draft, setDraft] = useState<{
    sport?: SportType;
    name?: string;
    shortName?: string;
    place?: string;
    city?: string;
    country?: string;
    coach?: string;
  }>({});
  const [image, setImage] = useState<File | null>(null);
  const imagePreviewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!team) return;
    const formData = new FormData();
    formData.set("sport", draft.sport ?? team.sport);
    formData.set("name", draft.name ?? team.name);
    formData.set("shortName", draft.shortName ?? team.shortName ?? "");
    formData.set("place", draft.place ?? team.place ?? "");
    formData.set("city", draft.city ?? team.city ?? "");
    formData.set("country", draft.country ?? team.country ?? "");
    formData.set("coach", draft.coach ?? team.coach ?? "");
    if (image) formData.set("profileImage", image);

    await updateTeam.mutateAsync(formData);
    router.push("/teams");
  }

  if (!canEdit) {
    return (
      <Card className="p-6 text-sm" style={{ color: "var(--danger)" }}>
        You can only edit teams that you created.
      </Card>
    );
  }

  if (teamsQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  if (!team) {
    return <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>Team not found.</Card>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Edit ${team.name}`} description="Update team profile and metadata." />
      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <FormField label="Sport" tooltip="Sport category for this team." required>
            <Select value={draft.sport ?? team.sport} onChange={(event) => setDraft((current) => ({ ...current, sport: event.target.value as SportType }))} required>
              {SPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Team Name" tooltip="Official full team name." required>
            <Input value={draft.name ?? team.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required />
          </FormField>
          <FormField label="Short Name" tooltip="Compact short team name." required>
            <Input value={draft.shortName ?? team.shortName ?? ""} onChange={(event) => setDraft((current) => ({ ...current, shortName: event.target.value }))} required />
          </FormField>
          <div className="grid gap-3 md:grid-cols-2 md:col-start-2">
            <FormField label="City" tooltip="Home city of team." required>
              <Input value={draft.city ?? team.city ?? ""} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} required />
            </FormField>
            <FormField label="Mjesto" tooltip="Naselje/selo/manje mjesto odakle je ekipa.">
              <Input value={draft.place ?? team.place ?? ""} onChange={(event) => setDraft((current) => ({ ...current, place: event.target.value }))} />
            </FormField>
          </div>
          <FormField label="Country" tooltip="Home country of team." required>
            <Input value={draft.country ?? team.country ?? ""} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} required />
          </FormField>
          <FormField label="Coach" tooltip="Head coach of the team." required>
            <Input value={draft.coach ?? team.coach ?? ""} onChange={(event) => setDraft((current) => ({ ...current, coach: event.target.value }))} required />
          </FormField>
          <div className="space-y-2 md:col-span-2">
            {team.profileImageUrl ? (
              <div>
                <p className="mb-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Current team image
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={team.profileImageUrl}
                  alt={`${team.name} profile`}
                  width={150}
                  height={150}
                  className="rounded-xl border object-cover"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            ) : null}
            <FormField label="Team Profile Image" tooltip="Upload PNG/JPG/WEBP. Image is auto-resized to 150x150 and compressed to <=300KB.">
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
                  alt="New team profile preview"
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
          {updateTeam.isError ? (
            <p className="text-sm md:col-span-2" style={{ color: "var(--danger)" }}>
              {(updateTeam.error as Error).message}
            </p>
          ) : null}
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <Button type="button" onClick={() => router.push("/teams")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={updateTeam.isPending}>
              {updateTeam.isPending ? "Saving..." : "Save Team"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
