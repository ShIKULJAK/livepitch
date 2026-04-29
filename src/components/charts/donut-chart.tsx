"use client";

import { useSyncExternalStore } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export function DonutChart({ values, colors }: { values: { name: string; value: number }[]; colors: string[] }) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!isClient) {
    return <div className="h-56 w-full animate-pulse rounded-xl" style={{ backgroundColor: "var(--surface-2)" }} aria-hidden />;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={values} innerRadius={62} outerRadius={90} dataKey="value" paddingAngle={2}>
            {values.map((_, idx) => (
              <Cell key={idx} fill={colors[idx % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

