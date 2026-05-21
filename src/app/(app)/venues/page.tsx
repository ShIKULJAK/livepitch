"use client";

import { useMemo, useState } from "react";
import { GENERATION_PRESETS, getGenerationPreset } from "@/lib/constants/generation-presets";
import { useCreatePitch, useCreateVenue, useDeletePitch, useDeleteVenue, useUpdatePitch, useUpdateVenue, useVenues } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type PitchDraft = {
  id?: string;
  venueId: string;
  name: string;
  generationLabel: string;
  ageGroupCode: string;
  playerFormat: string;
  fieldLengthMeters: string;
  fieldWidthMeters: string;
  goalWidthMeters: string;
  goalHeightMeters: string;
};

function toDraft(input?: Partial<PitchDraft>): PitchDraft {
  return {
    id: input?.id,
    venueId: input?.venueId ?? "",
    name: input?.name ?? "",
    generationLabel: input?.generationLabel ?? "",
    ageGroupCode: input?.ageGroupCode ?? "",
    playerFormat: input?.playerFormat ?? "",
    fieldLengthMeters: input?.fieldLengthMeters ?? "",
    fieldWidthMeters: input?.fieldWidthMeters ?? "",
    goalWidthMeters: input?.goalWidthMeters ?? "",
    goalHeightMeters: input?.goalHeightMeters ?? "",
  };
}

