"use client";

import { useVenues } from "@/hooks/use-competitions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export default function VenuesPage() {
  const { t } = useI18n();
  const venuesQuery = useVenues();
  const selected = venuesQuery.data?.[0];

  return (
    <div className="space-y-4">
      <PageHeader title={t("venues.title")} description={t("venues.description")} />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto lp-scrollbar">
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: "var(--surface-2)" }}>
                <tr>{["Venue", "City", "Country", "Capacity", "Surface", "Status"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--text-secondary)" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(venuesQuery.data ?? []).map((venue) => (
                  <tr key={venue.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3 font-medium">{venue.name}</td>
                    <td className="px-4 py-3">{venue.city}</td>
                    <td className="px-4 py-3">{venue.country}</td>
                    <td className="px-4 py-3">{venue.capacity?.toLocaleString() ?? "-"}</td>
                    <td className="px-4 py-3">{venue.surface ?? "-"}</td>
                    <td className="px-4 py-3">{venue.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-2xl font-semibold">{selected?.name ?? t("venues.none")}</h3>
          {selected ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>{selected.city}, {selected.country}</p>
              <p>{t("venues.dimensions")}: {selected.dimensions ?? "-"}</p>
              <p>{t("venues.lighting")}: {selected.lighting ? t("labels.yes") : t("labels.no")}</p>
              <p>{t("venues.accessibility")}: {selected.accessibility ?? "-"}</p>
            </div>
          ) : null}
        </Card>
      </div>

      {venuesQuery.isLoading ? <Card className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>{t("venues.loading")}</Card> : null}
      {venuesQuery.isError ? <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>{(venuesQuery.error as Error).message}</Card> : null}
    </div>
  );
}
