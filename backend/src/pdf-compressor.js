import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const gsBinary = process.env.GHOSTSCRIPT_BIN || "gs";

const settings = {
  screen: "/screen",
  ebook: "/ebook",
  printer: "/printer"
};

export async function compressPdf(buffer, level = "ebook") {
  const setting = settings[level] || settings.ebook;
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tamptools-pdf-"));
  const input = path.join(tempDir, "input.pdf");
  const output = path.join(tempDir, `compressed-${crypto.randomUUID()}.pdf`);

  try {
    await fs.promises.writeFile(input, buffer);
    await execFileAsync(gsBinary, [
      "-q",
      "-dSAFER",
      "-dBATCH",
      "-dNOPAUSE",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${setting}`,
      "-dDetectDuplicateImages=true",
      "-dCompressFonts=true",
      "-dSubsetFonts=true",
      `-sOutputFile=${output}`,
      input
    ], { maxBuffer: 1024 * 1024 * 4 });

    const compressed = await fs.promises.readFile(output);
    if (!compressed.length) throw new Error("The compressor produced an empty PDF.");
    return compressed;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
