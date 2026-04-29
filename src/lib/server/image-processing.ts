import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const MAX_IMAGE_BYTES = 300 * 1024;
const TARGET_IMAGE_SIZE = 150;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

export async function processAndStoreProfileImage(file: File, bucket: "teams" | "players") {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ImageProcessingError("Unsupported file type. Allowed formats: PNG, JPG, JPEG, WEBP.");
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  if (!inputBuffer.length) {
    throw new ImageProcessingError("Image file is empty.");
  }

  const resized = sharp(inputBuffer)
    .rotate()
    .resize(TARGET_IMAGE_SIZE, TARGET_IMAGE_SIZE, { fit: "cover", position: "centre" });

  let outputBuffer = await resized.webp({ quality: 85, effort: 4 }).toBuffer();
  let quality = 85;

  while (outputBuffer.length > MAX_IMAGE_BYTES && quality > 45) {
    quality -= 10;
    outputBuffer = await resized.webp({ quality, effort: 4 }).toBuffer();
  }

  if (outputBuffer.length > MAX_IMAGE_BYTES) {
    throw new ImageProcessingError("Image could not be compressed under 300KB.");
  }

  const fileName = `${bucket}-${Date.now()}-${randomUUID()}.webp`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", bucket);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), outputBuffer);

  return {
    url: `/uploads/${bucket}/${fileName}`,
    size: outputBuffer.length,
    mimeType: "image/webp",
  };
}
