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
      createdById: z.string().nullable().optional(),
      name: z.string(),
      type: z.nativeEnum(CompetitionType),
      status: z.nativeEnum(CompetitionStatus),
      sport: z.nativeEnum(SportType),
      location: z.string(),
      teamsCount: z.number(),
      matchesCount: z.number(),
      liveMatches: z.number(),
      matchDurationMinutes: z.number(),
      generationMatchDurations: z
        .array(
          z.object({
            generationLabel: z.string(),
            matchDurationMinutes: z.number(),
          })
        )
        .optional(),
      stadiumName: z.string().nullable().optional(),
      pitchNames: z.array(z.string()).optional(),
      scheduleDays: z
        .array(
          z.object({
            dayLabel: z.string(),
            dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            generationLabel: z.string().optional(),
            stageScope: z.enum(["ALL", "GROUP_STAGE", "KNOCKOUT"]).optional(),
            pitchId: z.string().nullable().optional(),
            startTime: z.string(),
            endTime: z.string(),
          })
        )
        .nullable()
        .optional(),
      seasonId: z.string().nullable().optional(),
      seasonLabel: z.string().nullable().optional(),
      startDate: z.string().datetime().nullable().optional(),
      endDate: z.string().datetime().nullable().optional(),
    })
  ),
});

const competitionDetailsResponse = z.object({
  data: z.object({
    id: z.string(),
    createdById: z.string().nullable().optional(),
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
    generationMatchDurations: z
      .array(
        z.object({
          generationLabel: z.string(),
          matchDurationMinutes: z.number(),
        })
      )
      .optional(),
    stadiumName: z.string().nullable().optional(),
    pitchNames: z.array(z.string()).optional(),
    scheduleDays: z
      .array(
        z.object({
          dayLabel: z.string(),
          dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          generationLabel: z.string().optional(),
          stageScope: z.enum(["ALL", "GROUP_STAGE", "KNOCKOUT"]).optional(),
          pitchId: z.string().nullable().optional(),
          startTime: z.string(),
          endTime: z.string(),
        })
      )
      .nullable()
      .optional(),
    seasonId: z.string().nullable(),
    season: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
    seasonOptions: z
      .array(
        z.object({
          competitionId: z.string(),
          seasonId: z.string().nullable(),
          seasonLabel: z.string().nullable(),
        })
      )
      .optional(),
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
    canEdit: z.boolean().optional(),
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
      createdById: z.string().nullable().optional(),
      sport: z.nativeEnum(SportType),
      name: z.string(),
      shortName: z.string().nullable(),
      place: z.string().nullable(),
      city: z.string().nullable(),
      country: z.string().nullable(),
      coach: z.string().nullable(),
      homeVenueId: z.string().nullable().optional(),
      homeVenueName: z.string().nullable().optional(),
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
      createdById: z.string().nullable().optional(),
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
      bio: z.string().nullable().optional(),
      radarDefending: z.number().nullable().optional(),
      radarPhysical: z.number().nullable().optional(),
      radarSpeed: z.number().nullable().optional(),
      radarPassing: z.number().nullable().optional(),
      radarGameIQ: z.number().nullable().optional(),
      achievements: z.array(z.string()).optional(),
      strengths: z.array(z.string()).optional(),
      improvements: z.array(z.string()).optional(),
      coachNote: z.string().nullable().optional(),
      dateOfBirth: z.string().datetime().nullable(),
      teamId: z.string(),
      team: z.string(),
      teamProfileImageUrl: z.string().nullable(),
      goals: z.number().optional(),
      assists: z.number().optional(),
      clubHistory: z
        .array(
          z.object({
            id: z.string(),
            teamId: z.string(),
            teamName: z.string(),
            fromYear: z.number(),
            toYear: z.number().nullable(),
          })
        )
        .optional(),
      age: z.number().nullable(),
    })
  ),
});

const matchesResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      createdById: z.string().nullable().optional(),
      competitionId: z.string(),
      competition: z.string(),
      competitionType: z.nativeEnum(CompetitionType),
      generationYear: z.number().nullable().optional(),
      seasonId: z.string().nullable().optional(),
      seasonLabel: z.string().nullable().optional(),
      round: z.string().nullable(),
      phase: z.string(),
      scheduledAt: z.string().datetime(),
      status: z.nativeEnum(MatchStatus),
      homeTeamId: z.string(),
      awayTeamId: z.string(),
      homeTeam: z.string(),
      homeTeamProfileImageUrl: z.string().nullable().optional(),
      awayTeam: z.string(),
      awayTeamProfileImageUrl: z.string().nullable().optional(),
      homeScore: z.number().nullable(),
      awayScore: z.number().nullable(),
      liveMinute: z.number().nullable(),
      regularTimeMinutes: z.number(),
      venue: z.string(),
      venueLabel: z.string().nullable().optional(),
      pitchName: z.string().nullable().optional(),
      isVirtualKnockout: z.boolean().optional(),
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
    phase: z.string(),
    scheduledAt: z.string().datetime(),
    status: z.nativeEnum(MatchStatus),
    venue: z.string(),
    venueLabel: z.string().nullable().optional(),
    pitchName: z.string().nullable().optional(),
    venueId: z.string().nullable(),
    regularTimeMinutes: z.number(),
    createdById: z.string().nullable().optional(),
    canEdit: z.boolean().optional(),
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
      createdById: z.string().nullable().optional(),
      name: z.string(),
      city: z.string(),
      country: z.string(),
      capacity: z.number().nullable(),
      surface: z.string().nullable(),
      status: z.string(),
      dimensions: z.string().nullable(),
      lighting: z.boolean(),
      accessibility: z.string().nullable(),
      teamId: z.string().nullable().optional(),
      team: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
      pitches: z.array(
        z.object({
          id: z.string(),
          venueId: z.string().nullable(),
          name: z.string(),
          surface: z.string().nullable(),
          generationLabel: z.string().nullable(),
          ageGroupCode: z.string().nullable(),
          playerFormat: z.string(),
          fieldLengthMeters: z.number(),
          fieldWidthMeters: z.number(),
          goalWidthMeters: z.number().nullable(),
          goalHeightMeters: z.number().nullable(),
          isActive: z.boolean(),
        })
      ),
    })
  ),
});

const standingsResponse = z.object({
  data: z.object({
    competitions: z.array(
      z.object({
        competitionId: z.string(),
        competitionName: z.string(),
        seasonLabel: z.string().nullable().optional(),
        competitionType: z.nativeEnum(CompetitionType),
        generations: z.array(
          z.object({
            generationYear: z.number().nullable(),
            generationLabel: z.string(),
            groups: z.array(
              z.object({
                groupId: z.string(),
                groupLabel: z.string(),
                rows: z.array(
                  z.object({
                    position: z.number(),
                    teamId: z.string(),
                    team: z.string(),
                    profileImageUrl: z.string().nullable(),
                    played: z.number(),
                    wins: z.number(),
                    draws: z.number(),
                    losses: z.number(),
                    goalsFor: z.number(),
                    goalsAgainst: z.number(),
                    goalDiff: z.number(),
                    points: z.number(),
                    form: z.array(z.enum(["W", "D", "L"])),
                  })
                ),
              })
            ),
          })
        ),
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
      seasonId: z.string().nullable().optional(),
      seasonLabel: z.string().nullable().optional(),
      sport: z.nativeEnum(SportType),
      status: z.nativeEnum(CompetitionStatus),
      participantsCount: z.number(),
      participants: z.array(z.object({ id: z.string(), name: z.string() })),
      generationYears: z.array(z.number()).optional(),
      hasDraw: z.boolean(),
      drawUpdatedAt: z.string().datetime().nullable(),
    })
  ),
});

const competitionDrawResponse = z.object({
  data: z.object({
    competition: z.object({
      id: z.string(),
      createdById: z.string().nullable().optional(),
      name: z.string(),
      type: z.nativeEnum(CompetitionType),
      sport: z.nativeEnum(SportType),
      seasonId: z.string().nullable().optional(),
      seasonLabel: z.string().nullable().optional(),
      matchDurationMinutes: z.number(),
      availableGenerationYears: z.array(z.number()).optional(),
      selectedGenerationYear: z.number().nullable().optional(),
      participants: z.array(z.object({ id: z.string(), name: z.string(), profileImageUrl: z.string().nullable().optional() })),
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
                team: z.object({ id: z.string(), name: z.string(), profileImageUrl: z.string().nullable().optional() }),
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
                homeTeam: z.object({ id: z.string(), name: z.string(), profileImageUrl: z.string().nullable().optional() }).nullable(),
                awayTeam: z.object({ id: z.string(), name: z.string(), profileImageUrl: z.string().nullable().optional() }).nullable(),
                winnerTeam: z.object({ id: z.string(), name: z.string(), profileImageUrl: z.string().nullable().optional() }).nullable(),
                scheduledAt: z.string().datetime().nullable().optional(),
                pitchName: z.string().nullable().optional(),
                venueLabel: z.string().nullable().optional(),
              })
            ),
          })
        ),
        groupMatches: z.array(
          z.object({
            id: z.string(),
            round: z.string().nullable(),
            scheduledAt: z.string().datetime(),
            venueLabel: z.string().nullable(),
            pitchName: z.string().nullable(),
            generationYear: z.number().nullable().optional(),
            homeTeam: z.object({ id: z.string(), name: z.string(), profileImageUrl: z.string().nullable().optional() }),
            awayTeam: z.object({ id: z.string(), name: z.string(), profileImageUrl: z.string().nullable().optional() }),
          })
        ),
      })
      .nullable(),
    canManage: z.boolean().optional(),
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

const teamApplicationCompetitionListResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.nativeEnum(CompetitionType),
      status: z.nativeEnum(CompetitionStatus),
      seasonLabel: z.string().nullable(),
      sport: z.nativeEnum(SportType),
      startDate: z.string().datetime().nullable(),
      endDate: z.string().datetime().nullable(),
      seasonOptions: z.array(
        z.object({
          competitionId: z.string(),
          seasonId: z.string().nullable(),
          seasonLabel: z.string().nullable(),
        })
      ),
    })
  ),
});

const teamApplicationsResponse = z.object({
  data: z.object({
    competitionId: z.string(),
    seasonOptions: z.array(
      z.object({
        competitionId: z.string(),
        seasonId: z.string().nullable(),
        seasonLabel: z.string().nullable(),
      })
    ),
    defaultSeasonCompetitionId: z.string(),
    applications: z.array(
      z.object({
        id: z.string(),
        competitionId: z.string(),
        competitionName: z.string(),
        seasonLabel: z.string().nullable(),
        teamName: z.string(),
        place: z.string(),
        submittedAt: z.string().datetime(),
        submittedDate: z.string().datetime(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
        generations: z.array(
          z.object({
            generationYear: z.number(),
            isRequested: z.boolean(),
            isApproved: z.boolean().nullable(),
          })
        ),
      })
    ),
  }),
});

const competitionGenerationParticipantsResponse = z.object({
  data: z.object({
    competitionId: z.string(),
    participants: z.array(
      z.object({
        teamId: z.string(),
        teamName: z.string(),
        generationYears: z.array(z.number()),
      })
    ),
  }),
});

export function useCompetitions(filters: { q?: string; type?: CompetitionType | "ALL"; status?: CompetitionStatus | "ALL"; season?: string }) {
  return useQuery({
    queryKey: ["competitions", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.type && filters.type !== "ALL") params.set("type", filters.type);
      if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
      if (filters.season) params.set("seasonYear", filters.season);

      const response = await fetch(`/api/competitions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load competitions");
      const json = await response.json();
      return competitionListResponse.parse(json).data;
    },
  });
}

const competitionSeasonsResponse = z.object({
  data: z.object({
    defaultSeasonYear: z.string().nullable(),
    years: z.array(
      z.object({
        year: z.string(),
        isActive: z.boolean(),
        competitionsCount: z.number(),
      })
    ),
    seasons: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        startDate: z.string().datetime().nullable(),
        endDate: z.string().datetime().nullable(),
        competitionsCount: z.number(),
        isActive: z.boolean(),
      })
    ),
  }),
});

export function useCompetitionSeasons() {
  return useQuery({
    queryKey: ["competition-seasons"],
    queryFn: async () => {
      const response = await fetch("/api/competitions/seasons");
      if (!response.ok) throw new Error("Failed to load competition seasons");
      return competitionSeasonsResponse.parse(await response.json()).data;
    },
  });
}

const seasonSquadsResponse = z.object({
  data: z.object({
    competitionId: z.string(),
    competitionName: z.string(),
    seasonLabel: z.string().nullable(),
    teams: z.array(
      z.object({
        teamId: z.string(),
        teamName: z.string(),
        players: z.array(z.object({ id: z.string(), fullName: z.string() })),
        registeredPlayerIds: z.array(z.string()),
      })
    ),
  }),
});

export function useSeasonSquads(competitionId?: string) {
  return useQuery({
    queryKey: ["season-squads", competitionId],
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const response = await fetch(`/api/competitions/${competitionId}/season-squads`);
      if (!response.ok) throw new Error("Failed to load season squads");
      return seasonSquadsResponse.parse(await response.json()).data;
    },
  });
}

export function useUpdateSeasonSquad(competitionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { teamId: string; playerIds: string[] }) => {
      const response = await fetch(`/api/competitions/${competitionId}/season-squads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to save season squad");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-squads", competitionId] });
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
        const payload = json as { error?: string; issues?: Array<{ path?: Array<string | number>; message?: string }> } | null;
        const issues = payload?.issues ?? [];
        const issueMessage = issues.length
          ? issues
              .map((issue) => `${(issue.path ?? []).join(".") || "field"}: ${issue.message ?? "Invalid value"}`)
              .join(" | ")
          : null;
        throw new Error(issueMessage ?? payload?.error ?? "Unable to create competition");
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
      queryClient.invalidateQueries({ queryKey: ["competition-draw"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
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
      queryClient.invalidateQueries({ queryKey: ["competition-draw"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
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
      queryClient.invalidateQueries({ queryKey: ["competition-draw"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
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

export function useDrawCompetitions(seasonYear?: string) {
  return useQuery({
    queryKey: ["draw-competitions", seasonYear ?? "ALL"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (seasonYear) params.set("seasonYear", seasonYear);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/draws${suffix}`);
      if (!response.ok) throw new Error("Failed to load draw competitions");
      return drawCompetitionsResponse.parse(await response.json()).data;
    },
  });
}

export function useCompetitionDraw(competitionId?: string, generationYear?: number | null) {
  return useQuery({
    queryKey: ["competition-draw", competitionId, generationYear ?? "auto"],
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const suffix = generationYear ? `?generationYear=${generationYear}` : "";
      const response = await fetch(`/api/draws/${competitionId}${suffix}`);
      if (!response.ok) throw new Error("Failed to load draw");
      return competitionDrawResponse.parse(await response.json()).data;
    },
  });
}

type DrawConfigPayload = {
  generationYear?: number;
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
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function useResetDraw(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload?: { generationYear?: number; resetSchedule?: boolean }) => {
      const params = new URLSearchParams();
      if (payload?.generationYear) params.set("generationYear", String(payload.generationYear));
      if (payload?.resetSchedule) params.set("resetSchedule", "1");
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/draws/${competitionId}${suffix}`, { method: "DELETE" });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to reset draw");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["draw-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition-draw", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function useSwapDrawTeams(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { generationYear: number; firstTeamId: string; secondTeamId: string }) => {
      const response = await fetch(`/api/draws/${competitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "swapTeams", ...payload }),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to swap draw teams");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competition-draw", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["match-details"] });
    },
  });
}

export function useSwapDrawPitches(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { generationYear: number; firstPitchName: string; secondPitchName: string }) => {
      const response = await fetch(`/api/draws/${competitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "swapPitches", ...payload }),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to swap draw pitches");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competition-draw", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["match-details"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
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

export function useCreatePitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      venueId?: string | null;
      name: string;
      surface?: string | null;
      generationLabel?: string | null;
      ageGroupCode?: string | null;
      playerFormat: string;
      fieldLengthMeters: number;
      fieldWidthMeters: number;
      goalWidthMeters?: number | null;
      goalHeightMeters?: number | null;
      isActive?: boolean;
    }) => {
      const response = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to create pitch");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["venues"] }),
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      city?: string | null;
      country?: string | null;
      capacity?: number | null;
      surface?: string | null;
      dimensions?: string | null;
      lighting?: boolean;
      accessibility?: string | null;
      teamId?: string | null;
    }) => {
      const response = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "venue", ...payload }),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to create venue");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["venues"] }),
  });
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      name?: string;
      city?: string | null;
      country?: string | null;
      capacity?: number | null;
      surface?: string | null;
      dimensions?: string | null;
      lighting?: boolean;
      accessibility?: string | null;
      teamId?: string | null;
    }) => {
      const response = await fetch("/api/venues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "venue", ...payload }),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to update venue");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["venues"] }),
  });
}

export function useDeleteVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (venueId: string) => {
      const response = await fetch(`/api/venues?kind=venue&id=${venueId}`, { method: "DELETE" });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to delete venue");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["venues"] }),
  });
}

export function useUpdatePitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      venueId?: string | null;
      name?: string;
      surface?: string | null;
      generationLabel?: string | null;
      ageGroupCode?: string | null;
      playerFormat?: string;
      fieldLengthMeters?: number;
      fieldWidthMeters?: number;
      goalWidthMeters?: number | null;
      goalHeightMeters?: number | null;
      isActive?: boolean;
    }) => {
      const response = await fetch("/api/venues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to update pitch");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["venues"] }),
  });
}

