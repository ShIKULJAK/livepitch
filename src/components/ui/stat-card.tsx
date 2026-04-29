import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend?: "up" | "down";
}

export function StatCard({ title, value, change, trend = "up" }: StatCardProps) {
  return (
    <Card className="p-5">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{title}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight">{value}</p>
      <div className="mt-3 flex items-center gap-1 text-sm" style={{ color: trend === "up" ? "var(--primary)" : "var(--danger)" }}>
        {trend === "up" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span>{change}</span>
      </div>
    </Card>
  );
}

