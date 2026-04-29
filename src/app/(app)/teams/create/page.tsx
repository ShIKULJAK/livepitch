"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SportType } from "@prisma/client";
import { useCreateTeam } from "@/hooks/use-competitions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { countryFlag, COUNTRY_OPTIONS } from "@/lib/constants/countries";
import { SPORT_OPTIONS } from "@/lib/constants/sports";
import { canManageTeams } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function CreateTeamPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const createTeam = useCreateTeam();
  const canCreate = canManageTeams(user?.role);

  const [sport, setSport] = useState<SportType>(SportType.FOOTBALL);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [coach, setCoach] = useState("");
  const [image, setImage] = useState<File | null>(null);

  const countryByName = useMemo(() => new Map(COUNTRY_OPTIONS.map((option) => [option.name.toLowerCase(), option])), []);
  const selectedCountry = countryByName.get(country.trim().toLowerCase());

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("sport", sport);
    formData.set("name", name);
    formData.set("shortName", shortName);
    formData.set("city", city);
    formData.set("country", country);
    formData.set("coach", coach);
    if (image) formData.set("profileImage", image);

    await createTeam.mutateAsync(formData);
    router.push("/teams");
  }

  if (!canCreate) {
    return (
      <Card className="p-6 text-sm" style={{ color: "var(--danger)" }}>
        You do not have permission to create teams.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Create Team" description="Add a new team with sport, location, and profile image." />
      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <FormField label="Sport" tooltip="Sport category for this team." required>
            <Select value={sport} onChange={(event) => setSport(event.currentTarget.value as SportType)}>
              {SPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Team Name" tooltip="Official full team name used in fixtures and standings." required>
            <Input placeholder="Team Name" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
          </FormField>
          <FormField label="Short Name" tooltip="Compact team name used where space is limited.">
            <Input placeholder="Short Name" value={shortName} onChange={(event) => setShortName(event.currentTarget.value)} />
          </FormField>
          <FormField label="City" tooltip="Home city of the team.">
            <Input placeholder="City" value={city} onChange={(event) => setCity(event.currentTarget.value)} />
          </FormField>
          <div className="space-y-1">
            <FormField label="Country" tooltip="Country the club represents. Search and select from list.">
              <Input list="country-list" placeholder="Country" value={country} onChange={(event) => setCountry(event.currentTarget.value)} />
            </FormField>
            <datalist id="country-list">
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.name}>
                  {option.name}
                </option>
              ))}
            </datalist>
            {selectedCountry ? (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {countryFlag(selectedCountry.code)} {selectedCountry.name}
              </p>
            ) : null}
          </div>
          <FormField label="Coach" tooltip="Head coach or manager of this team.">
            <Input placeholder="Coach" value={coach} onChange={(event) => setCoach(event.currentTarget.value)} />
          </FormField>
          <FormField label="Team Profile Image" tooltip="Upload PNG/JPG/WEBP. Image is auto-resized to 150x150 and compressed to <=300KB.">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => setImage(event.currentTarget.files?.[0] ?? null)}
            />
          </FormField>
          <p className="text-xs md:col-span-2" style={{ color: "var(--text-secondary)" }}>
            Team image is processed server-side to 150x150 and max 300KB.
          </p>
          {createTeam.isError ? (
            <p className="text-sm md:col-span-2" style={{ color: "var(--danger)" }}>
              {(createTeam.error as Error).message}
            </p>
          ) : null}
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <Button onClick={() => router.push("/teams")}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={createTeam.isPending}>
              {createTeam.isPending ? "Creating..." : "Create Team"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
