import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("flex flex-wrap items-center gap-3 p-4", className)}>
      {children}
    </Card>
  );
}

