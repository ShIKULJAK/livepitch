import { LinePerformanceChart } from "@/components/charts/line-performance-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/ui/stat-card";

const data = [
  { label: "R1", home: 34, away: 20 },
  { label: "R2", home: 40, away: 25 },
  { label: "R3", home: 46, away: 20 },
  { label: "R4", home: 55, away: 30 },
  { label: "R5", home: 48, away: 27 },
  { label: "R6", home: 62, away: 29 },
  { label: "R7", home: 61, away: 38 },
  { label: "R8", home: 53, away: 31 },
  { label: "R9", home: 56, away: 29 },
  { label: "R10", home: 70, away: 34 },
];

export default function StatisticsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Statistics" description="In-depth tournament, team and player analytics." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total Goals" value="412" change="+12.5%" />
        <StatCard title="Goals/Match" value="2.58" change="+8.3%" />
        <StatCard title="Assists" value="256" change="+9.1%" />
        <StatCard title="Clean Sheets" value="132" change="-4.2%" trend="down" />
        <StatCard title="Yellow Cards" value="342" change="+3.7%" />
        <StatCard title="Red Cards" value="28" change="-12.5%" trend="down" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Goals Overview" className="xl:col-span-2"><LinePerformanceChart data={data} /></SectionCard>
        <SectionCard title="Results Breakdown"><DonutChart values={[{ name: "Wins", value: 63 }, { name: "Draws", value: 28 }, { name: "Losses", value: 33 }]} colors={["#a6ff00", "#94a3b8", "#ef4444"]} /></SectionCard>
      </div>
    </div>
  );
}

