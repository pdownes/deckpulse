import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * Find LibreOffice binary across platforms.
 */
function findLibreOffice(): string {
  const candidates: string[] = [];

  if (os.platform() === "darwin") {
    candidates.push(
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
      path.join(os.homedir(), "Applications/LibreOffice.app/Contents/MacOS/soffice"),
    );
  } else if (os.platform() === "win32") {
    candidates.push(
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    );
  } else {
    candidates.push(
      "/usr/bin/libreoffice",
      "/usr/bin/soffice",
      "/usr/lib/libreoffice/program/soffice",
      "/snap/bin/libreoffice",
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Last resort: try PATH
  try {
    const which = os.platform() === "win32" ? "where" : "which";
    return execSync(`${which} libreoffice`, { stdio: "pipe" }).toString().trim();
  } catch {
    // try soffice as well
    try {
      const which = os.platform() === "win32" ? "where" : "which";
      return execSync(`${which} soffice`, { stdio: "pipe" }).toString().trim();
    } catch {
      throw new Error(
        "LibreOffice not found. Please install LibreOffice:\n" +
        "  macOS: brew install --cask libreoffice\n" +
        "  Ubuntu/Debian: sudo apt install libreoffice\n" +
        "  Windows: Download from https://www.libreoffice.org/download/"
      );
    }
  }
}

/**
 * Convert a .pptx file to PNG images.
 * Uses LibreOffice to convert PPTX → PDF, then pdf-to-img (pdfjs) to render each page as PNG.
 * Returns an array of relative paths to the generated slide images.
 */
export async function extractSlides(
  pptxPath: string,
  presentationId: string
): Promise<string[]> {
  const outputDir = path.join(process.cwd(), "public", "slides", presentationId);
  fs.mkdirSync(outputDir, { recursive: true });

  const tempDir = path.join(process.cwd(), "uploads", `temp_${presentationId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const libreoffice = findLibreOffice();

    // Step 1: Convert PPTX to PDF via LibreOffice
    execSync(
      `"${libreoffice}" --headless --convert-to pdf --outdir "${tempDir}" "${pptxPath}"`,
      { timeout: 120000, stdio: "pipe" }
    );

    const pdfFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      throw new Error("LibreOffice failed to convert PPTX to PDF");
    }
    const pdfPath = path.join(tempDir, pdfFiles[0]);

    // Step 2: Convert each PDF page to PNG using pdf-to-img (pure JS, no native deps)
    const { pdf } = await import("pdf-to-img");
    let pageNum = 1;
    for await (const image of await pdf(pdfPath, { scale: 2.0 })) {
      const fileName = `slide-${String(pageNum).padStart(3, "0")}.png`;
      fs.writeFileSync(path.join(outputDir, fileName), image);
      pageNum++;
    }

    // Collect all generated PNG files sorted by name
    const slideFiles = fs
      .readdirSync(outputDir)
      .filter((f) => f.endsWith(".png"))
      .sort();

    return slideFiles.map((f) => `/slides/${presentationId}/${f}`);
  } finally {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