export function useDeletePitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pitchId: string) => {
      const response = await fetch(`/api/venues?id=${pitchId}`, { method: "DELETE" });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to delete pitch");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["venues"] }),
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

export function useApplicableCompetitions(filters?: { q?: string; type?: CompetitionType | "ALL"; sport?: SportType | "ALL" }) {
  return useQuery({
    queryKey: ["applicable-competitions", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.q) params.set("q", filters.q);
      if (filters?.type && filters.type !== "ALL") params.set("type", filters.type);
      if (filters?.sport && filters.sport !== "ALL") params.set("sport", filters.sport);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/team-applications${suffix}`);
      if (!response.ok) throw new Error("Failed to load applicable competitions");
      return teamApplicationCompetitionListResponse.parse(await response.json()).data;
    },
  });
}

export function useSubmitTeamApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      competitionId: string;
      teamId?: string | null;
      teamName: string;
      generationYears: number[];
      players: Array<{ generationYear: number; birthYear: number; jerseyNumber: number; fullName: string }>;
      coaches: Array<{ fullName: string; phone: string; email?: string }>;
      place: string;
      submittedDate: string;
    }) => {
      const response = await fetch("/api/team-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to submit team application");
      return (json as { data: unknown }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-applications"] });
    },
  });
}

export function useTeamApplications(competitionId?: string) {
  return useQuery({
    queryKey: ["team-applications", competitionId],
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const response = await fetch(`/api/team-applications?competitionId=${competitionId}`);
      if (!response.ok) throw new Error("Failed to load team applications");
      return teamApplicationsResponse.parse(await response.json()).data;
    },
  });
}

export function useApproveTeamApplication(competitionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { applicationId: string; approvedGenerationYears: number[] }) => {
      const response = await fetch(`/api/team-applications/approve?competitionId=${competitionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to approve application");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-applications", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["competition-generation-participants", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition-draw", competitionId] });
    },
  });
}

export function useRejectTeamApplication(competitionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { applicationId: string }) => {
      const response = await fetch(`/api/team-applications/reject?competitionId=${competitionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeReadJson(response);
      if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "Failed to reject application");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-applications", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["competition-generation-participants", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition-draw", competitionId] });
    },
  });
}

export function useCompetitionGenerationParticipants(competitionId?: string) {
  return useQuery({
    queryKey: ["competition-generation-participants", competitionId],
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const response = await fetch(`/api/team-applications?mode=participants&competitionId=${competitionId}`);
      if (!response.ok) throw new Error("Failed to load generation participants");
      return competitionGenerationParticipantsResponse.parse(await response.json()).data;
    },
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

