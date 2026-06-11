import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export function SectionCard({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn("min-w-0 p-4 md:p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

