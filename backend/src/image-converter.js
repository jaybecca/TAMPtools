import sharp from "sharp";

const SUPPORTED_FORMATS = ["jpeg", "png", "webp", "avif", "tiff"];

export async function convertImage({ buffer, targetFormat }) {
  const format = String(targetFormat || "").toLowerCase().replace("jpg", "jpeg");
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error(`Unsupported target format "${targetFormat}". Choose from: JPEG, PNG, WEBP, AVIF, TIFF.`);
  }

  let pipeline = sharp(buffer, { failOn: "none" }).rotate();

  // JPEG/TIFF have no alpha channel — flatten onto white first, or transparency
  // renders as black in many viewers, which looks like a bug rather than a format limitation.
  if (["jpeg", "tiff"].includes(format)) {
    pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
  }

  let output;
  if (format === "jpeg") output = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  else if (format === "png") output = await pipeline.png().toBuffer();
  else if (format === "webp") output = await pipeline.webp({ quality: 90 }).toBuffer();
  else if (format === "avif") output = await pipeline.avif({ quality: 60 }).toBuffer();
  else output = await pipeline.tiff().toBuffer();

  const extension = format === "jpeg" ? "jpg" : format;
  return { buffer: output, mimeType: `image/${format}`, extension };
}
