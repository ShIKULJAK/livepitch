import { Card } from "@/components/ui/card";

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      {children}
    </Card>
  );
}

