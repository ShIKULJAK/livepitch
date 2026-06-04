"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MatchStatus } from "@prisma/client";
import {
  Building2,
  Goal,
  LayoutGrid,
  Lightbulb,
  List,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  useCreatePitch,
  useCreateVenue,
  useDeletePitch,
  useDeleteVenue,
  useMatches,
  useTeams,
  useUpdatePitch,
  useUpdateVenue,
  useVenues,
} from "@/hooks/use-competitions";
import { GENERATION_PRESETS, getGenerationPreset } from "@/lib/constants/generation-presets";
import { PageHeader } from "@/components/layout/page-header";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PitchDimensionsDiagram } from "@/components/venues/pitch-dimensions-diagram";
import { formatDateDDMMYYYY, formatTimeStable } from "@/lib/utils/date";

type PitchDraft = {
  id?: string;
  venueId: string;
  name: string;
  surface: string;
  generationLabel: string;
  ageGroupCode: string;
  playerFormat: string;
  fieldLengthMeters: string;
  fieldWidthMeters: string;
  goalWidthMeters: string;
  goalHeightMeters: string;
};

type VenueDraft = {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: string;
  dimensions: string;
  surface: string;
  lighting: boolean;
  accessibility: string;
  teamId: string;
};

type EntryModalTab = "venue" | "pitch";

const DEFAULT_VENUE_LENGTH_METERS = 100;
const DEFAULT_VENUE_WIDTH_METERS = 65;

function createEmptyVenueDraft(): VenueDraft {
  return {
    id: "",
    name: "",
    city: "",
    country: "",
    capacity: "",
    dimensions: `${DEFAULT_VENUE_LENGTH_METERS} x ${DEFAULT_VENUE_WIDTH_METERS} m`,
    surface: "Prirodna trava",
    lighting: true,
    accessibility: "Standard",
    teamId: "",
  };
}

function toDraft(input?: Partial<PitchDraft>): PitchDraft {
  return {
    id: input?.id,
    venueId: input?.venueId ?? "",
    name: input?.name ?? "",
    surface: input?.surface ?? "",
    generationLabel: input?.generationLabel ?? "",
    ageGroupCode: input?.ageGroupCode ?? "",
    playerFormat: input?.playerFormat ?? "",
    fieldLengthMeters: input?.fieldLengthMeters ?? "",
    fieldWidthMeters: input?.fieldWidthMeters ?? "",
    goalWidthMeters: input?.goalWidthMeters ?? "",
    goalHeightMeters: input?.goalHeightMeters ?? "",
  };
}

function getPitchNumberLabel(name: string) {
  return name.match(/\d+/)?.[0] ?? "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase();
}

function renderHighlightedText(value: string, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return value;
  }

  const sourceCharacters = Array.from(value);
  const normalizedCharacters = sourceCharacters.map((character) => normalizeText(character));
  const normalizedSource = normalizedCharacters.join("");
  const matchIndex = normalizedSource.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    return value;
  }

  const startIndex = normalizedCharacters.slice(0, matchIndex).length;
  const endIndex = startIndex + Array.from(normalizedQuery).length;

  return (
    <>
      {sourceCharacters.slice(0, startIndex).join("")}
      <span
        className="rounded-sm px-0.5"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
          color: "inherit",
        }}
      >
        {sourceCharacters.slice(startIndex, endIndex).join("")}
      </span>
      {sourceCharacters.slice(endIndex).join("")}
    </>
  );
}

function formatCapacity(value: number) {
  return new Intl.NumberFormat("bs-BA").format(value);
}

function formatMeters(value: number) {
  return new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 2 }).format(value);
}

function parseVenueDimensions(value: string | null | undefined) {
  const match = value?.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) {
    return {
      lengthMeters: DEFAULT_VENUE_LENGTH_METERS,
      widthMeters: DEFAULT_VENUE_WIDTH_METERS,
      label: `${DEFAULT_VENUE_LENGTH_METERS} x ${DEFAULT_VENUE_WIDTH_METERS} m`,
    };
  }

  const lengthMeters = Number(match[1].replace(",", "."));
  const widthMeters = Number(match[2].replace(",", "."));

  if (!Number.isFinite(lengthMeters) || !Number.isFinite(widthMeters)) {
    return {
      lengthMeters: DEFAULT_VENUE_LENGTH_METERS,
      widthMeters: DEFAULT_VENUE_WIDTH_METERS,
      label: `${DEFAULT_VENUE_LENGTH_METERS} x ${DEFAULT_VENUE_WIDTH_METERS} m`,
    };
  }

  return {
    lengthMeters,
    widthMeters,
    label: `${lengthMeters} x ${widthMeters} m`,
  };
}

function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 32%, var(--border) 68%)",
            backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        >
          <Icon className="h-5 w-5" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
            {label}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {hint}
          </p>
        </div>
      </div>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function getMatchBadgeVariant(status: MatchStatus) {
  if (status === "LIVE") return "live" as const;
  if (status === "FINISHED") return "completed" as const;
  if (status === "POSTPONED") return "inactive" as const;
  return "upcoming" as const;
}

