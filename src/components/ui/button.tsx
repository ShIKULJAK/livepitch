import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-transparent text-black hover:brightness-95",
        secondary: "hover:border-[color:var(--primary)]",
        ghost: "border-transparent hover:bg-[color:var(--surface-2)]",
        danger: "border-[color:var(--danger)] text-[color:var(--danger)] hover:bg-[color:color-mix(in srgb,var(--danger) 14%, transparent)]",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      style={variant === "primary" ? { backgroundColor: "var(--primary)" } : { backgroundColor: "transparent", borderColor: "var(--border)" }}
      {...props}
    />
  );
}

