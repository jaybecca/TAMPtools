import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const gsBinary = process.env.GHOSTSCRIPT_BIN || "gs";
const zipBinary = process.env.ZIP_BIN || "zip";

export function parsePageRanges(input) {
  const parts = String(input || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Enter at least one page or page range, e.g. 1-3, 5, 8-10.");
  const ranges = parts.map(part => {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`"${part}" isn't a valid page or range.`);
    const first = Number(m[1]);
    const last = m[2] ? Number(m[2]) : first;
    if (first < 1 || last < first) throw new Error(`"${part}" isn't a valid page or range.`);
    return { first, last };
  });
  if (ranges.length > 50) throw new Error("Too many parts — please split into fewer than 50 ranges at once.");
  return ranges;
}

export async function getPdfPageCount(buffer) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tamptools-pdfcount-"));
  const input = path.join(tempDir, "input.pdf");
  try {
    await fs.promises.writeFile(input, buffer);
    const { stdout } = await execFileAsync(gsBinary, [
      "-q", "-dNODISPLAY", "-dNOSAFER",
      "-c", `(${input}) (r) file runpdfbegin pdfpagecount = quit`
    ], { maxBuffer: 1024 * 1024 });
    const count = parseInt(String(stdout).trim(), 10);
    if (!Number.isFinite(count) || count < 1) throw new Error("Could not determine the page count automatically.");
    return count;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractRange(input, tempDir, range, index) {
  const output = path.join(tempDir, `part-${String(index + 1).padStart(3, "0")}-p${range.first}-${range.last}.pdf`);
  await execFileAsync(gsBinary, [
    "-q", "-dSAFER", "-dBATCH", "-dNOPAUSE",
    "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
    `-dFirstPage=${range.first}`, `-dLastPage=${range.last}`,
    `-sOutputFile=${output}`, input
  ], { maxBuffer: 1024 * 1024 * 4 });
  const stat = await fs.promises.stat(output).catch(() => null);
  if (!stat || stat.size === 0) {
    throw new Error(`Pages ${range.first}-${range.last} could not be extracted — check the range is within this document's page count.`);
  }
  return output;
}

export async function splitPdf(buffer, ranges) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tamptools-pdfsplit-"));
  const input = path.join(tempDir, "input.pdf");
  try {
    await fs.promises.writeFile(input, buffer);
    const outputs = [];
    for (let i = 0; i < ranges.length; i++) {
      outputs.push(await extractRange(input, tempDir, ranges[i], i));
    }
    if (outputs.length === 1) {
      return { buffer: await fs.promises.readFile(outputs[0]), mimeType: "application/pdf", extension: "pdf" };
    }
    const zipPath = path.join(tempDir, `split-${crypto.randomUUID()}.zip`);
    await execFileAsync(zipBinary, ["-j", zipPath, ...outputs], { maxBuffer: 1024 * 1024 * 8 });
    return { buffer: await fs.promises.readFile(zipPath), mimeType: "application/zip", extension: "zip" };
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
