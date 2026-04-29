"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CompetitionStatus, CompetitionType, DominantFoot, DrawRoundType, DrawSourceType, FavoriteTargetType, GoalType, MatchStatus, NotificationType, PlayerStatus, SportType } from "@prisma/client";
import { z } from "zod";
import { createCompetitionSchema } from "@/lib/validation/competition";
import { matchInputSchema, matchUpdateSchema } from "@/lib/validation/match";
import { playerInputSchema } from "@/lib/validation/player";
import { teamInputSchema } from "@/lib/validation/team";

async function safeReadJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

const competitionListResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.nativeEnum(CompetitionType),
      status: z.nativeEnum(CompetitionStatus),
      sport: z.nativeEnum(SportType),
      location: z.string(),
      teamsCount: z.number(),
      matchesCount: z.number(),
      liveMatches: z.number(),
      matchDurationMinutes: z.number(),
      startDate: z.string().datetime().nullable().optional(),
      endDate: z.string().datetime().nullable().optional(),
    })
  ),
});

const competitionDetailsResponse = z.object({
  data: z.object({
    id: z.string(),
    name: z.string(),
    type: z.nativeEnum(CompetitionType),
    sport: z.nativeEnum(SportType),
    status: z.nativeEnum(CompetitionStatus),
    description: z.string().nullable(),
    notes: z.string().nullable(),
    location: z.string().nullable(),
    startDate: z.string().datetime().nullable(),
    endDate: z.string().datetime().nullable(),
    registrationDeadline: z.string().datetime().nullable(),
    teamCount: z.number().nullable(),
    maxTeams: z.number().nullable(),
    teamSize: z.number().nullable(),
    substitutions: z.number().nullable(),
    matchDurationMinutes: z.number(),
    format: z.string().nullable(),
    visibility: z.string().nullable(),
    entryFee: z.union([z.number(), z.string(), z.null()]).nullable(),
    teams: z.array(
      z.object({
        teamId: z.string(),
        team: z.object({
          id: z.string(),
          name: z.string(),
          sport: z.nativeEnum(SportType),
        }),
      })
    ),
  }),
});

const dashboardResponse = z.object({
  data: z.object({
    activeCompetitions: z.number(),
    totalTeams: z.number(),
    matchesToday: z.number(),
    totalPlayers: z.number(),
    liveMatches: z.number(),
  }),
});

const teamsResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      sport: z.nativeEnum(SportType),
      name: z.string(),
      shortName: z.string().nullable(),
      city: z.string().nullable(),
      country: z.string().nullable(),
      coach: z.string().nullable(),
      profileImageUrl: z.string().nullable(),
      competition: z.string().nullable(),
      played: z.number(),
      wins: z.number(),
      draws: z.number(),
      losses: z.number(),
      goalsFor: z.number(),
      goalsAgainst: z.number(),
      points: z.number(),
    })
  ),
});

const playersResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      sport: z.nativeEnum(SportType),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      fullName: z.string(),
      position: z.string(),
      number: z.number().nullable(),
      nationality: z.string().nullable(),
      nationalities: z.array(z.string()),
      placeOfBirth: z.string().nullable(),
      status: z.nativeEnum(PlayerStatus),
      dominantFoot: z.nativeEnum(DominantFoot),
      heightCm: z.number().nullable(),
      weightKg: z.number().nullable(),
      profileImageUrl: z.string().nullable(),
      dateOfBirth: z.string().datetime().nullable(),
      teamId: z.string(),
      team: z.string(),
      teamProfileImageUrl: z.string().nullable(),
      age: z.number().nullable(),
    })
  ),
});

const matchesResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      competitionId: z.string(),
      competition: z.string(),
      competitionType: z.nativeEnum(CompetitionType),
      round: z.string().nullable(),
      scheduledAt: z.string().datetime(),
      status: z.nativeEnum(MatchStatus),
      homeTeamId: z.string(),
      awayTeamId: z.string(),
      homeTeam: z.string(),
      awayTeam: z.string(),
      homeScore: z.number().nullable(),
      awayScore: z.number().nullable(),
      liveMinute: z.number().nullable(),
      regularTimeMinutes: z.number(),
      venue: z.string(),
    })
  ),
});

