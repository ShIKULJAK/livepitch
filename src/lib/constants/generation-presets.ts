export type GenerationPreset = {
  generationLabel: string;
  ageGroupCode: string;
  playerFormat: string;
  fieldLengthMeters: number;
  fieldWidthMeters: number;
  goalWidthMeters: number;
  goalHeightMeters: number;
};

const formatByAge: Record<
  number,
  {
    playerFormat: string;
    fieldLengthMeters: number;
    fieldWidthMeters: number;
    goalWidthMeters: number;
    goalHeightMeters: number;
  }
> = {
  5: { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25, goalWidthMeters: 5, goalHeightMeters: 2 },
  6: { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25, goalWidthMeters: 5, goalHeightMeters: 2 },
  7: { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25, goalWidthMeters: 5, goalHeightMeters: 2 },
  8: { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25, goalWidthMeters: 5, goalHeightMeters: 2 },
  9: { playerFormat: "6+1", fieldLengthMeters: 60, fieldWidthMeters: 40, goalWidthMeters: 5, goalHeightMeters: 2 },
  10: { playerFormat: "6+1", fieldLengthMeters: 60, fieldWidthMeters: 40, goalWidthMeters: 5, goalHeightMeters: 2 },
  11: { playerFormat: "8+1", fieldLengthMeters: 70, fieldWidthMeters: 50, goalWidthMeters: 5, goalHeightMeters: 2 },
  12: { playerFormat: "8+1", fieldLengthMeters: 70, fieldWidthMeters: 50, goalWidthMeters: 5, goalHeightMeters: 2 },
  13: { playerFormat: "10+1", fieldLengthMeters: 82, fieldWidthMeters: 50, goalWidthMeters: 6.4, goalHeightMeters: 2.13 },
  14: { playerFormat: "10+1", fieldLengthMeters: 82, fieldWidthMeters: 50, goalWidthMeters: 6.4, goalHeightMeters: 2.13 },
  15: { playerFormat: "10+1", fieldLengthMeters: 91, fieldWidthMeters: 55, goalWidthMeters: 7.32, goalHeightMeters: 2.44 },
  16: { playerFormat: "10+1", fieldLengthMeters: 91, fieldWidthMeters: 55, goalWidthMeters: 7.32, goalHeightMeters: 2.44 },
  17: { playerFormat: "10+1", fieldLengthMeters: 100, fieldWidthMeters: 64, goalWidthMeters: 7.32, goalHeightMeters: 2.44 },
  18: { playerFormat: "10+1", fieldLengthMeters: 100, fieldWidthMeters: 64, goalWidthMeters: 7.32, goalHeightMeters: 2.44 },
};

function buildGenerationPresets() {
  const currentYear = new Date().getFullYear();
  const presets: GenerationPreset[] = [];
  for (let age = 5; age <= 18; age += 1) {
    const generationYear = currentYear - age;
    const profile = formatByAge[age] ?? formatByAge[14];
    presets.push({
      generationLabel: `Generacija ${generationYear}`,
      ageGroupCode: `U${age}`,
      playerFormat: profile.playerFormat,
      fieldLengthMeters: profile.fieldLengthMeters,
      fieldWidthMeters: profile.fieldWidthMeters,
      goalWidthMeters: profile.goalWidthMeters,
      goalHeightMeters: profile.goalHeightMeters,
    });
  }
  return presets.sort((a, b) => Number(b.generationLabel.split(" ")[1]) - Number(a.generationLabel.split(" ")[1]));
}

export const GENERATION_PRESETS: GenerationPreset[] = buildGenerationPresets();

export const GENERATION_LABELS = GENERATION_PRESETS.map((item) => item.generationLabel);

export function getGenerationPreset(generationLabel: string) {
  return GENERATION_PRESETS.find((item) => item.generationLabel === generationLabel) ?? null;
}