export default function VenuesPage() {
  const venuesQuery = useVenues();
  const createPitch = useCreatePitch();
  const createVenue = useCreateVenue();
  const updateVenue = useUpdateVenue();
  const deleteVenue = useDeleteVenue();
  const updatePitch = useUpdatePitch();
  const deletePitch = useDeletePitch();

  const [draft, setDraft] = useState<PitchDraft>(toDraft());
  const [venueDraft, setVenueDraft] = useState({ id: "", name: "", city: "", country: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const venues = venuesQuery.data ?? [];
  const allPitches = useMemo(
    () =>
      venues.flatMap((venue) =>
        venue.pitches.map((pitch) => ({
          ...pitch,
          venueName: venue.name,
        }))
      ),
    [venues]
  );

  function applyPreset(generationLabel: string) {
    const preset = getGenerationPreset(generationLabel);
    if (!preset) return;
    setDraft((current) => ({
      ...current,
      generationLabel: preset.generationLabel,
      ageGroupCode: preset.ageGroupCode,
      playerFormat: preset.playerFormat,
      fieldLengthMeters: String(preset.fieldLengthMeters),
      fieldWidthMeters: String(preset.fieldWidthMeters),
    }));
  }

  function resetForm() {
    setEditingId(null);
    setDraft(toDraft({ venueId: venues[0]?.id ?? "" }));
  }

  async function savePitch() {
    if (!draft.venueId || !draft.name || !draft.playerFormat || !draft.fieldLengthMeters || !draft.fieldWidthMeters) return;
    const payload = {
      venueId: draft.venueId,
      name: draft.name,
      generationLabel: draft.generationLabel || null,
      ageGroupCode: draft.ageGroupCode || null,
      playerFormat: draft.playerFormat,
      fieldLengthMeters: Number(draft.fieldLengthMeters),
      fieldWidthMeters: Number(draft.fieldWidthMeters),
      goalWidthMeters: draft.goalWidthMeters ? Number(draft.goalWidthMeters) : null,
      goalHeightMeters: draft.goalHeightMeters ? Number(draft.goalHeightMeters) : null,
      isActive: true,
    };

    if (editingId) {
      await updatePitch.mutateAsync({ id: editingId, ...payload });
    } else {
      await createPitch.mutateAsync(payload);
    }
    resetForm();
  }

  async function saveVenue() {
    if (!venueDraft.name.trim()) return;
    if (venueDraft.id) {
      await updateVenue.mutateAsync({
        id: venueDraft.id,
        name: venueDraft.name.trim(),
        city: venueDraft.city.trim() || null,
        country: venueDraft.country.trim() || null,
      });
    } else {
      await createVenue.mutateAsync({
        name: venueDraft.name.trim(),
        city: venueDraft.city.trim() || null,
        country: venueDraft.country.trim() || null,
      });
    }
    setVenueDraft({ id: "", name: "", city: "", country: "" });
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Lokacije i tereni" description="Kreiranje i upravljanje terenima sa dimenzijama, golovima i generacijama." />

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden p-4">
          <h3 className="mb-3 text-lg font-semibold">Stadioni i tereni</h3>
          <div className="mb-3 space-y-2">
            {venues.map((venue) => (
              <div key={venue.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <p className="font-medium">{venue.name}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{venue.city}, {venue.country}</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" onClick={() => setVenueDraft({ id: venue.id, name: venue.name, city: venue.city ?? "", country: venue.country ?? "" })}>
                    Edit stadion
                  </Button>
                  <Button type="button" variant="danger" onClick={() => deleteVenue.mutate(venue.id)}>
                    Delete stadion
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {allPitches.map((pitch) => (
              <div key={pitch.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                <p className="font-medium">{pitch.venueName} - {pitch.name}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {pitch.fieldLengthMeters} x {pitch.fieldWidthMeters} m · {pitch.playerFormat}
                  {pitch.generationLabel ? ` · ${pitch.generationLabel}` : ""}
                </p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Gol: {pitch.goalWidthMeters ?? "-"} x {pitch.goalHeightMeters ?? "-"} m
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingId(pitch.id);
                      setDraft(
                        toDraft({
                          id: pitch.id,
                          venueId: pitch.venueId ?? "",
                          name: pitch.name,
                          generationLabel: pitch.generationLabel ?? "",
                          ageGroupCode: pitch.ageGroupCode ?? "",
                          playerFormat: pitch.playerFormat,
                          fieldLengthMeters: String(pitch.fieldLengthMeters),
                          fieldWidthMeters: String(pitch.fieldWidthMeters),
                          goalWidthMeters: pitch.goalWidthMeters ? String(pitch.goalWidthMeters) : "",
                          goalHeightMeters: pitch.goalHeightMeters ? String(pitch.goalHeightMeters) : "",
                        })
                      );
                    }}
                  >
                    Edit
                  </Button>
                  <Button type="button" variant="danger" onClick={() => deletePitch.mutate(pitch.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {!allPitches.length ? <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Nema unesenih terena.</p> : null}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-lg font-semibold">{venueDraft.id ? "Uredi stadion" : "Novi stadion"}</h3>
          <div className="mb-4 space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
            <FormField label="Naziv stadiona">
              <Input value={venueDraft.name} onChange={(event) => setVenueDraft((current) => ({ ...current, name: event.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Grad">
                <Input value={venueDraft.city} onChange={(event) => setVenueDraft((current) => ({ ...current, city: event.target.value }))} />
              </FormField>
              <FormField label="Država">
                <Input value={venueDraft.country} onChange={(event) => setVenueDraft((current) => ({ ...current, country: event.target.value }))} />
              </FormField>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="primary" onClick={() => void saveVenue()} disabled={createVenue.isPending || updateVenue.isPending}>
                {venueDraft.id ? (updateVenue.isPending ? "Čuvanje..." : "Sačuvaj stadion") : (createVenue.isPending ? "Kreiranje..." : "Kreiraj stadion")}
              </Button>
              {venueDraft.id ? (
                <Button type="button" onClick={() => setVenueDraft({ id: "", name: "", city: "", country: "" })}>
                  Otkaži
                </Button>
              ) : null}
            </div>
          </div>

          <h3 className="mb-3 text-lg font-semibold">{editingId ? "Uredi teren" : "Novi teren"}</h3>
          <div className="space-y-3">
            <FormField label="Stadion">
              <Select value={draft.venueId} onChange={(event) => setDraft((current) => ({ ...current, venueId: event.target.value }))}>
                <option value="">Izaberi stadion</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Naziv terena">
              <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </FormField>
            <FormField label="Generacija preset">
              <Select
                value={draft.generationLabel}
                onChange={(event) => {
                  applyPreset(event.target.value);
                }}
              >
                <option value="">Bez preseta</option>
                {GENERATION_PRESETS.map((preset) => (
                  <option key={preset.generationLabel} value={preset.generationLabel}>
                    {preset.generationLabel} ({preset.ageGroupCode}, {preset.playerFormat}, {preset.fieldLengthMeters}x{preset.fieldWidthMeters})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Uzrast (code)">
              <Input value={draft.ageGroupCode} onChange={(event) => setDraft((current) => ({ ...current, ageGroupCode: event.target.value }))} />
            </FormField>
            <FormField label="Format igrača">
              <Input value={draft.playerFormat} onChange={(event) => setDraft((current) => ({ ...current, playerFormat: event.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Dužina terena (m)">
                <Input type="number" min={1} value={draft.fieldLengthMeters} onChange={(event) => setDraft((current) => ({ ...current, fieldLengthMeters: event.target.value }))} />
              </FormField>
              <FormField label="Širina terena (m)">
                <Input type="number" min={1} value={draft.fieldWidthMeters} onChange={(event) => setDraft((current) => ({ ...current, fieldWidthMeters: event.target.value }))} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Širina gola (m)">
                <Input type="number" min={0.1} step={0.1} value={draft.goalWidthMeters} onChange={(event) => setDraft((current) => ({ ...current, goalWidthMeters: event.target.value }))} />
              </FormField>
              <FormField label="Visina gola (m)">
                <Input type="number" min={0.1} step={0.1} value={draft.goalHeightMeters} onChange={(event) => setDraft((current) => ({ ...current, goalHeightMeters: event.target.value }))} />
              </FormField>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="primary" onClick={() => void savePitch()} disabled={createPitch.isPending || updatePitch.isPending}>
                {editingId ? "Sačuvaj izmjene" : "Kreiraj teren"}
              </Button>
              {editingId ? <Button type="button" onClick={resetForm}>Otkaži</Button> : null}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
