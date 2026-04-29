import { Card } from "@/components/ui/card";

interface DataTableProps {
  columns: string[];
  rows: React.ReactNode[][];
}

export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto lp-scrollbar">
        <table className="min-w-full text-left text-sm">
          <thead style={{ backgroundColor: "color-mix(in srgb,var(--surface-2) 70%, transparent)" }}>
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                {row.map((cell, idx) => (
                  <td key={idx} className="px-4 py-3">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

