"use client";

import { useSyncExternalStore } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point {
  label: string;
  home: number;
  away: number;
}

export function LinePerformanceChart({ data }: { data: Point[] }) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!isClient) {
    return <div className="h-64 w-full animate-pulse rounded-xl" style={{ backgroundColor: "var(--surface-2)" }} aria-hidden />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "12px" }} />
          <Line dataKey="home" stroke="var(--primary)" strokeWidth={3} dot={false} />
          <Line dataKey="away" stroke="var(--danger)" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

