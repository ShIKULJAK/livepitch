import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide", {
  variants: {
    variant: {
      live: "bg-red-500/20 text-red-300",
      upcoming: "bg-blue-500/20 text-blue-300",
      completed: "bg-slate-500/20 text-slate-200",
      ongoing: "bg-lime-400/20 text-lime-300",
      active: "bg-emerald-500/20 text-emerald-300",
      inactive: "bg-zinc-500/20 text-zinc-300",
      draft: "bg-yellow-500/20 text-yellow-300",
    },
  },
  defaultVariants: {
    variant: "active",
  },
});

export function Badge({ className, variant, children }: React.PropsWithChildren<VariantProps<typeof badgeVariants> & { className?: string }>) {
  return (
    <span
      className={cn(
        badgeVariants({ variant }),
        variant === "live" && "lp-status-fade-live",
        variant === "upcoming" && "lp-status-fade-upcoming",
        variant === "completed" && "lp-status-fade-completed",
        variant === "inactive" && "lp-status-fade-inactive",
        className
      )}
    >
      {children}
    </span>
  );
}

