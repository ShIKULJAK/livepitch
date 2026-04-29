DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DrawRoundType') THEN
    CREATE TYPE "public"."DrawRoundType" AS ENUM ('ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL', 'THIRD_PLACE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DrawSourceType') THEN
    CREATE TYPE "public"."DrawSourceType" AS ENUM ('GROUP_WINNER', 'GROUP_RUNNER_UP', 'MATCH_WINNER', 'DIRECT_TEAM');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."Draw" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "groupStageEnabled" BOOLEAN NOT NULL DEFAULT true,
  "groupsCount" INTEGER NOT NULL DEFAULT 4,
  "roundOf16Enabled" BOOLEAN NOT NULL DEFAULT false,
  "quarterfinalsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "thirdPlaceMatchEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."DrawGroup" (
  "id" TEXT NOT NULL,
  "drawId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  CONSTRAINT "DrawGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."DrawGroupTeam" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "position" INTEGER,
  CONSTRAINT "DrawGroupTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."DrawKnockoutRound" (
  "id" TEXT NOT NULL,
  "drawId" TEXT NOT NULL,
  "roundType" "public"."DrawRoundType" NOT NULL,
  "order" INTEGER NOT NULL,
  CONSTRAINT "DrawKnockoutRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."DrawKnockoutMatch" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "homeSourceType" "public"."DrawSourceType" NOT NULL,
  "homeSourceValue" TEXT NOT NULL,
  "awaySourceType" "public"."DrawSourceType" NOT NULL,
  "awaySourceValue" TEXT NOT NULL,
  "homeTeamId" TEXT,
  "awayTeamId" TEXT,
  "winnerTeamId" TEXT,
  "order" INTEGER NOT NULL,
  CONSTRAINT "DrawKnockoutMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Draw_competitionId_key" ON "public"."Draw" ("competitionId");
CREATE UNIQUE INDEX IF NOT EXISTS "DrawGroup_drawId_name_key" ON "public"."DrawGroup" ("drawId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "DrawGroupTeam_groupId_teamId_key" ON "public"."DrawGroupTeam" ("groupId", "teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "DrawKnockoutRound_drawId_roundType_key" ON "public"."DrawKnockoutRound" ("drawId", "roundType");
CREATE INDEX IF NOT EXISTS "DrawKnockoutMatch_roundId_order_idx" ON "public"."DrawKnockoutMatch" ("roundId", "order");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Draw_competitionId_fkey') THEN
    ALTER TABLE "public"."Draw"
      ADD CONSTRAINT "Draw_competitionId_fkey"
      FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DrawGroup_drawId_fkey') THEN
    ALTER TABLE "public"."DrawGroup"
      ADD CONSTRAINT "DrawGroup_drawId_fkey"
      FOREIGN KEY ("drawId") REFERENCES "public"."Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DrawGroupTeam_groupId_fkey') THEN
    ALTER TABLE "public"."DrawGroupTeam"
      ADD CONSTRAINT "DrawGroupTeam_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "public"."DrawGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DrawGroupTeam_teamId_fkey') THEN
    ALTER TABLE "public"."DrawGroupTeam"
      ADD CONSTRAINT "DrawGroupTeam_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DrawKnockoutRound_drawId_fkey') THEN
    ALTER TABLE "public"."DrawKnockoutRound"
      ADD CONSTRAINT "DrawKnockoutRound_drawId_fkey"
      FOREIGN KEY ("drawId") REFERENCES "public"."Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DrawKnockoutMatch_roundId_fkey') THEN
    ALTER TABLE "public"."DrawKnockoutMatch"
      ADD CONSTRAINT "DrawKnockoutMatch_roundId_fkey"
      FOREIGN KEY ("roundId") REFERENCES "public"."DrawKnockoutRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DrawKnockoutMatch_homeTeamId_fkey') THEN
    ALTER TABLE "public"."DrawKnockoutMatch"
      ADD CONSTRAINT "DrawKnockoutMatch_homeTeamId_fkey"
      FOREIGN KEY ("homeTeamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DrawKnockoutMatch_awayTeamId_fkey') THEN
    ALTER TABLE "public"."DrawKnockoutMatch"
      ADD CONSTRAINT "DrawKnockoutMatch_awayTeamId_fkey"
      FOREIGN KEY ("awayTeamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DrawKnockoutMatch_winnerTeamId_fkey') THEN
    ALTER TABLE "public"."DrawKnockoutMatch"
      ADD CONSTRAINT "DrawKnockoutMatch_winnerTeamId_fkey"
      FOREIGN KEY ("winnerTeamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