const matchDetailsResponse = z.object({
  data: z.object({
    id: z.string(),
    competitionId: z.string(),
    competition: z.string(),
    competitionType: z.nativeEnum(CompetitionType),
    round: z.string().nullable(),
    scheduledAt: z.string().datetime(),
    status: z.nativeEnum(MatchStatus),
    venue: z.string(),
    venueId: z.string().nullable(),
    regularTimeMinutes: z.number(),
    competitionMatchDurationMinutes: z.number(),
    homeTeam: z.object({
      id: z.string(),
      name: z.string(),
      score: z.number(),
      players: z.array(z.object({ id: z.string(), fullName: z.string() })),
    }),
    awayTeam: z.object({
      id: z.string(),
      name: z.string(),
      score: z.number(),
      players: z.array(z.object({ id: z.string(), fullName: z.string() })),
    }),
    goalEvents: z.array(
      z.object({
        id: z.string(),
        teamId: z.string(),
        teamName: z.string(),
        playerId: z.string().nullable(),
        scorerName: z.string(),
        minuteBase: z.number(),
        minuteExtra: z.number().nullable(),
        goalType: z.nativeEnum(GoalType),
      })
    ),
    teamStats: z.array(
      z.object({
        teamId: z.string(),
        teamName: z.string(),
        possessionPercent: z.number(),
        possessionSeconds: z.number(),
        totalShots: z.number(),
        shotsOnTarget: z.number(),
        shotsOffTarget: z.number(),
        totalPasses: z.number(),
        accuratePasses: z.number(),
        inaccuratePasses: z.number(),
        corners: z.number(),
        fouls: z.number(),
        yellowCards: z.number(),
        redCards: z.number(),
      })
    ),
  }),
});

const venuesResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      city: z.string(),
      country: z.string(),
      capacity: z.number().nullable(),
      surface: z.string().nullable(),
      status: z.string(),
      dimensions: z.string().nullable(),
      lighting: z.boolean(),
      accessibility: z.string().nullable(),
    })
  ),
});

const standingsResponse = z.object({
  data: z.object({
    competitionId: z.string().nullable(),
    competitionName: z.string().nullable(),
    competitionType: z.nativeEnum(CompetitionType).nullable(),
    rows: z.array(
      z.object({
        position: z.number(),
        team: z.string(),
        played: z.number(),
        wins: z.number(),
        draws: z.number(),
        losses: z.number(),
        goalsFor: z.number(),
        goalsAgainst: z.number(),
        goalDiff: z.number(),
        points: z.number(),
        form: z.string(),
      })
    ),
  }),
});

const usersResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(["ADMIN", "MANAGER", "EDITOR", "VIEWER"]),
      createdAt: z.string(),
    })
  ),
});

const drawCompetitionsResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.nativeEnum(CompetitionType),
      sport: z.nativeEnum(SportType),
      status: z.nativeEnum(CompetitionStatus),
      participantsCount: z.number(),
      participants: z.array(z.object({ id: z.string(), name: z.string() })),
      hasDraw: z.boolean(),
      drawUpdatedAt: z.string().datetime().nullable(),
    })
  ),
});

const competitionDrawResponse = z.object({
  data: z.object({
    competition: z.object({
      id: z.string(),
      name: z.string(),
      type: z.nativeEnum(CompetitionType),
      sport: z.nativeEnum(SportType),
      matchDurationMinutes: z.number(),
      participants: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
    draw: z
      .object({
        id: z.string(),
        competitionId: z.string(),
        groupStageEnabled: z.boolean(),
        groupsCount: z.number(),
        roundOf16Enabled: z.boolean(),
        quarterfinalsEnabled: z.boolean(),
        thirdPlaceMatchEnabled: z.boolean(),
        groups: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            order: z.number(),
            teams: z.array(
              z.object({
                id: z.string(),
                position: z.number().nullable(),
                team: z.object({ id: z.string(), name: z.string() }),
              })
            ),
          })
        ),
        knockoutRounds: z.array(
          z.object({
            id: z.string(),
            roundType: z.nativeEnum(DrawRoundType),
            order: z.number(),
            matches: z.array(
              z.object({
                id: z.string(),
                order: z.number(),
                homeSourceType: z.nativeEnum(DrawSourceType),
                homeSourceValue: z.string(),
                awaySourceType: z.nativeEnum(DrawSourceType),
                awaySourceValue: z.string(),
                homeTeam: z.object({ id: z.string(), name: z.string() }).nullable(),
                awayTeam: z.object({ id: z.string(), name: z.string() }).nullable(),
                winnerTeam: z.object({ id: z.string(), name: z.string() }).nullable(),
              })
            ),
          })
        ),
      })
      .nullable(),
  }),
});

const messagesResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      preview: z.string(),
      updatedAt: z.string(),
      unread: z.number(),
      messages: z.array(
        z.object({
          id: z.string(),
          sender: z.string(),
          content: z.string(),
          timestamp: z.string(),
          mine: z.boolean(),
        })
      ),
    })
  ),
});

