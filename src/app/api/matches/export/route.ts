import { CompetitionType, MatchStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listMatchesForExport } from "@/lib/repositories/matches";
import { formatDateDDMMYYYY } from "@/lib/utils/date";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/db/prisma";

function escapeCsvCell(value: string) {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatScore(status: MatchStatus, homeScore: number | null, awayScore: number | null) {
  if (status === "LIVE" && homeScore !== null && awayScore !== null) return `${homeScore}:${awayScore}`;
  if (status === "FINISHED" && homeScore !== null && awayScore !== null) return `${homeScore}:${awayScore}`;
  return "VS";
}

function normalizeStatus(status: MatchStatus) {
  if (status === "SCHEDULED") return "SCHEDULED";
  if (status === "LIVE") return "LIVE";
  if (status === "FINISHED") return "FINISHED";
  if (status === "POSTPONED") return "POSTPONED";
  return status;
}

function truncate(value: string, max = 42) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}\u2026`;
}

function fitTextFontSize(
  text: string,
  font: Parameters<PDFDocument["embedFont"]>[0] extends never ? never : any,
  maxWidth: number,
  preferredSize: number,
  minSize: number
) {
  let size = preferredSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.2;
  }
  return size;
}

function clampTextToWidth(text: string, font: any, fontSize: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}\u2026`, fontSize) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}\u2026`;
}

function wrapTextToWidth(text: string, font: any, fontSize: number, maxWidth: number) {
  if (!text.trim()) return [""];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }

    let chunk = "";
    for (const ch of word) {
      const test = `${chunk}${ch}`;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
        chunk = test;
      } else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

async function buildSchedulePdf(
  matches: Array<{
    id: string;
    competitionId: string;
    competition: { name: string; startDate: Date | null; endDate: Date | null; season?: { name: string } | null };
    generationYear: number | null;
    round: string | null;
    scheduledAt: Date;
    status: MatchStatus;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: { name: string };
    awayTeam: { name: string };
    venueLabel?: string | null;
    venue?: { name: string | null } | null;
  }>,
  fileDateLabel: string,
  theme: "dark" | "light"
) {
  const toPdfText = (value: string) =>
    value
      .replace(/đ/g, "dj")
      .replace(/Đ/g, "Dj")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([842, 595]);
  const pageSize = page.getSize();
  const margin = 28;
  let cursorY = pageSize.height - margin;

  const colors =
    theme === "light"
      ? {
          bg: rgb(0.97, 0.98, 1),
          panel: rgb(0.92, 0.95, 0.99),
          panelAlt: rgb(0.95, 0.97, 1),
          text: rgb(0.08, 0.12, 0.18),
          textMuted: rgb(0.33, 0.41, 0.5),
          accent: rgb(0.38, 0.66, 0.12),
          border: rgb(0.78, 0.84, 0.9),
        }
      : {
          bg: rgb(0.03, 0.06, 0.11),
          panel: rgb(0.08, 0.12, 0.19),
          panelAlt: rgb(0.06, 0.1, 0.16),
          text: rgb(0.92, 0.95, 0.99),
          textMuted: rgb(0.62, 0.71, 0.81),
          accent: rgb(0.61, 0.92, 0.24),
          border: rgb(0.16, 0.23, 0.33),
        };
  const cardX = margin;
  const cardWidth = pageSize.width - margin * 2;

  const tournamentInfo = (() => {
    if (!matches.length) return { name: "Turnir", dateRange: "-" };
    const first = matches[0].competition;
    const singleCompetition = matches.every((item) => item.competitionId === matches[0].competitionId);
    const name = singleCompetition ? first.name : "Više takmičenja";
    const dateFrom = first.startDate ? formatDateDDMMYYYY(first.startDate) : "-";
    const dateTo = first.endDate ? formatDateDDMMYYYY(first.endDate) : "-";
    return { name, dateRange: `${dateFrom} - ${dateTo}` };
  })();

  const drawPageBackground = () => {
    page.drawRectangle({ x: 0, y: 0, width: pageSize.width, height: pageSize.height, color: colors.bg });
  };

  const drawHeader = () => {
    const cardHeight = 70;
    const cardY = cursorY - cardHeight;
    const cardCenterY = cardY + cardHeight / 2;
    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: colors.panel,
      borderColor: colors.border,
      borderWidth: 1,
    });
    const leftPad = cardX + 16;
    const rightPad = cardX + cardWidth - 16;
    const leftBlockWidth = cardWidth * 0.47;
    const rightBlockWidth = cardWidth * 0.47;

    const title = "LIVE PITCH";
    const subtitle = toPdfText("Raspored utakmica (Export PDF)");
    const subtitleSize = fitTextFontSize(subtitle, fontRegular, leftBlockWidth, 10, 8);
    page.drawText(title, { x: leftPad, y: cardCenterY + 4, size: 22, font: fontBold, color: colors.text });
    page.drawText(subtitle, {
      x: leftPad,
      y: cardCenterY - 12,
      size: subtitleSize,
      font: fontRegular,
      color: colors.textMuted,
    });
    const tournamentText = toPdfText(`Turnir: ${tournamentInfo.name}`);
    const durationText = toPdfText(`Trajanje: ${tournamentInfo.dateRange}`);
    const tournamentSize = fitTextFontSize(tournamentText, fontRegular, rightBlockWidth, 9, 7);
    const durationSize = fitTextFontSize(durationText, fontRegular, rightBlockWidth, 9, 7);
    const tournamentTextWidth = fontRegular.widthOfTextAtSize(tournamentText, tournamentSize);
    const durationTextWidth = fontRegular.widthOfTextAtSize(durationText, durationSize);

    page.drawText(tournamentText, {
      x: rightPad - tournamentTextWidth,
      y: cardCenterY + 2,
      size: tournamentSize,
      font: fontRegular,
      color: colors.textMuted,
    });
    page.drawText(durationText, {
      x: rightPad - durationTextWidth,
      y: cardCenterY - 12,
      size: durationSize,
      font: fontRegular,
      color: colors.textMuted,
    });

    cursorY -= cardHeight + 18;
  };

  const columns = [
    { key: "index", label: "#", width: 24 },
    { key: "date", label: "Datum", width: 60 },
    { key: "time", label: "Vrijeme", width: 50 },
    { key: "comp", label: "Takmicenje", width: 125 },
    { key: "season", label: "Sezona", width: 58 },
    { key: "gen", label: "Gen.", width: 48 },
    { key: "stage", label: "Faza", width: 60 },
    { key: "match", label: "Par", width: 210 },
    { key: "score", label: "Rez.", width: 44 },
    { key: "status", label: "Status", width: 66 },
    { key: "venue", label: "Lokacija", width: 160 },
  ] as const;

  const baseTableWidth = columns.reduce((acc, item) => acc + item.width, 0);
  const scale = cardWidth / baseTableWidth;
  const scaledWidths = columns.map((column, index) => {
    if (index === columns.length - 1) {
      const used = columns
        .slice(0, -1)
        .reduce((acc, _, innerIndex) => acc + Math.round(columns[innerIndex].width * scale), 0);
      return Math.max(80, cardWidth - used);
    }
    return Math.max(36, Math.round(column.width * scale));
  });
  const tableWidth = scaledWidths.reduce((acc, item) => acc + item, 0);
  const headerHeight = 24;
  const baseRowHeight = 22;
  const tableX = cardX;
  const tableFontSize = 7.5;
  const tableMinFontSize = 6.8;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: tableX,
      y: cursorY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: colors.panelAlt,
      borderColor: colors.border,
      borderWidth: 1,
    });
    let x = tableX + 6;
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      const cellWidth = scaledWidths[columnIndex];
      const label = toPdfText(column.label);
      const labelWidth = fontBold.widthOfTextAtSize(label, 9);
      const labelX = x + Math.max(0, (cellWidth - labelWidth) / 2);
      page.drawText(label, {
        x: labelX,
        y: cursorY - 16,
        size: 9,
        font: fontBold,
        color: colors.accent,
      });
      x += cellWidth;
    }
    cursorY -= headerHeight;
  };

  const statusColor = (status: MatchStatus) => {
    if (status === "LIVE") return rgb(0.96, 0.44, 0.34);
    if (status === "FINISHED") return rgb(0.4, 0.83, 0.49);
    if (status === "POSTPONED") return rgb(0.95, 0.74, 0.33);
    return colors.textMuted;
  };

  const ensureSpace = () => {
    if (cursorY - baseRowHeight < margin + 18) {
      page = doc.addPage([842, 595]);
      cursorY = pageSize.height - margin;
      drawPageBackground();
      drawHeader();
      drawTableHeader();
    }
  };

  const drawFooter = () => {
    page.drawText(toPdfText(`Datum izvoza: ${fileDateLabel}`), {
      x: margin,
      y: 12,
      size: 8,
      font: fontRegular,
      color: colors.textMuted,
    });
  };

  drawPageBackground();
  drawHeader();
  drawTableHeader();

  matches.forEach((match, index) => {
    ensureSpace();
    const date = new Date(match.scheduledAt);
    const row = {
      index: String(index + 1),
      date: formatDateDDMMYYYY(date),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      comp: truncate(match.competition.name, 60),
      season: truncate(match.competition.season?.name ?? "-", 10),
      gen: match.generationYear ? String(match.generationYear) : "-",
      stage: truncate(match.round ?? "-", 12),
      match: truncate(`${match.homeTeam.name} vs ${match.awayTeam.name}`, 90),
      score: formatScore(match.status, match.homeScore, match.awayScore),
      status: normalizeStatus(match.status),
      venue: truncate(match.venueLabel?.trim() || match.venue?.name?.trim() || "-", 120),
    };

    const rowBg = index % 2 === 0 ? colors.panel : colors.panelAlt;
    const normalizedVenue = toPdfText(row.venue);
    const venueColumnIndex = columns.findIndex((column) => column.key === "venue");
    const venueColumnWidth = scaledWidths[venueColumnIndex];
    const venueMaxWidth = Math.max(10, venueColumnWidth - 8);
    const venueLines = wrapTextToWidth(normalizedVenue, fontRegular, tableFontSize, venueMaxWidth);
    const venueLineCount = Math.max(1, venueLines.length);
    const rowHeight = Math.max(baseRowHeight, 8 + venueLineCount * 10);

    if (cursorY - rowHeight < margin + 18) {
      page = doc.addPage([842, 595]);
      cursorY = pageSize.height - margin;
      drawPageBackground();
      drawHeader();
      drawTableHeader();
    }

    page.drawRectangle({
      x: tableX,
      y: cursorY - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: rowBg,
      borderColor: colors.border,
      borderWidth: 0.6,
    });

    let x = tableX + 6;
    (Object.keys(row) as Array<keyof typeof row>).forEach((key, index) => {
      const columnWidth = scaledWidths[index];
      const rawText = key === "venue" ? normalizedVenue : toPdfText(row[key]);
      const resolvedFontSize =
        key === "score"
          ? fitTextFontSize(rawText, fontBold, Math.max(10, columnWidth - 8), tableFontSize, tableMinFontSize)
          : fitTextFontSize(rawText, fontRegular, Math.max(10, columnWidth - 8), tableFontSize, tableMinFontSize);
      if (key === "venue") {
        const lines = wrapTextToWidth(rawText, fontRegular, resolvedFontSize, Math.max(10, columnWidth - 8));
        lines.forEach((line, lineIndex) => {
          const textWidth = fontRegular.widthOfTextAtSize(line, resolvedFontSize);
          const centeredX = x + Math.max(0, (columnWidth - textWidth) / 2);
          page.drawText(line, {
            x: centeredX,
            y: cursorY - 12 - lineIndex * 9,
            size: resolvedFontSize,
            font: fontRegular,
            color: colors.text,
          });
        });
      } else {
        const fittedText = clampTextToWidth(
          rawText,
          key === "score" ? fontBold : fontRegular,
          resolvedFontSize,
          Math.max(10, columnWidth - 8)
        );
        const textWidth = (key === "score" ? fontBold : fontRegular).widthOfTextAtSize(fittedText, resolvedFontSize);
        const centeredX = x + Math.max(0, (columnWidth - textWidth) / 2);
        page.drawText(fittedText, {
          x: centeredX,
          y: cursorY - 13,
          size: resolvedFontSize,
          font: key === "score" ? fontBold : fontRegular,
          color: key === "status" ? statusColor(match.status) : colors.text,
        });
      }
      x += columnWidth;
    });

    cursorY -= rowHeight;
  });

  const pages = doc.getPages();
  for (const pageItem of pages) {
    page = pageItem;
    drawFooter();
  }

  return doc.save();
}

export async function GET(request: Request) {
  const currentUser = await requireAuth();
  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status");
  const competitionId = searchParams.get("competitionId") ?? undefined;
  const rawCompetitionType = searchParams.get("competitionType");
  const rawGeneration = searchParams.get("generation");
  const rawQuery = (searchParams.get("q") ?? "").trim().toLowerCase();
  const requestedFormat = (searchParams.get("format") ?? "csv").toLowerCase();
  const requestedTheme = (searchParams.get("theme") ?? "dark").toLowerCase();
  const theme: "dark" | "light" = requestedTheme === "light" ? "light" : "dark";

  const status = rawStatus && rawStatus in MatchStatus ? (rawStatus as MatchStatus) : undefined;
  const competitionType =
    rawCompetitionType && rawCompetitionType in CompetitionType
      ? (rawCompetitionType as CompetitionType)
      : undefined;
  const leagueAndGroupMatches = await listMatchesForExport(currentUser.organizationId, {
    status,
    competitionId,
    competitionType,
  });
  const knockoutMatchesRaw = await prisma.drawKnockoutMatch.findMany({
    where: {
      ...(competitionId ? { round: { draw: { competitionId } } } : {}),
      round: {
        draw: {
          competition: {
            organizationId: currentUser.organizationId,
            ...(competitionType ? { type: competitionType } : {}),
          },
        },
      },
      scheduledAt: { not: null },
    },
    include: {
      round: {
        include: {
          draw: {
            include: {
              competition: {
                include: {
                  season: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: [{ scheduledAt: "asc" }],
  });

  const knockoutMatches = knockoutMatchesRaw.map((item) => {
    const homeName = item.homeTeam?.name ?? item.homeSourceValue ?? "TBD";
    const awayName = item.awayTeam?.name ?? item.awaySourceValue ?? "TBD";
    const roundLabel = `${item.round.roundType.replaceAll("_", " ")} ${item.order}`;
    return {
      id: `ko-${item.id}`,
      competitionId: item.round.draw.competitionId,
      competition: item.round.draw.competition,
      generationYear: item.round.draw.generationYear ?? null,
      round: roundLabel,
      scheduledAt: item.scheduledAt as Date,
      status: "SCHEDULED" as MatchStatus,
      homeScore: null,
      awayScore: null,
      homeTeam: { name: homeName },
      awayTeam: { name: awayName },
      venueLabel: item.venueLabel ?? null,
      venue: null,
    };
  });

  let matches = [...leagueAndGroupMatches, ...knockoutMatches].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
  if (status) {
    matches = matches.filter((item) => item.status === status);
  }
  if (rawGeneration && rawGeneration !== "ALL") {
    if (rawGeneration === "NONE") {
      matches = matches.filter((item) => item.generationYear == null);
    } else {
      const year = Number(rawGeneration);
      if (Number.isFinite(year)) {
        matches = matches.filter((item) => item.generationYear === year);
      }
    }
  }
  if (rawQuery) {
    matches = matches.filter((item) => {
      const venueLabel = item.venueLabel?.trim() || item.venue?.name?.trim() || "";
      const haystack = [
        item.competition.name,
        item.homeTeam.name,
        item.awayTeam.name,
        item.round ?? "",
        item.competition.season?.name ?? "",
        item.generationYear ? String(item.generationYear) : "",
        venueLabel,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(rawQuery);
    });
  }
  const todayLabel = formatDateDDMMYYYY(new Date());
  const csvTournamentInfo = (() => {
    if (!matches.length) return { name: "-", dateFrom: "-", dateTo: "-" };
    const first = matches[0].competition;
    const singleCompetition = matches.every((item) => item.competitionId === matches[0].competitionId);
    return {
      name: singleCompetition ? first.name : "Vise takmicenja",
      dateFrom: first.startDate ? formatDateDDMMYYYY(first.startDate) : "-",
      dateTo: first.endDate ? formatDateDDMMYYYY(first.endDate) : "-",
    };
  })();

  if (requestedFormat === "pdf") {
    const pdf = await buildSchedulePdf(matches, todayLabel, theme);
    const fileName = `live-pitch-raspored-${todayLabel}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const header = [
    "Datum",
    "Vrijeme",
    "Takmicenje",
    "Sezona",
    "Generacija",
    "Faza",
    "Domacin",
    "Gost",
    "Rezultat",
    "Status",
    "Lokacija",
  ];

  const rows = matches.map((match) => {
    const date = new Date(match.scheduledAt);
    const seasonLabel = match.competition.season?.name ?? "";
    const generationLabel = match.generationYear ? `Generacija ${match.generationYear}` : "";
    const venueLabel = match.venueLabel?.trim() || match.venue?.name?.trim() || "";
    return [
      formatDateDDMMYYYY(date),
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      match.competition.name,
      seasonLabel,
      generationLabel,
      match.round ?? "",
      match.homeTeam.name,
      match.awayTeam.name,
      formatScore(match.status, match.homeScore, match.awayScore),
      match.status,
      venueLabel,
    ].map((cell) => escapeCsvCell(String(cell)));
  });

  const csvPreamble = [
    [`Turnir`, csvTournamentInfo.name],
    [`Trajanje od`, csvTournamentInfo.dateFrom],
    [`Trajanje do`, csvTournamentInfo.dateTo],
    [`Datum izvoza`, todayLabel],
    [],
  ];

  const csvBody = [...csvPreamble, header, ...rows].map((line) => line.join(";")).join("\n");
  const csvContent = `\uFEFF${csvBody}`;
  const fileName = `live-pitch-raspored-${todayLabel}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
