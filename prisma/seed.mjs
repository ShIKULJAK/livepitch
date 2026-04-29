import "dotenv/config";
import { PrismaClient, CompetitionType, CompetitionStatus, MatchStatus, SportType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser({ email, name, role, organizationId, passwordHash }) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, organizationId, passwordHash, locale: "bs" },
    create: { email, name, role, organizationId, passwordHash, locale: "bs" },
  });
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "org_live_pitch_seed" },
    update: {},
    create: {
      id: "org_live_pitch_seed",
      name: "FC Champion",
      city: "Belgrade",
      country: "Serbia",
      website: "www.fcchampion.com",
      plan: "Pro",
    },
  });

  const venues = await Promise.all([
    prisma.venue.upsert({
      where: { id: "venue_stadion_park" },
      update: {},
      create: {
        id: "venue_stadion_park",
        name: "Stadion Park",
        city: "Belgrade",
        country: "Serbia",
        capacity: 12500,
        surface: "Natural Grass",
        status: "active",
        dimensions: "105m x 68m",
        lighting: true,
        accessibility: "Wheelchair Accessible",
        organizationId: organization.id,
      },
    }),
    prisma.venue.upsert({
      where: { id: "venue_city_arena" },
      update: {},
      create: {
        id: "venue_city_arena",
        name: "City Arena",
        city: "Novi Sad",
        country: "Serbia",
        capacity: 8200,
        surface: "Natural Grass",
        status: "active",
        dimensions: "105m x 66m",
        lighting: true,
        accessibility: "Standard",
        organizationId: organization.id,
      },
    }),
  ]);

  const teamsData = [
    { id: "team_fc_guardian", name: "FC Guardian", coach: "Milan Petrovic", city: "Belgrade", country: "Serbia" },
    { id: "team_red_devils", name: "Red Devils", coach: "Stefan Dragan", city: "Novi Sad", country: "Serbia" },
    { id: "team_blue_city", name: "Blue City", coach: "Andrej Kovacevic", city: "Belgrade", country: "Serbia" },
    { id: "team_balkans_united", name: "Balkans United", coach: "Nikola Savic", city: "Belgrade", country: "Serbia" },
  ];

  const teams = [];
  for (const team of teamsData) {
    teams.push(
      await prisma.team.upsert({
        where: { id: team.id },
        update: {},
        create: {
          ...team,
          organizationId: organization.id,
        },
      })
    );
  }

  const playersData = [
    { id: "player_marko", fullName: "Marko Jovanovic", position: "FW", number: 10, nationality: "Serbia", teamId: teams[0].id },
    { id: "player_luka", fullName: "Luka Petrovic", position: "FW", number: 9, nationality: "Serbia", teamId: teams[0].id },
    { id: "player_stefan", fullName: "Stefan Milicevic", position: "MF", number: 8, nationality: "Montenegro", teamId: teams[1].id },
    { id: "player_nikola", fullName: "Nikola Ilic", position: "MF", number: 7, nationality: "Serbia", teamId: teams[2].id },
  ];

  for (const player of playersData) {
    await prisma.player.upsert({
      where: { id: player.id },
      update: {},
      create: player,
    });
  }

  const competition = await prisma.competition.upsert({
    where: { id: "comp_first_league" },
    update: {},
    create: {
      id: "comp_first_league",
      name: "First League",
      type: CompetitionType.LEAGUE,
      sport: SportType.FOOTBALL,
      status: CompetitionStatus.ONGOING,
      description: "Main city competition",
      location: "Belgrade, Serbia",
      format: "Round Robin",
      teamCount: 4,
      maxTeams: 12,
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-07-15T00:00:00.000Z"),
      organizationId: organization.id,
      venueId: venues[0].id,
    },
  });

  for (const [index, team] of teams.entries()) {
    await prisma.competitionTeam.upsert({
      where: { competitionId_teamId: { competitionId: competition.id, teamId: team.id } },
      update: {},
      create: {
        competitionId: competition.id,
        teamId: team.id,
        seed: index + 1,
      },
    });

    await prisma.standing.upsert({
      where: { competitionId_teamId: { competitionId: competition.id, teamId: team.id } },
      update: {},
      create: {
        competitionId: competition.id,
        teamId: team.id,
        played: 3,
        wins: Math.max(0, 3 - index),
        draws: index === 1 ? 1 : 0,
        losses: index > 1 ? 1 : 0,
        goalsFor: 8 - index,
        goalsAgainst: 3 + index,
        points: 9 - index,
        form: "WWDWL",
      },
    });
  }

  await prisma.match.upsert({
    where: { id: "match_live_guardian_balkans" },
    update: {},
    create: {
      id: "match_live_guardian_balkans",
      competitionId: competition.id,
      homeTeamId: teams[0].id,
      awayTeamId: teams[3].id,
      venueId: venues[0].id,
      round: "Round 12",
      scheduledAt: new Date(),
      status: MatchStatus.LIVE,
      homeScore: 2,
      awayScore: 1,
      liveMinute: 78,
    },
  });

  await prisma.match.upsert({
    where: { id: "match_upcoming_red_blue" },
    update: {},
    create: {
      id: "match_upcoming_red_blue",
      competitionId: competition.id,
      homeTeamId: teams[1].id,
      awayTeamId: teams[2].id,
      venueId: venues[1].id,
      round: "Round 12",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: MatchStatus.SCHEDULED,
    },
  });

  const passwordHash = await hash("LivePitch!2026", 12);

  const users = await Promise.all([
    upsertUser({ email: "admin@livepitch.app", name: "Admin User", role: "ADMIN", organizationId: organization.id, passwordHash }),
    upsertUser({ email: "manager@livepitch.app", name: "Manager User", role: "MANAGER", organizationId: organization.id, passwordHash }),
    upsertUser({ email: "editor@livepitch.app", name: "Editor User", role: "EDITOR", organizationId: organization.id, passwordHash }),
    upsertUser({ email: "viewer@livepitch.app", name: "Viewer User", role: "VIEWER", organizationId: organization.id, passwordHash }),
  ]);

  const thread = await prisma.messageThread.upsert({
    where: { id: "thread_fc_guardian" },
    update: { subject: "FC Guardian" },
    create: { id: "thread_fc_guardian", subject: "FC Guardian" },
  });

  const messageCount = await prisma.message.count({ where: { threadId: thread.id } });
  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        {
          id: "msg_seed_1",
          threadId: thread.id,
          senderId: users[1].id,
          body: "Hello! We would like to confirm our match against Red Devils this Saturday.",
        },
        {
          id: "msg_seed_2",
          threadId: thread.id,
          senderId: users[0].id,
          body: "Yes, the match is confirmed. Kick-off is at 16:00 at Stadion Park.",
        },
      ],
    });
  }

  console.log("Seed complete");
  console.log("Demo users: admin@livepitch.app, manager@livepitch.app, editor@livepitch.app, viewer@livepitch.app");
  console.log("Demo password: LivePitch!2026");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

