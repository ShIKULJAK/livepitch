import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateDraw, getDrawByCompetition, resetDraw, swapDrawGroupTeams, swapDrawPitches } from "@/lib/repositories/draws";
import { canCreateDraws, canEditEntity } from "@/lib/permissions";
import { drawConfigSchema } from "@/lib/validation/draw";
import { z } from "zod";

const drawSwapSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("swapTeams"),
    generationYear: z.number().int(),
    firstTeamId: z.string().min(1),
    secondTeamId: z.string().min(1),
  }),
  z.object({
    action: z.literal("swapPitches"),
    generationYear: z.number().int(),
    firstPitchName: z.string().min(1),
    secondPitchName: z.string().min(1),
  }),
]);

export async function GET(_: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  const { competitionId } = await params;
  const requestUrl = new URL(_.url);
  const generationYearRaw = requestUrl.searchParams.get("generationYear");
  const generationYear = generationYearRaw ? Number(generationYearRaw) : undefined;
  const data = await getDrawByCompetition(currentUser.organizationId, competitionId, Number.isFinite(generationYear) ? generationYear : undefined);

  if (!data) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...data,
      canManage: canEditEntity({ id: currentUser.id, role: currentUser.role }, data.competition),
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  if (!canCreateDraws(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = drawConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { competitionId } = await params;
  try {
    if (parsed.data.generationYear == null) {
      const existing = await getDrawByCompetition(currentUser.organizationId, competitionId);
      if (!existing) {
        return NextResponse.json({ error: "Competition not found" }, { status: 404 });
      }

      if (existing.competition.type === "LEAGUE" && !(existing.competition.availableGenerationYears ?? []).length) {
        const data = await generateDraw(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, competitionId, parsed.data);
        return NextResponse.json({ data }, { status: 201 });
      }

      const generated: number[] = [];
      const deficits: Array<{ year: number; participants: number; missing: number }> = [];
      const skipped: Array<{ year: number; reason: string }> = [];
      for (const year of existing.competition.availableGenerationYears ?? []) {
        const scoped = await getDrawByCompetition(currentUser.organizationId, competitionId, year);
        if (!scoped) continue;
        if (scoped.competition.participants.length < 2) {
          deficits.push({
            year,
            participants: scoped.competition.participants.length,
            missing: 2 - scoped.competition.participants.length,
          });
          continue;
        }
        try {
          await generateDraw(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, competitionId, {
            ...parsed.data,
            generationYear: year,
          });
          generated.push(year);
        } catch (error) {
          skipped.push({
            year,
            reason: error instanceof Error ? error.message : "Greška pri generisanju",
          });
        }
      }

      if (!generated.length) {
        const byGeneration =
          deficits.length > 0
            ? deficits
                .sort((a, b) => b.year - a.year)
                .map((item) => `Generacija ${item.year}: prijavljeno ${item.participants}, fali ${item.missing}`)
                .join(" | ")
            : skipped.length > 0
              ? "Generacije postoje, ali nema dostupnih terena/termina za automatsko generisanje."
              : "Nema odobrenih generacija sa učesnicima.";
        return NextResponse.json(
          {
            error: `Nema dovoljno ekipa za automatsko generisanje. ${byGeneration}${skipped.length ? ` | Preskočeno: ${skipped.map((item) => `Generacija ${item.year} (${item.reason})`).join(" ; ")}` : ""}`,
            details: deficits,
            skipped,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          data: {
            generatedGenerationYears: generated,
            skippedGenerationYears: skipped,
            insufficientParticipants: deficits,
          },
        },
        { status: 201 }
      );
    }

    const draw = await generateDraw(currentUser.organizationId, { id: currentUser.id, role: currentUser.role }, competitionId, parsed.data);
    if (!draw) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    return NextResponse.json({ data: draw }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  if (!canCreateDraws(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = drawSwapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { competitionId } = await params;
  try {
    const data =
      parsed.data.action === "swapTeams"
        ? await swapDrawGroupTeams(
            currentUser.organizationId,
            { id: currentUser.id, role: currentUser.role },
            competitionId,
            parsed.data.generationYear,
            parsed.data.firstTeamId,
            parsed.data.secondTeamId
          )
        : await swapDrawPitches(
            currentUser.organizationId,
            { id: currentUser.id, role: currentUser.role },
            competitionId,
            parsed.data.generationYear,
            parsed.data.firstPitchName,
            parsed.data.secondPitchName
          );
    if (!data) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const currentUser = await requireAuth();
  if (!canCreateDraws(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { competitionId } = await params;
  const requestUrl = new URL(_.url);
  const generationYearRaw = requestUrl.searchParams.get("generationYear");
  const generationYear = generationYearRaw ? Number(generationYearRaw) : undefined;
  const resetScheduleRaw = requestUrl.searchParams.get("resetSchedule");
  const resetScheduleDays = resetScheduleRaw === "1" || resetScheduleRaw === "true";
  let data = null;
  try {
    data = await resetDraw(
      currentUser.organizationId,
      { id: currentUser.id, role: currentUser.role },
      competitionId,
      Number.isFinite(generationYear) ? generationYear : undefined,
      resetScheduleDays
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  if (!data) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
