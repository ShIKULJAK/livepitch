import { Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="grid place-items-center p-10 text-center">
      <Inbox className="mb-3 h-8 w-8" style={{ color: "var(--text-secondary)" }} />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>{description}</p>
    </Card>
  );
}

