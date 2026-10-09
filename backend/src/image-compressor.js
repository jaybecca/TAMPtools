import sharp from "sharp";

const MAX_DIMENSION = 4000;

/**
 * Compresses an image buffer. Re-encodes at a quality level and, if the
 * image is very large, downsizes it first — the two biggest real levers
 * for file size. Preserves the original format unless the caller asks
 * to also convert it.
 */
export async function compressImage({ buffer, mimeType, quality = 70, maxWidth }) {
  let pipeline = sharp(buffer, { failOn: "none" }).rotate(); // .rotate() auto-applies EXIF orientation
  const metadata = await sharp(buffer).metadata();

  const targetWidth = Math.min(maxWidth || metadata.width || MAX_DIMENSION, MAX_DIMENSION);
  if (metadata.width && targetWidth < metadata.width) {
    pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: true });
  }

  const format = (metadata.format === "png" && metadata.hasAlpha) ? "png" : (metadata.format || "jpeg");
  let output;
  if (format === "png") {
    // PNG is lossless; "quality" maps to compression effort + palette reduction instead.
    output = await pipeline.png({ quality: Math.max(quality, 40), compressionLevel: 9, palette: true }).toBuffer();
  } else if (format === "webp") {
    output = await pipeline.webp({ quality }).toBuffer();
  } else {
    output = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  return {
    buffer: output,
    mimeType: format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg",
    extension: format === "png" ? "png" : format === "webp" ? "webp" : "jpg",
    originalSize: buffer.length,
    compressedSize: output.length,
    width: targetWidth,
    originalWidth: metadata.width,
    originalHeight: metadata.height
  };
}
