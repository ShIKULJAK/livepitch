import { venueCreateSchema } from "@/lib/validation/venue-create";

export const venueUpdateSchema = venueCreateSchema.partial();
