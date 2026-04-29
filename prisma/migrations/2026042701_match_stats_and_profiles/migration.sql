DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoalType') THEN
    CREATE TYPE "public"."GoalType" AS ENUM ('OPEN_PLAY', 'PENALTY', 'OWN_GOAL', 'FREE_KICK', 'CORNER', 'REBOUND', 'HEADER', 'OTHER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlayerStatus') THEN
    CREATE TYPE "public"."PlayerStatus" AS ENUM ('ACTIVE', 'INJURED', 'SUSPENDED', 'INACTIVE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DominantFoot') THEN
    CREATE TYPE "public"."DominantFoot" AS ENUM ('LEFT', 'RIGHT', 'BOTH');
  END IF;
END $$;

ALTER TABLE "public"."Team"
  ADD COLUMN IF NOT EXISTS "sport" "public"."SportType" NOT NULL DEFAULT 'FOOTBALL',
  ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;

ALTER TABLE "public"."Player"
  ADD COLUMN IF NOT EXISTS "sport" "public"."SportType" NOT NULL DEFAULT 'FOOTBALL',
  ADD COLUMN IF NOT EXISTS "firstName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastName" TEXT,
  ADD COLUMN IF NOT EXISTS "nationalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "placeOfBirth" TEXT,
  ADD COLUMN IF NOT EXISTS "heightCm" INTEGER,
  ADD COLUMN IF NOT EXISTS "weightKg" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" "public"."PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "dominantFoot" "public"."DominantFoot" NOT NULL DEFAULT 'RIGHT',
  ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;

ALTER TABLE "public"."Match"
  ADD COLUMN IF NOT EXISTS "regularTimeMinutes" INTEGER NOT NULL DEFAULT 90;

ALTER TABLE "public"."Competition"
  ADD COLUMN IF NOT EXISTS "matchDurationMinutes" INTEGER NOT NULL DEFAULT 90;

CREATE TABLE IF NOT EXISTS "public"."MatchGoalEvent" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "playerId" TEXT,
  "scorerName" TEXT,
  "minuteBase" INTEGER NOT NULL,
  "minuteExtra" INTEGER,
  "goalType" "public"."GoalType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchGoalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."MatchTeamStats" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "possessionSeconds" INTEGER NOT NULL DEFAULT 0,
  "possessionPercent" INTEGER NOT NULL,
  "totalShots" INTEGER NOT NULL DEFAULT 0,
  "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
  "shotsOffTarget" INTEGER NOT NULL DEFAULT 0,
  "totalPasses" INTEGER NOT NULL DEFAULT 0,
  "accuratePasses" INTEGER NOT NULL DEFAULT 0,
  "inaccuratePasses" INTEGER NOT NULL DEFAULT 0,
  "corners" INTEGER NOT NULL DEFAULT 0,
  "fouls" INTEGER NOT NULL DEFAULT 0,
  "yellowCards" INTEGER NOT NULL DEFAULT 0,
  "redCards" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchTeamStats_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."MatchTeamStats"
  ADD COLUMN IF NOT EXISTS "possessionSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fouls" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "MatchTeamStats_matchId_teamId_key" ON "public"."MatchTeamStats" ("matchId", "teamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MatchGoalEvent_matchId_fkey'
  ) THEN
    ALTER TABLE "public"."MatchGoalEvent"
      ADD CONSTRAINT "MatchGoalEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MatchGoalEvent_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."MatchGoalEvent"
      ADD CONSTRAINT "MatchGoalEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MatchGoalEvent_playerId_fkey'
  ) THEN
    ALTER TABLE "public"."MatchGoalEvent"
      ADD CONSTRAINT "MatchGoalEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MatchTeamStats_matchId_fkey'
  ) THEN
    ALTER TABLE "public"."MatchTeamStats"
      ADD CONSTRAINT "MatchTeamStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MatchTeamStats_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."MatchTeamStats"
      ADD CONSTRAINT "MatchTeamStats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