export default function VenuesPage() {
  const venuesQuery = useVenues();
  const matchesQuery = useMatches({ status: "ALL" });
  const createPitch = useCreatePitch();
  const createVenue = useCreateVenue();
  const updateVenue = useUpdateVenue();
  const deleteVenue = useDeleteVenue();
  const updatePitch = useUpdatePitch();
  const deletePitch = useDeletePitch();
  const teamsQuery = useTeams();

  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedPitchId, setSelectedPitchId] = useState<string | null>(null);
  const [openVenueMenuKey, setOpenVenueMenuKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<PitchDraft>(toDraft());
  const [venueDraft, setVenueDraft] = useState<VenueDraft>(createEmptyVenueDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryModalTab, setEntryModalTab] = useState<EntryModalTab>("venue");
  const [venueView, setVenueView] = useState<"grid" | "list">("grid");
  const [hasCustomVenueView, setHasCustomVenueView] = useState(false);

  const venues = venuesQuery.data ?? [];
  const matches = matchesQuery.data ?? [];

  const matchedPitchIdsByVenue = useMemo(() => {
    const query = normalizeText(deferredSearch);
    const matchesByVenue = new Map<string, string[]>();

    if (!query) {
      return matchesByVenue;
    }

    venues.forEach((venue) => {
      const matchedPitchIds = venue.pitches
        .filter((pitch) => {
          const pitchHaystack = normalizeText(
            [
              pitch.name,
              pitch.surface ?? "",
              pitch.playerFormat,
              pitch.generationLabel ?? "",
              pitch.ageGroupCode ?? "",
              pitch.fieldLengthMeters != null ? `${pitch.fieldLengthMeters}` : "",
              pitch.fieldWidthMeters != null ? `${pitch.fieldWidthMeters}` : "",
              pitch.goalWidthMeters != null ? `${pitch.goalWidthMeters}` : "",
              pitch.goalHeightMeters != null ? `${pitch.goalHeightMeters}` : "",
            ].join(" "),
          );

          return pitchHaystack.includes(query);
        })
        .map((pitch) => pitch.id);

      if (matchedPitchIds.length) {
        matchesByVenue.set(venue.id, matchedPitchIds);
      }
    });

    return matchesByVenue;
  }, [deferredSearch, venues]);

  const filteredVenues = useMemo(() => {
    const query = normalizeText(deferredSearch);
    if (!query) return venues;

    return venues.filter((venue) => {
      const venueHaystack = normalizeText(
        [
          venue.name,
          venue.city,
          venue.country,
          venue.team?.name ?? "",
          venue.surface ?? "",
          venue.accessibility ?? "",
          venue.capacity != null ? `${venue.capacity}` : "",
          venue.dimensions ?? "",
        ].join(" "),
      );

      return venueHaystack.includes(query) || matchedPitchIdsByVenue.has(venue.id);
    });
  }, [deferredSearch, matchedPitchIdsByVenue, venues]);

  const selectedVenue = useMemo(() => {
    if (!filteredVenues.length) return null;
    return filteredVenues.find((venue) => venue.id === selectedVenueId) ?? filteredVenues[0];
  }, [filteredVenues, selectedVenueId]);

  const selectedPitch = useMemo(() => {
    if (!selectedVenue?.pitches.length || !selectedPitchId) return null;
    return selectedVenue.pitches.find((pitch) => pitch.id === selectedPitchId) ?? null;
  }, [selectedPitchId, selectedVenue]);

  const fallbackGoalPitch = useMemo(() => {
    if (!selectedVenue?.pitches.length) return null;
    return (
      selectedVenue.pitches.find(
        (pitch) =>
          pitch.isActive &&
          pitch.goalWidthMeters != null &&
          pitch.goalHeightMeters != null,
      ) ??
      selectedVenue.pitches.find(
        (pitch) =>
          pitch.goalWidthMeters != null && pitch.goalHeightMeters != null,
      ) ??
      null
    );
  }, [selectedVenue]);

  const displayedGoalWidthMeters =
    selectedPitch?.goalWidthMeters ?? fallbackGoalPitch?.goalWidthMeters ?? null;
  const displayedGoalHeightMeters =
    selectedPitch?.goalHeightMeters ?? fallbackGoalPitch?.goalHeightMeters ?? null;

  const venueMatches = useMemo(() => {
    if (!selectedVenue) return [];

    const venueName = normalizeText(selectedVenue.name);
    const pitchNames = selectedVenue.pitches.map((pitch) => normalizeText(pitch.name));

    return matches
      .filter((match) => {
        const haystack = normalizeText(`${match.venue} ${match.venueLabel ?? ""} ${match.pitchName ?? ""}`);
        return haystack.includes(venueName) || pitchNames.some((pitchName) => haystack.includes(pitchName));
      })
      .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime());
  }, [matches, selectedVenue]);

  const scheduleMatches = useMemo(() => {
    if (!selectedVenue) return [];
    if (!selectedPitch) return venueMatches;

    const selectedPitchName = normalizeText(selectedPitch.name);
    return venueMatches.filter(
      (match) =>
        normalizeText(match.pitchName ?? "") === selectedPitchName ||
        normalizeText(
          `${match.pitchName ?? ""} ${match.venueLabel ?? ""} ${match.venue ?? ""}`
        ).includes(selectedPitchName)
    );
  }, [selectedPitch, selectedVenue, venueMatches]);

  const selectedVenueDimensions = useMemo(
    () => parseVenueDimensions(selectedVenue?.dimensions),
    [selectedVenue?.dimensions]
  );

  const summary = useMemo(() => {
    const totalPitches = venues.reduce((sum, venue) => sum + venue.pitches.length, 0);
    const totalCapacity = venues.reduce((sum, venue) => sum + (venue.capacity ?? 0), 0);
    const litVenues = venues.filter((venue) => venue.lighting).length;

    return {
      venueCount: venues.length,
      totalPitches,
      totalCapacity,
      litVenues,
    };
  }, [venues]);

  useEffect(() => {
    if (hasCustomVenueView) return;
    setVenueView(venues.length > 4 ? "list" : "grid");
  }, [hasCustomVenueView, venues.length]);

  useEffect(() => {
    const query = normalizeText(deferredSearch);
    if (!query || !selectedVenue) return;

    const matchedPitchIds = matchedPitchIdsByVenue.get(selectedVenue.id) ?? [];
    if (!matchedPitchIds.length) {
      if (selectedPitchId && !selectedVenue.pitches.some((pitch) => pitch.id === selectedPitchId)) {
        setSelectedPitchId(null);
      }
      return;
    }

    if (!selectedPitchId || !matchedPitchIds.includes(selectedPitchId)) {
      setSelectedPitchId(matchedPitchIds[0]);
    }
  }, [deferredSearch, matchedPitchIdsByVenue, selectedPitchId, selectedVenue]);

  function resetVenueForm() {
    setVenueDraft(createEmptyVenueDraft());
  }

  function resetPitchForm() {
    setEditingId(null);
    setDraft(toDraft({ venueId: selectedVenue?.id ?? venues[0]?.id ?? "" }));
  }

  function closeEntryModal() {
    setIsEntryModalOpen(false);
    setEntryModalTab("venue");
    resetVenueForm();
    resetPitchForm();
  }

  function openNewEntryModal() {
    resetVenueForm();
    setDraft(toDraft());
    setEditingId(null);
    setEntryModalTab("venue");
    setIsEntryModalOpen(true);
  }

  function openVenueEditModal(venue: (typeof venues)[number]) {
    loadVenueIntoForm(venue);
    setDraft(toDraft({ venueId: venue.id }));
    setEditingId(null);
    setEntryModalTab("venue");
    setIsEntryModalOpen(true);
  }

  function openPitchCreateModal(venueId: string) {
    resetVenueForm();
    setEditingId(null);
    setDraft(toDraft({ venueId }));
    setEntryModalTab("pitch");
    setIsEntryModalOpen(true);
  }

  function openPitchEditModal(pitch: (typeof venues)[number]["pitches"][number], venueId: string) {
    loadPitchIntoForm(pitch, venueId);
    setVenueDraft(createEmptyVenueDraft());
    setEntryModalTab("pitch");
    setIsEntryModalOpen(true);
  }

  function renderVenueActionsMenu(venue: (typeof venues)[number], scope: "list" | "detail") {
    const menuKey = `${scope}:${venue.id}`;
    const isOpen = openVenueMenuKey === menuKey;

    return (
      <div className={`relative shrink-0 ${isOpen ? "z-30" : ""}`}>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface-2)",
            color: "var(--text-secondary)",
          }}
          onClick={(event) => {
            event.stopPropagation();
            setOpenVenueMenuKey((current) => (current === menuKey ? null : menuKey));
          }}
          aria-label="Open actions"
        >
          ...
        </button>
        {isOpen ? (
          <div
            className={`absolute top-10 z-20 w-40 rounded-lg border p-1 text-xs shadow-lg ${scope === "list" ? "left-0" : "right-0"}`}
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
          >
            <button
              type="button"
              className="block w-full rounded-md px-2 py-1 text-left hover:opacity-90"
              onClick={(event) => {
                event.stopPropagation();
                openVenueEditModal(venue);
                setOpenVenueMenuKey(null);
              }}
            >
              Uredi stadion
            </button>
            <button
              type="button"
              className="block w-full rounded-md px-2 py-1 text-left hover:opacity-90"
              onClick={(event) => {
                event.stopPropagation();
                openPitchCreateModal(venue.id);
                setOpenVenueMenuKey(null);
              }}
            >
              Dodaj teren
            </button>
            <button
              type="button"
              className="block w-full rounded-md px-2 py-1 text-left hover:opacity-90"
              style={{ color: "var(--danger)" }}
              onClick={(event) => {
                event.stopPropagation();
                if (!window.confirm(`Obrisati stadion ${venue.name}?`)) return;
                deleteVenue.mutate(venue.id);
                setOpenVenueMenuKey(null);
              }}
              disabled={deleteVenue.isPending}
            >
              Obriši
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function loadVenueIntoForm(venue: (typeof venues)[number]) {
    setVenueDraft({
      id: venue.id,
      name: venue.name,
      city: venue.city ?? "",
      country: venue.country ?? "",
      capacity: venue.capacity ? String(venue.capacity) : "",
      dimensions: venue.dimensions ?? `${DEFAULT_VENUE_LENGTH_METERS} x ${DEFAULT_VENUE_WIDTH_METERS} m`,
      surface: venue.surface ?? "Prirodna trava",
      lighting: venue.lighting,
      accessibility: venue.accessibility ?? "Standard",
      teamId: venue.teamId ?? "",
    });
  }

  function loadPitchIntoForm(pitch: (typeof venues)[number]["pitches"][number], venueId: string) {
    setEditingId(pitch.id);
    setDraft(
      toDraft({
        id: pitch.id,
        venueId: pitch.venueId ?? venueId,
        name: pitch.name,
        surface: pitch.surface ?? "",
        generationLabel: pitch.generationLabel ?? "",
        ageGroupCode: pitch.ageGroupCode ?? "",
        playerFormat: pitch.playerFormat,
        fieldLengthMeters: String(pitch.fieldLengthMeters),
        fieldWidthMeters: String(pitch.fieldWidthMeters),
        goalWidthMeters: pitch.goalWidthMeters ? String(pitch.goalWidthMeters) : "",
        goalHeightMeters: pitch.goalHeightMeters ? String(pitch.goalHeightMeters) : "",
      })
    );
  }

  const visiblePitches = useMemo(() => {
    if (!selectedVenue) return [];

    const query = normalizeText(deferredSearch);
    if (!query) {
      return selectedVenue.pitches;
    }

    const matchedPitchIds = matchedPitchIdsByVenue.get(selectedVenue.id);
    if (!matchedPitchIds?.length) {
      return selectedVenue.pitches;
    }

    return selectedVenue.pitches.filter((pitch) => matchedPitchIds.includes(pitch.id));
  }, [deferredSearch, matchedPitchIdsByVenue, selectedVenue]);

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
      goalWidthMeters: String(preset.goalWidthMeters),
      goalHeightMeters: String(preset.goalHeightMeters),
    }));
  }

  async function saveVenue() {
    if (!venueDraft.name.trim()) return;

    const payload = {
      name: venueDraft.name.trim(),
      city: venueDraft.city.trim() || null,
      country: venueDraft.country.trim() || null,
      capacity: venueDraft.capacity ? Number(venueDraft.capacity) : null,
      dimensions: venueDraft.dimensions.trim() || null,
      surface: venueDraft.surface.trim() || null,
      lighting: venueDraft.lighting,
      accessibility: venueDraft.accessibility.trim() || null,
      teamId: venueDraft.teamId || null,
    };

    if (venueDraft.id) {
      const updatedVenue = await updateVenue.mutateAsync({ id: venueDraft.id, ...payload }) as { id: string } | undefined;
      if (updatedVenue?.id) {
        setSelectedVenueId(updatedVenue.id);
        setDraft((current) => ({ ...current, venueId: updatedVenue.id }));
      }
    } else {
      const createdVenue = await createVenue.mutateAsync(payload) as { id: string; name?: string; teamId?: string | null } | undefined;
      if (createdVenue?.id) {
        setSelectedVenueId(createdVenue.id);
        setSelectedPitchId(null);
        setVenueDraft((current) => ({ ...current, id: createdVenue.id }));
        setDraft(toDraft({ venueId: createdVenue.id }));
        setEntryModalTab("pitch");
      }
    }
  }

  async function savePitch() {
    if (!draft.venueId || !draft.name || !draft.playerFormat || !draft.fieldLengthMeters || !draft.fieldWidthMeters) return;

    const payload = {
      venueId: draft.venueId,
      name: draft.name,
      surface: draft.surface.trim() || null,
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
      const createdPitch = await createPitch.mutateAsync(payload) as { id: string; venueId?: string | null } | undefined;
      if (createdPitch?.id) {
        setSelectedVenueId(payload.venueId);
        setSelectedPitchId(createdPitch.id);
      }
    }

    closeEntryModal();
  }

  const canAccessPitchTab = Boolean(editingId || draft.venueId || venueDraft.id);
  const entryModalTitle = editingId
    ? "Uredi teren"
    : venueDraft.id && entryModalTab === "venue"
      ? "Uredi stadion"
      : "Novi unos";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lokacije"
        description="Operativni pregled stadiona i terena sa fokusom na kapacitet, opremu i raspoloživost."
        searchValue={searchTerm}
        onSearchChange={(event) => setSearchTerm(event.currentTarget.value)}
        searchPlaceholder="Pretraži lokacije ili terene..."
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={openNewEntryModal}
            >
              <Pencil className="h-4 w-4" />
              Novi unos
            </Button>
          </div>
        }
      />

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard icon={Building2} label="Stadioni" value={String(summary.venueCount)} hint="Registrovane lokacije" />
        <DashboardMetricCard icon={Goal} label="Tereni" value={String(summary.totalPitches)} hint="Ukupan broj terena" />
        <DashboardMetricCard icon={Lightbulb} label="Rasvjeta" value={String(summary.litVenues)} hint="Lokacije sa rasvjetom" />
        <DashboardMetricCard icon={Users} label="Ukupni kapacitet" value={formatCapacity(summary.totalCapacity)} hint="Sjedećih mjesta" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-4">
        <div className="space-y-4 xl:col-span-3">
          <Card className="flex max-h-[430px] flex-col p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Pregled lokacija</h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Fokusirani prikaz umjesto ponavljanja istog terena u svakoj kartici.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl border p-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: venueView === "list" ? "color-mix(in srgb, var(--primary) 16%, transparent)" : "transparent",
                      color: venueView === "list" ? "var(--primary)" : "var(--text-secondary)",
                    }}
                    onClick={() => {
                      setVenueView("list");
                      setHasCustomVenueView(true);
                    }}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: venueView === "grid" ? "color-mix(in srgb, var(--primary) 16%, transparent)" : "transparent",
                      color: venueView === "grid" ? "var(--primary)" : "var(--text-secondary)",
                    }}
                    onClick={() => {
                      setVenueView("grid");
                      setHasCustomVenueView(true);
                    }}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {filteredVenues.length} rezultata
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className={venueView === "grid" ? "grid gap-3 lg:grid-cols-2" : "space-y-3"}>
                {filteredVenues.map((venue) => {
                  const isSelected = venue.id === selectedVenue?.id;
                  return (
                    <div
                      key={venue.id}
                      role="button"
                      tabIndex={0}
                      className={`w-full rounded-2xl border text-left transition-transform hover:-translate-y-0.5 ${venueView === "list" ? "p-2.5" : "p-4"}`}
                      style={{
                        borderColor: isSelected ? "var(--primary)" : "var(--border)",
                        background: isSelected
                          ? "linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--surface) 88%) 0%, var(--surface) 100%)"
                          : "var(--surface-2)",
                        boxShadow: isSelected ? "0 0 0 1px color-mix(in srgb, var(--primary) 26%, transparent)" : "none",
                      }}
                      onClick={() => {
                        setSelectedVenueId(venue.id);
                        setSelectedPitchId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelectedVenueId(venue.id);
                        setSelectedPitchId(null);
                      }}
                    >
                      {venueView === "list" ? (
                        <div className="grid items-center gap-2 lg:grid-cols-[minmax(0,1.8fr)_110px_130px_160px_80px]">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-base font-semibold">{renderHighlightedText(venue.name, deferredSearch)}</p>
                              {renderVenueActionsMenu(venue, "list")}
                            </div>
                            <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                              {renderHighlightedText(`${venue.city}, ${venue.country}`, deferredSearch)}
                            </p>
                          </div>
                          <div className="rounded-xl border px-2.5 py-1.5 text-left" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>Tereni</p>
                            <p className="mt-0.5 font-semibold">{venue.pitches.length}</p>
                          </div>
                          <div className="rounded-xl border px-2.5 py-1.5 text-left" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>Kapacitet</p>
                            <p className="mt-0.5 font-semibold">{venue.capacity ? formatCapacity(venue.capacity) : "-"}</p>
                          </div>
                          <div className="rounded-xl border px-2.5 py-1.5 text-left" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>Klub</p>
                            <p className="mt-0.5 truncate font-semibold">
                              {venue.team?.name ? renderHighlightedText(venue.team.name, deferredSearch) : "-"}
                            </p>
                          </div>
                          <div className="flex justify-end">
                            <span
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                              style={{
                                borderColor: venue.lighting
                                  ? "color-mix(in srgb, var(--primary) 28%, var(--border))"
                                  : "var(--border)",
                                backgroundColor: venue.lighting
                                  ? "color-mix(in srgb, var(--primary) 16%, transparent)"
                                  : "color-mix(in srgb, var(--surface-2) 82%, transparent)",
                                color: venue.lighting ? "var(--primary)" : "var(--text-secondary)",
                              }}
                              title={venue.lighting ? "Rasvjeta aktivna" : "Bez rasvjete"}
                              aria-label={venue.lighting ? "Rasvjeta aktivna" : "Bez rasvjete"}
                            >
                              <Lightbulb className="h-4 w-4" strokeWidth={2} />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-base font-semibold">{renderHighlightedText(venue.name, deferredSearch)}</p>
                                {renderVenueActionsMenu(venue, "list")}
                              </div>
                              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                                {renderHighlightedText(`${venue.city}, ${venue.country}`, deferredSearch)}
                              </p>
                            </div>
                            <span
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                              style={{
                                borderColor: venue.lighting
                                  ? "color-mix(in srgb, var(--primary) 28%, var(--border))"
                                  : "var(--border)",
                                backgroundColor: venue.lighting
                                  ? "color-mix(in srgb, var(--primary) 16%, transparent)"
                                  : "color-mix(in srgb, var(--surface-2) 82%, transparent)",
                                color: venue.lighting ? "var(--primary)" : "var(--text-secondary)",
                              }}
                              title={venue.lighting ? "Rasvjeta aktivna" : "Bez rasvjete"}
                              aria-label={venue.lighting ? "Rasvjeta aktivna" : "Bez rasvjete"}
                            >
                              <Lightbulb className="h-4 w-4" strokeWidth={2} />
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                              <p style={{ color: "var(--text-secondary)" }}>Tereni</p>
                              <p className="mt-1 font-semibold">{venue.pitches.length}</p>
                            </div>
                            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                              <p style={{ color: "var(--text-secondary)" }}>Kapacitet</p>
                              <p className="mt-1 font-semibold">{venue.capacity ? formatCapacity(venue.capacity) : "-"}</p>
                            </div>
                            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                              <p style={{ color: "var(--text-secondary)" }}>Klub</p>
                              <p className="mt-1 truncate font-semibold">{venue.team?.name ?? "-"}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {!filteredVenues.length ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  Nema lokacija za prikaz prema trenutnoj pretrazi.
                </div>
              ) : null}
            </div>
          </Card>

          {selectedVenue ? (
            <>
              <Card
                className="overflow-hidden p-4"
                style={{
                  backgroundColor: "var(--surface-2)",
                }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <MapPin className="h-4 w-4" />
                      {selectedVenue.city}, {selectedVenue.country}
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">{selectedVenue.name}</h2>
                    <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {selectedVenue.team?.name ? `Povezano sa klubom ${selectedVenue.team.name}` : "Lokacija još nije povezana sa klubom."}
                    </p>
                  </div>

                  <div className="flex justify-end">{renderVenueActionsMenu(selectedVenue, "detail")}</div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--surface) 82%, transparent)" }}>
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                      Kapacitet
                    </p>
                    <p className="mt-2 text-xl font-semibold">{selectedVenue.capacity ? formatCapacity(selectedVenue.capacity) : "-"}</p>
                  </div>
                  <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--surface) 82%, transparent)" }}>
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                      Podloga
                    </p>
                    <p className="mt-2 text-xl font-semibold">{selectedVenue.surface ?? "-"}</p>
                  </div>
                  <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--surface) 82%, transparent)" }}>
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                      Aktivni tereni
                    </p>
                    <p className="mt-2 text-xl font-semibold">{selectedVenue.pitches.filter((pitch) => pitch.isActive).length}</p>
                  </div>
                  <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--surface) 82%, transparent)" }}>
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                      Utakmice 7 dana
                    </p>
                    <p className="mt-2 text-xl font-semibold">{venueMatches.length}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {visiblePitches.map((pitch) => {
                    const isActive = pitch.id === selectedPitch?.id;
                    return (
                      <button
                        key={pitch.id}
                        type="button"
                        className="rounded-xl border px-3 py-2 text-left text-sm"
                        style={{
                          borderColor: isActive ? "var(--primary)" : "var(--border)",
                          backgroundColor: isActive
                            ? "color-mix(in srgb, var(--primary) 12%, var(--surface) 88%)"
                            : "var(--surface)",
                        }}
                        onClick={() => setSelectedPitchId((current) => (current === pitch.id ? null : pitch.id))}
                      >
                        <div className="font-medium">{renderHighlightedText(pitch.name, deferredSearch)}</div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {renderHighlightedText(
                            `${pitch.playerFormat} · ${pitch.fieldLengthMeters} x ${pitch.fieldWidthMeters} m${pitch.surface ? ` · ${pitch.surface}` : ""}`,
                            deferredSearch,
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {!visiblePitches.length ? (
                    <div
                      className="w-full rounded-2xl border border-dashed px-4 py-3 text-sm"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      Nema terena koji odgovaraju pretrazi za ovu lokaciju.
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, transparent)" }}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedPitch ? "Plan terena" : "Plan stadiona"}</h3>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {selectedPitch
                          ? `${selectedPitch.name} · ${selectedPitch.playerFormat}${selectedPitch.surface ? ` · ${selectedPitch.surface}` : ""}${selectedPitch.generationLabel ? ` · ${selectedPitch.generationLabel}` : ""}`
                          : `${selectedVenue.name} · ukupne dimenzije stadiona`}
                        </p>
                    </div>
                    {selectedPitch ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => openPitchEditModal(selectedPitch, selectedVenue.id)}>
                          <Pencil className="h-4 w-4" />
                          Uredi teren
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (!window.confirm(`Obrisati teren ${selectedPitch.name}?`)) return;
                            deletePitch.mutate(selectedPitch.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Obriši teren
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <PitchDimensionsDiagram
                    className="mt-2"
                    title={selectedPitch ? `${selectedPitch.name} · 2D prikaz` : `${selectedVenue.name} · 2D prikaz stadiona`}
                    fieldNumber={selectedPitch ? getPitchNumberLabel(selectedPitch.name) : ""}
                    lengthMeters={selectedPitch?.fieldLengthMeters ?? selectedVenueDimensions.lengthMeters}
                    widthMeters={selectedPitch?.fieldWidthMeters ?? selectedVenueDimensions.widthMeters}
                    goalWidthMeters={displayedGoalWidthMeters}
                    goalHeightMeters={displayedGoalHeightMeters}
                    size="full"
                    rightTitle={selectedPitch ? "Raspored terena" : "Raspored stadiona"}
                    rightPanel={
                      <>
                        <div className="border-b px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--info) 18%, var(--border))" }}>
                          <p className="text-sm font-semibold">
                            {selectedPitch ? selectedPitch.name : selectedVenue.name}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                            {selectedPitch
                              ? `Aktuelni raspored za selektovani teren · ${scheduleMatches.length}`
                              : `Ukupan raspored svih terena na stadionu · ${scheduleMatches.length}`}
                          </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                          {scheduleMatches.length ? (
                            <div className="space-y-2">
                              {scheduleMatches.map((match) => (
                                <div
                                  key={match.id}
                                  className="rounded-xl border px-3 py-3"
                                  style={{
                                    borderColor: "color-mix(in srgb, var(--info) 18%, var(--border))",
                                    backgroundColor: "color-mix(in srgb, var(--surface-2) 90%, var(--surface-1))",
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
                                      {formatDateDDMMYYYY(match.scheduledAt)} · {formatTimeStable(match.scheduledAt)}
                                    </div>
                                    <Badge variant={getMatchBadgeVariant(match.status)}>{match.status}</Badge>
                                  </div>
                                  <div className="mt-2 text-sm font-semibold">
                                    {match.homeTeam} - {match.awayTeam}
                                  </div>
                                  <div className="mt-1 flex items-center justify-between gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                                    <span>{match.competition}</span>
                                    <span>{match.pitchName ?? selectedVenue.name}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div
                              className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed text-sm"
                              style={{
                                borderColor: "color-mix(in srgb, var(--info) 18%, var(--border))",
                                color: "var(--text-secondary)",
                                backgroundColor: "color-mix(in srgb, var(--surface-2) 72%, var(--surface-1))",
                              }}
                            >
                              Nema zakazanih utakmica za ovaj prikaz.
                            </div>
                          )}
                        </div>
                      </>
                    }
                  />
                </div>
              </Card>

            </>
          ) : (
            <Card className="p-6 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
              Dodajte prvu lokaciju ili promijenite pretragu da biste vidjeli detaljan pregled.
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:col-span-1 xl:sticky xl:top-28 xl:self-start">
          <Card className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: "var(--primary)" }} />
              <div>
                <h3 className="text-lg font-semibold">Detalji lokacije</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Fokusirani stadion i aktivni teren bez dupliranja sadržaja.
                </p>
              </div>
            </div>

            {selectedVenue ? (
              <div className="space-y-2">
                <DetailRow label="Naziv stadiona" value={selectedVenue.name} />
                <DetailRow label="Grad / država" value={`${selectedVenue.city}, ${selectedVenue.country}`} />
                <DetailRow label="Naziv terena" value={selectedPitch?.name ?? "Nije selektovan"} />
                <DetailRow
                  label="Dimenzije"
                  value={
                    selectedPitch
                      ? `${selectedPitch.fieldLengthMeters} x ${selectedPitch.fieldWidthMeters} m`
                      : selectedVenueDimensions.label
                  }
                />
                <DetailRow
                  label="Dimenzije gola"
                  value={
                    displayedGoalWidthMeters && displayedGoalHeightMeters
                      ? `${formatMeters(displayedGoalWidthMeters)} x ${formatMeters(displayedGoalHeightMeters)} m`
                      : "Nije definisano"
                  }
                />
                <DetailRow label="Podloga terena" value={selectedPitch?.surface ?? "Nije selektovana"} />
                <DetailRow label="Podloga" value={selectedVenue.surface ?? "Nije definisano"} />
                <DetailRow label="Kapacitet" value={selectedVenue.capacity ? `${formatCapacity(selectedVenue.capacity)} mjesta` : "Nije unesen"} />
                <DetailRow label="Rasvjeta" value={selectedVenue.lighting ? "Aktivna" : "Nije aktivna"} />
                <DetailRow label="Status" value={selectedVenue.status} />
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Nema izabrane lokacije.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={isEntryModalOpen}
        onClose={closeEntryModal}
        title={entryModalTitle}
        contentClassName="max-w-6xl"
      >
        <div className="space-y-4">
          <div
            className="flex flex-wrap items-end gap-1 border-b pb-0"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              type="button"
              className="relative min-w-[170px] rounded-t-xl border border-b-0 px-4 py-2 text-left transition-colors"
              style={{
                borderColor:
                  entryModalTab === "venue"
                    ? "color-mix(in srgb, var(--border) 84%, var(--primary) 16%)"
                    : "transparent",
                backgroundColor:
                  entryModalTab === "venue"
                    ? "var(--surface-1)"
                    : "color-mix(in srgb, var(--surface-2) 92%, transparent)",
                color: entryModalTab === "venue" ? "inherit" : "var(--text-secondary)",
                transform: entryModalTab === "venue" ? "translateY(1px)" : "none",
              }}
              onClick={() => setEntryModalTab("venue")}
            >
              <p className="text-sm font-semibold">{venueDraft.id ? "Uredi stadion" : "Novi stadion"}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                Osnovni podaci o stadionu
              </p>
            </button>
            <button
              type="button"
              className="relative min-w-[170px] rounded-t-xl border border-b-0 px-4 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55"
              style={{
                borderColor:
                  entryModalTab === "pitch"
                    ? "color-mix(in srgb, var(--border) 84%, var(--primary) 16%)"
                    : "transparent",
                backgroundColor:
                  entryModalTab === "pitch"
                    ? "var(--surface-1)"
                    : "color-mix(in srgb, var(--surface-2) 92%, transparent)",
                color: entryModalTab === "pitch" ? "inherit" : "var(--text-secondary)",
                transform: entryModalTab === "pitch" ? "translateY(1px)" : "none",
              }}
              onClick={() => setEntryModalTab("pitch")}
              disabled={!canAccessPitchTab}
            >
              <p className="text-sm font-semibold">{editingId ? "Uredi teren" : "Novi teren"}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                {canAccessPitchTab
                  ? "Dimenzije i pravila terena"
                  : "Aktivira se nakon stadiona"}
              </p>
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {entryModalTab === "venue" ? (
              <Card className="p-4 xl:col-span-2">
                <h3 className="mb-3 text-lg font-semibold">{venueDraft.id ? "Uredi stadion" : "Novi stadion"}</h3>
                <div className="space-y-3">
                  <FormField label="Naziv stadiona">
                    <Input
                      value={venueDraft.name}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setVenueDraft((current) => ({ ...current, name: value }));
                      }}
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Grad">
                      <Input
                        value={venueDraft.city}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setVenueDraft((current) => ({ ...current, city: value }));
                        }}
                      />
                    </FormField>
                    <FormField label="Država">
                      <Input
                        value={venueDraft.country}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setVenueDraft((current) => ({ ...current, country: value }));
                        }}
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Kapacitet">
                      <Input
                        type="number"
                        min={0}
                        value={venueDraft.capacity}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setVenueDraft((current) => ({ ...current, capacity: value }));
                        }}
                      />
                    </FormField>
                    <FormField label="Dimenzije">
                      <Input
                        value={venueDraft.dimensions}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setVenueDraft((current) => ({ ...current, dimensions: value }));
                        }}
                      />
                    </FormField>
                  </div>

                  <FormField label="Podloga">
                    <Select
                      value={venueDraft.surface}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setVenueDraft((current) => ({ ...current, surface: value }));
                      }}
                    >
                      <option value="Prirodna trava">Prirodna trava</option>
                      <option value="Umjetna trava">Umjetna trava</option>
                      <option value="Hibridna trava">Hibridna trava</option>
                    </Select>
                  </FormField>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Rasvjeta">
                      <Select
                        value={venueDraft.lighting ? "true" : "false"}
                        onChange={(event) => {
                          const value = event.currentTarget.value === "true";
                          setVenueDraft((current) => ({ ...current, lighting: value }));
                        }}
                      >
                        <option value="true">Aktivna</option>
                        <option value="false">Neaktivna</option>
                      </Select>
                    </FormField>
                    <FormField label="Pristup">
                      <Input
                        value={venueDraft.accessibility}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setVenueDraft((current) => ({ ...current, accessibility: value }));
                        }}
                      />
                    </FormField>
                  </div>

                  <FormField label="Team / Club">
                    <Select
                      value={venueDraft.teamId}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setVenueDraft((current) => ({ ...current, teamId: value }));
                      }}
                    >
                      <option value="">Nije povezano</option>
                      {(teamsQuery.data ?? []).map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void saveVenue()}
                      disabled={createVenue.isPending || updateVenue.isPending}
                    >
                      {venueDraft.id
                        ? updateVenue.isPending
                          ? "Čuvanje..."
                          : "Sačuvaj stadion"
                        : createVenue.isPending
                          ? "Kreiranje..."
                          : "Kreiraj stadion"}
                    </Button>
                    <Button type="button" onClick={closeEntryModal}>
                      Zatvori
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="min-w-0 overflow-hidden p-4 xl:col-span-2">
                <h3 className="mb-3 text-lg font-semibold">{editingId ? "Uredi teren" : "Novi teren"}</h3>
                <div className="space-y-3">
                  <FormField label="Stadion">
                    <Select
                      value={draft.venueId}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDraft((current) => ({ ...current, venueId: value }));
                      }}
                    >
                      <option value="">Izaberi stadion</option>
                      {venues.map((venue) => (
                        <option key={venue.id} value={venue.id}>
                          {venue.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Naziv terena">
                    <Input
                      value={draft.name}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDraft((current) => ({ ...current, name: value }));
                      }}
                    />
                  </FormField>

                  <FormField label="Podloga">
                    <Select
                      value={draft.surface}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDraft((current) => ({ ...current, surface: value }));
                      }}
                    >
                      <option value="">Izaberi podlogu</option>
                      <option value="Prirodna trava">Prirodna trava</option>
                      <option value="Umjetna trava">Umjetna trava</option>
                      <option value="Hibridna trava">Hibridna trava</option>
                    </Select>
                  </FormField>

                  <FormField label="Generacija preset">
                    <Select
                      value={draft.generationLabel}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        applyPreset(value);
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

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Uzrast (code)">
                      <Input
                        value={draft.ageGroupCode}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({ ...current, ageGroupCode: value }));
                        }}
                      />
                    </FormField>
                    <FormField label="Format igrača">
                      <Input
                        value={draft.playerFormat}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({ ...current, playerFormat: value }));
                        }}
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Dužina terena (m)">
                      <Input
                        type="number"
                        min={1}
                        value={draft.fieldLengthMeters}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({ ...current, fieldLengthMeters: value }));
                        }}
                      />
                    </FormField>
                    <FormField label="Širina terena (m)">
                      <Input
                        type="number"
                        min={1}
                        value={draft.fieldWidthMeters}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({ ...current, fieldWidthMeters: value }));
                        }}
                      />
                    </FormField>
                  </div>

                  {Number(draft.fieldLengthMeters) > 0 && Number(draft.fieldWidthMeters) > 0 ? (
                    <PitchDimensionsDiagram
                      title={draft.name.trim() ? `${draft.name} · pregled` : "Pregled dimenzija"}
                      fieldNumber={getPitchNumberLabel(draft.name)}
                      lengthMeters={Number(draft.fieldLengthMeters)}
                      widthMeters={Number(draft.fieldWidthMeters)}
                      goalWidthMeters={draft.goalWidthMeters ? Number(draft.goalWidthMeters) : null}
                      goalHeightMeters={draft.goalHeightMeters ? Number(draft.goalHeightMeters) : null}
                    />
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Širina gola (m)">
                      <Input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={draft.goalWidthMeters}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({ ...current, goalWidthMeters: value }));
                        }}
                      />
                    </FormField>
                    <FormField label="Visina gola (m)">
                      <Input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={draft.goalHeightMeters}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({ ...current, goalHeightMeters: value }));
                        }}
                      />
                    </FormField>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void savePitch()}
                      disabled={createPitch.isPending || updatePitch.isPending}
                    >
                      {editingId
                        ? updatePitch.isPending
                          ? "Čuvanje..."
                          : "Sačuvaj izmjene"
                        : createPitch.isPending
                          ? "Kreiranje..."
                          : "Kreiraj teren"}
                    </Button>
                    <Button type="button" onClick={closeEntryModal}>
                      Zatvori
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
