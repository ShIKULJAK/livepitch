export type GenerationPreset = {
  generationLabel: string;
  ageGroupCode: string;
  playerFormat: string;
  fieldLengthMeters: number;
  fieldWidthMeters: number;
};

const formatByAge: Record<number, { playerFormat: string; fieldLengthMeters: number; fieldWidthMeters: number }> = {
  5: { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25 },
  6: { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25 },
  7: { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25 },
  8: { playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25 },
  9: { playerFormat: "6+1", fieldLengthMeters: 60, fieldWidthMeters: 40 },
  10: { playerFormat: "6+1", fieldLengthMeters: 60, fieldWidthMeters: 40 },
  11: { playerFormat: "8+1", fieldLengthMeters: 70, fieldWidthMeters: 50 },
  12: { playerFormat: "8+1", fieldLengthMeters: 70, fieldWidthMeters: 50 },
  13: { playerFormat: "10+1", fieldLengthMeters: 82, fieldWidthMeters: 50 },
  14: { playerFormat: "10+1", fieldLengthMeters: 82, fieldWidthMeters: 50 },
  15: { playerFormat: "11+1", fieldLengthMeters: 100, fieldWidthMeters: 64 },
  16: { playerFormat: "11+1", fieldLengthMeters: 100, fieldWidthMeters: 64 },
  17: { playerFormat: "11+1", fieldLengthMeters: 105, fieldWidthMeters: 68 },
  18: { playerFormat: "11+1", fieldLengthMeters: 105, fieldWidthMeters: 68 },
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
    });
  }
  return presets.sort((a, b) => Number(b.generationLabel.split(" ")[1]) - Number(a.generationLabel.split(" ")[1]));
}

export const GENERATION_PRESETS: GenerationPreset[] = buildGenerationPresets();

export const GENERATION_LABELS = GENERATION_PRESETS.map((item) => item.generationLabel);

export function getGenerationPreset(generationLabel: string) {
  return GENERATION_PRESETS.find((item) => item.generationLabel === generationLabel) ?? null;
}
