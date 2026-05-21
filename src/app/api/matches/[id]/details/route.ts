import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canCreateMatches, canEditEntity } from "@/lib/permissions";
import { calculatePossessionPercentages } from "@/lib/constants/match";
import { getMatchDetails, resetMatchDetails, saveMatchDetails } from "@/lib/repositories/matches";
import { matchDetailsUpdateSchema } from "@/lib/validation/match-details";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  const { id } = await params;
  const match = await getMatchDetails(currentUser.organizationId, id);

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  const canEdit = canEditEntity({ id: currentUser.id, role: currentUser.role }, match);

  const homeStats = match.teamStats.find((item) => item.teamId === match.homeTeamId);
  const awayStats = match.teamStats.find((item) => item.teamId === match.awayTeamId);
  const possession = calculatePossessionPercentages(homeStats?.possessionSeconds ?? 0, awayStats?.possessionSeconds ?? 0);

  return NextResponse.json({
    data: {
      id: match.id,
      competitionId: match.competitionId,
      competition: match.competition.name,
      competitionType: match.competition.type,
      round: match.round,
      scheduledAt: match.scheduledAt,
      status: match.status,
      venue: match.venue?.name ?? "TBD",
      venueLabel: match.venueLabel ?? null,
      pitchName: match.pitchName ?? null,
      venueId: match.venueId,
      regularTimeMinutes: match.regularTimeMinutes,
      createdById: match.createdById,
      canEdit,
      competitionMatchDurationMinutes: match.competition.matchDurationMinutes,
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        score: match.homeScore ?? 0,
        players: match.homeTeam.players,
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        score: match.awayScore ?? 0,
        players: match.awayTeam.players,
      },
      goalEvents: match.goalEvents.map((event) => ({
        id: event.id,
        teamId: event.teamId,
        teamName: event.team.name,
        playerId: event.playerId,
        scorerName: event.player?.fullName ?? event.scorerName ?? "Unknown scorer",
        minuteBase: event.minuteBase,
        minuteExtra: event.minuteExtra,
        goalType: event.goalType,
      })),
      teamStats: [
        {
          teamId: match.homeTeamId,
          teamName: match.homeTeam.name,
          possessionPercent: possession.home,
          possessionSeconds: homeStats?.possessionSeconds ?? 0,
          totalShots: homeStats?.totalShots ?? 0,
          shotsOnTarget: homeStats?.shotsOnTarget ?? 0,
          shotsOffTarget: homeStats?.shotsOffTarget ?? 0,
          totalPasses: homeStats?.totalPasses ?? 0,
          accuratePasses: homeStats?.accuratePasses ?? 0,
          inaccuratePasses: homeStats?.inaccuratePasses ?? 0,
          corners: homeStats?.corners ?? 0,
          fouls: homeStats?.fouls ?? 0,
          yellowCards: homeStats?.yellowCards ?? 0,
          redCards: homeStats?.redCards ?? 0,
        },
        {
          teamId: match.awayTeamId,
          teamName: match.awayTeam.name,
          possessionPercent: possession.away,
          possessionSeconds: awayStats?.possessionSeconds ?? 0,
          totalShots: awayStats?.totalShots ?? 0,
          shotsOnTarget: awayStats?.shotsOnTarget ?? 0,
          shotsOffTarget: awayStats?.shotsOffTarget ?? 0,
          totalPasses: awayStats?.totalPasses ?? 0,
          accuratePasses: awayStats?.accuratePasses ?? 0,
          inaccuratePasses: awayStats?.inaccuratePasses ?? 0,
          corners: awayStats?.corners ?? 0,
          fouls: awayStats?.fouls ?? 0,
          yellowCards: awayStats?.yellowCards ?? 0,
          redCards: awayStats?.redCards ?? 0,
        },
      ],
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canCreateMatches(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = matchDetailsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;

  try {
    const data = await saveMatchDetails(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id, parsed.data);
    if (!data) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update match details" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();

  if (!canCreateMatches(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let data = null;
  try {
    data = await resetMatchDetails(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, id);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
