import { Card } from "@/components/ui/card";

export function LoadingSkeleton() {
  return (
    <Card className="space-y-3 p-5">
      <div className="h-6 w-56 animate-pulse rounded-lg" style={{ backgroundColor: "var(--surface-2)" }} />
      <div className="h-4 w-full animate-pulse rounded" style={{ backgroundColor: "var(--surface-2)" }} />
      <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: "var(--surface-2)" }} />
    </Card>
  );
}

