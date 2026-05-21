export type GenerationPreset = {
  generationLabel: string;
  ageGroupCode: string;
  playerFormat: string;
  fieldLengthMeters: number;
  fieldWidthMeters: number;
};

export const GENERATION_PRESETS: GenerationPreset[] = [
  { generationLabel: "Generacija 2019", ageGroupCode: "U7", playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25 },
  { generationLabel: "Generacija 2018", ageGroupCode: "U8", playerFormat: "5+1", fieldLengthMeters: 45, fieldWidthMeters: 25 },
  { generationLabel: "Generacija 2017", ageGroupCode: "U9", playerFormat: "6+1", fieldLengthMeters: 60, fieldWidthMeters: 40 },
  { generationLabel: "Generacija 2016", ageGroupCode: "U10", playerFormat: "6+1", fieldLengthMeters: 60, fieldWidthMeters: 40 },
  { generationLabel: "Generacija 2015", ageGroupCode: "U11", playerFormat: "8+1", fieldLengthMeters: 70, fieldWidthMeters: 50 },
  { generationLabel: "Generacija 2014", ageGroupCode: "U12", playerFormat: "8+1", fieldLengthMeters: 70, fieldWidthMeters: 50 },
  { generationLabel: "Generacija 2013", ageGroupCode: "U13", playerFormat: "10+1", fieldLengthMeters: 82, fieldWidthMeters: 50 },
  { generationLabel: "Generacija 2012", ageGroupCode: "U14", playerFormat: "10+1", fieldLengthMeters: 82, fieldWidthMeters: 50 },
];

export const GENERATION_LABELS = GENERATION_PRESETS.map((item) => item.generationLabel);

export function getGenerationPreset(generationLabel: string) {
  return GENERATION_PRESETS.find((item) => item.generationLabel === generationLabel) ?? null;
}
