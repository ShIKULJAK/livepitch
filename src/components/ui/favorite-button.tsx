"use client";

import { Star } from "lucide-react";
import { FavoriteTargetType } from "@prisma/client";
import { cn } from "@/lib/utils/cn";
import { useFavoriteKeys, useToggleFavorite } from "@/hooks/use-competitions";

type FavoriteButtonProps = {
  targetType: FavoriteTargetType;
  targetId: string;
  className?: string;
};

export function FavoriteButton({ targetType, targetId, className }: FavoriteButtonProps) {
  const favoriteKeysQuery = useFavoriteKeys();
  const toggleFavorite = useToggleFavorite();

  const favorited = (favoriteKeysQuery.data ?? []).some((item) => item.targetType === targetType && item.targetId === targetId);
  return (
    <button
      type="button"
      className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg border transition", className)}
      style={{
        borderColor: favorited ? "color-mix(in srgb, var(--warning) 50%, var(--border))" : "var(--border)",
        color: favorited ? "var(--warning)" : "var(--text-secondary)",
        backgroundColor: favorited ? "color-mix(in srgb, var(--warning) 10%, transparent)" : "transparent",
      }}
      onClick={() =>
        toggleFavorite.mutate(
          { targetType, targetId },
          {
            onError: (error) => {
              const message = error instanceof Error ? error.message : "Failed to update favorites.";
              const friendly =
                message.includes("not initialized") || message.includes("503")
                  ? "Favorites još nisu dostupni. Potrebno je pokrenuti migraciju baze za favorites."
                  : message;
              window.alert(friendly);
            },
          }
        )
      }
      disabled={toggleFavorite.isPending || favoriteKeysQuery.isLoading}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Star className="h-4 w-4" fill={favorited ? "currentColor" : "none"} />
    </button>
  );
}