const billingResponse = z.object({
  data: z.object({
    name: z.string(),
    priceMonthly: z.number(),
    status: z.string(),
    features: z.array(z.string()),
    usage: z.object({
      tournaments: z.string(),
      teams: z.string(),
      storage: z.string(),
    }),
  }),
});

const favoriteKeysResponse = z.object({
  data: z.array(
    z.object({
      targetType: z.nativeEnum(FavoriteTargetType),
      targetId: z.string(),
    })
  ),
});

const favoritesResponse = z.object({
  data: z.object({
    teams: z.array(z.object({ id: z.string(), name: z.string(), profileImageUrl: z.string().nullable() })),
    matches: z.array(
      z.object({
        id: z.string(),
        competition: z.object({ id: z.string(), name: z.string() }),
        homeTeam: z.object({ id: z.string(), name: z.string() }),
        awayTeam: z.object({ id: z.string(), name: z.string() }),
      })
    ),
    competitions: z.array(z.object({ id: z.string(), name: z.string(), type: z.nativeEnum(CompetitionType) })),
  }),
});

const notificationsResponse = z.object({
  data: z.object({
    unreadCount: z.number(),
    notifications: z.array(
      z.object({
        id: z.string(),
        type: z.nativeEnum(NotificationType),
        title: z.string(),
        body: z.string(),
        link: z.string(),
        isRead: z.boolean(),
        createdAt: z.string().datetime(),
      })
    ),
  }),
});

export function useCompetitions(filters: { q?: string; type?: CompetitionType | "ALL"; status?: CompetitionStatus | "ALL" }) {
  return useQuery({
    queryKey: ["competitions", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.type && filters.type !== "ALL") params.set("type", filters.type);
      if (filters.status && filters.status !== "ALL") params.set("status", filters.status);

      const response = await fetch(`/api/competitions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load competitions");
      const json = await response.json();
      return competitionListResponse.parse(json).data;
    },
  });
}

export function useCreateCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: z.infer<typeof createCompetitionSchema>) => {
      const response = await fetch("/api/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const json = await safeReadJson(response);
      if (!response.ok) {
        throw new Error((json as { error?: string } | null)?.error ?? "Unable to create competition");
      }

      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    },
  });
}

export function useCompetition(id?: string) {
  return useQuery({
    queryKey: ["competition", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await fetch(`/api/competitions/${id}`);
      if (!response.ok) throw new Error("Failed to load competition");
      return competitionDetailsResponse.parse(await response.json()).data;
    },
  });
}

export function useUpdateCompetition(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<z.infer<typeof createCompetitionSchema>>) => {
      const response = await fetch(`/api/competitions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) {
        throw new Error((json as { error?: string } | null)?.error ?? "Unable to update competition");
      }
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition", id] });
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition-draw"] });
    },
  });
}

export function useDeleteCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/competitions/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete competition");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    },
  });
}

export function useDashboardSnapshot() {
  return useQuery({
    queryKey: ["dashboard-snapshot"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) throw new Error("Failed to load dashboard snapshot");
      const json = await response.json();
      return dashboardResponse.parse(json).data;
    },
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) throw new Error("Failed to load teams");
      return teamsResponse.parse(await response.json()).data;
    },
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FormData | z.infer<typeof teamInputSchema>) => {
      const isForm = payload instanceof FormData;
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        body: isForm ? payload : JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Failed to create team");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    },
  });
}

export function useUpdateTeam(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FormData | z.infer<typeof teamInputSchema>) => {
      const isForm = payload instanceof FormData;
      const response = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        body: isForm ? payload : JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to update team");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition-draw"] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      const response = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to delete team");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition-draw"] });
    },
  });
}

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const response = await fetch("/api/players");
      if (!response.ok) throw new Error("Failed to load players");
      return playersResponse.parse(await response.json()).data;
    },
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FormData | z.infer<typeof playerInputSchema>) => {
      const isForm = payload instanceof FormData;
      const response = await fetch("/api/players", {
        method: "POST",
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        body: isForm ? payload : JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Failed to create player");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    },
  });
}

