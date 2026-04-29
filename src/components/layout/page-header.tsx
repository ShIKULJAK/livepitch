import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <Card className={cn("flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between", className)}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{description}</p> : null}
      </div>
      <div className="flex w-full items-center gap-3 md:w-auto">
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
          <Input className="pl-9" placeholder="Search..." />
        </div>
        {actions}
      </div>
    </Card>
  );
}

