"use client";

import { LinePerformanceChart } from "@/components/charts/line-performance-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { useStatisticsSnapshot } from "@/hooks/use-competitions";

export default function StatisticsPage() {
  const statisticsQuery = useStatisticsSnapshot();
  const snapshot = statisticsQuery.data;

  return (
    <div className="space-y-4">
      <PageHeader title="Statistics" description="Real analytics from recorded matches and match stats." />

      {statisticsQuery.isLoading ? (
        <>
          <LoadingSkeleton />
          <LoadingSkeleton />
        </>
      ) : null}

      {statisticsQuery.isError ? (
        <Card className="p-4 text-sm" style={{ color: "var(--danger)" }}>
          {(statisticsQuery.error as Error).message}
        </Card>
      ) : null}

      {snapshot ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard title="Total Goals" value={String(snapshot.totalGoals)} change={`${snapshot.goalEvents} recorded goal events`} />
            <StatCard title="Goals/Match" value={snapshot.goalsPerMatch.toFixed(2)} change={`${snapshot.resultsBreakdown.reduce((sum, item) => sum + item.value, 0)} scored matches`} />
            <StatCard title="Goal Events" value={String(snapshot.goalEvents)} change="Tracked from match details" />
            <StatCard title="Clean Sheets" value={String(snapshot.cleanSheets)} change="Matches with at least one zero" />
            <StatCard title="Yellow Cards" value={String(snapshot.yellowCards)} change="Aggregated from team stats" />
            <StatCard title="Red Cards" value={String(snapshot.redCards)} change="Aggregated from team stats" trend={snapshot.redCards > 0 ? "down" : "up"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard title="Goals Overview" className="xl:col-span-2">
              <LinePerformanceChart data={snapshot.goalsOverview} />
            </SectionCard>
            <SectionCard title="Results Breakdown">
              <DonutChart values={snapshot.resultsBreakdown} colors={["#a6ff00", "#94a3b8", "#ef4444"]} />
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