export function useUpdatePlayer(playerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FormData | z.infer<typeof playerInputSchema>) => {
      const isForm = payload instanceof FormData;
      const response = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        body: isForm ? payload : JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to update player");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (playerId: string) => {
      const response = await fetch(`/api/players/${playerId}`, { method: "DELETE" });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to delete player");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function useMatches(filters?: { status?: MatchStatus | "ALL"; competitionId?: string }) {
  return useQuery({
    queryKey: ["matches", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
      if (filters?.competitionId) params.set("competitionId", filters.competitionId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/matches${suffix}`);
      if (!response.ok) throw new Error("Failed to load matches");
      return matchesResponse.parse(await response.json()).data;
    },
  });
}

export function useMatchDetails(matchId?: string) {
  return useQuery({
    queryKey: ["match-details", matchId],
    enabled: Boolean(matchId),
    queryFn: async () => {
      const response = await fetch(`/api/matches/${matchId}/details`);
      if (!response.ok) throw new Error("Failed to load match details");
      return matchDetailsResponse.parse(await response.json()).data;
    },
  });
}

export function useUpdateMatchDetails(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: unknown) => {
      const response = await fetch(`/api/matches/${matchId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Failed to update match details");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["match-details", matchId] });
      queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });
}

export function useResetMatchDetails(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/matches/${matchId}/details`, { method: "DELETE" });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to reset match details");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-details", matchId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: z.infer<typeof matchInputSchema>) => {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to create match");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    },
  });
}

export function useUpdateMatch(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: z.infer<typeof matchUpdateSchema>) => {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to update match");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["match-details", matchId] });
      queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });
}

export function useDeleteMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const response = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to delete match");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });
}

export function useDrawCompetitions() {
  return useQuery({
    queryKey: ["draw-competitions"],
    queryFn: async () => {
      const response = await fetch("/api/draws");
      if (!response.ok) throw new Error("Failed to load draw competitions");
      return drawCompetitionsResponse.parse(await response.json()).data;
    },
  });
}

export function useCompetitionDraw(competitionId?: string) {
  return useQuery({
    queryKey: ["competition-draw", competitionId],
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const response = await fetch(`/api/draws/${competitionId}`);
      if (!response.ok) throw new Error("Failed to load draw");
      return competitionDrawResponse.parse(await response.json()).data;
    },
  });
}

type DrawConfigPayload = {
  groupStageEnabled: boolean;
  groupsCount: number;
  roundOf16Enabled: boolean;
  quarterfinalsEnabled: boolean;
  thirdPlaceMatchEnabled: boolean;
};

export function useGenerateDraw(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DrawConfigPayload) => {
      const response = await fetch(`/api/draws/${competitionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to generate draw");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition-draw", competitionId] });
    },
  });
}

export function useResetDraw(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/draws/${competitionId}`, { method: "DELETE" });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to reset draw");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition-draw", competitionId] });
    },
  });
}

export function useVenues() {
  return useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const response = await fetch("/api/venues");
      if (!response.ok) throw new Error("Failed to load venues");
      return venuesResponse.parse(await response.json()).data;
    },
  });
}

export function useStandings(competitionId?: string) {
  return useQuery({
    queryKey: ["standings", competitionId],
    queryFn: async () => {
      const params = competitionId ? `?competitionId=${competitionId}` : "";
      const response = await fetch(`/api/standings${params}`);
      if (!response.ok) throw new Error("Failed to load standings");
      return standingsResponse.parse(await response.json()).data;
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to load users");
      return usersResponse.parse(await response.json()).data;
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { userId: string; role: "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER" }) => {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Failed to update role");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useMessageThreads() {
  return useQuery({
    queryKey: ["message-threads"],
    queryFn: async () => {
      const response = await fetch("/api/messages");
      if (!response.ok) throw new Error("Failed to load messages");
      return messagesResponse.parse(await response.json()).data;
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { threadId: string; body: string }) => {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Failed to send message");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-threads"] });
    },
  });
}

export function useBillingSnapshot() {
  return useQuery({
    queryKey: ["billing-snapshot"],
    queryFn: async () => {
      const response = await fetch("/api/settings/billing");
      if (!response.ok) throw new Error("Failed to load billing snapshot");
      return billingResponse.parse(await response.json()).data;
    },
  });
}

export function useFavoriteKeys() {
  return useQuery({
    queryKey: ["favorite-keys"],
    queryFn: async () => {
      const response = await fetch("/api/favorites?mode=keys");
      if (!response.ok) throw new Error("Failed to load favorites");
      return favoriteKeysResponse.parse(await response.json()).data;
    },
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const response = await fetch("/api/favorites");
      if (!response.ok) throw new Error("Failed to load favorites");
      return favoritesResponse.parse(await response.json()).data;
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { targetType: FavoriteTargetType; targetId: string }) => {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to toggle favorite");
      return (json as { data: { favorited: boolean } }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-keys"] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Failed to load notifications");
      return notificationsResponse.parse(await response.json()).data;
    },
    refetchInterval: 15000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!response.ok) throw new Error("Failed to mark notification as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) throw new Error("Failed to mark notifications as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
