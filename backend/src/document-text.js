import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const unzipBinary = process.env.UNZIP_BIN || "unzip";
const MAX_TEXT_LENGTH = 20000;

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

async function extractPdfText(buffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fontsDir = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + "/";
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: fontsDir
  }).promise;

  let text = "";
  const pageLimit = Math.min(doc.numPages, 15); // resumes/cover letters are never longer than this
  for (let i = 1; i <= pageLimit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }
  return text;
}

async function extractDocxText(buffer) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tamptools-docx-"));
  const input = path.join(tempDir, "input.docx");
  try {
    await fs.promises.writeFile(input, buffer);
    const { stdout } = await execFileAsync(unzipBinary, ["-p", input, "word/document.xml"], { maxBuffer: 1024 * 1024 * 10 });
    const xml = stdout;
    // Paragraph breaks become newlines, tabs become tab chars, <w:t> runs become text.
    const withBreaks = xml
      .replace(/<w:p[ >]/g, "\n$&")
      .replace(/<w:tab\s*\/>/g, "\t");
    const matches = [...withBreaks.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
    const text = matches.map(m => decodeXmlEntities(m[1])).join("");
    // matches lost the inserted \n markers since they're outside <w:t> tags — rebuild
    // paragraph structure by splitting on the <w:p markers directly instead.
    const paragraphs = withBreaks.split(/\n(?=<w:p[ >])/).map(chunk => {
      const runs = [...chunk.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
      return runs.map(m => decodeXmlEntities(m[1])).join("").replace(/\t/g, "  ");
    });
    return paragraphs.filter(Boolean).join("\n");
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extracts plain text from an uploaded PDF or DOCX so it can be fed to an
 * AI generation prompt as source material (e.g. an existing resume).
 */
export async function extractDocumentText({ buffer, mimeType, originalName = "" }) {
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(originalName);
  const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(originalName);

  const isText = mimeType?.startsWith("text/") || /\.(txt|md)$/i.test(originalName);
  if (!isPdf && !isDocx && !isText) {
    throw new Error("Please upload a PDF, DOCX or text file.");
  }

  const text = isPdf ? await extractPdfText(buffer) : isDocx ? await extractDocxText(buffer) : Buffer.from(buffer).toString("utf8");
  const cleaned = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  if (!cleaned || cleaned.length < 20) {
    throw new Error("Couldn't find readable text in that file. If it's a scanned image PDF, text extraction won't work — try pasting the content in manually instead.");
  }

  return cleaned.slice(0, MAX_TEXT_LENGTH);
}
