import { execSync } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Convert a .pptx file to PNG images using LibreOffice.
 * Returns an array of relative paths to the generated slide images.
 */
export async function extractSlides(
  pptxPath: string,
  presentationId: string
): Promise<string[]> {
  const outputDir = path.join(process.cwd(), "public", "slides", presentationId);
  fs.mkdirSync(outputDir, { recursive: true });

  // Use LibreOffice to convert PPTX to PDF first, then to images
  const tempDir = path.join(process.cwd(), "uploads", `temp_${presentationId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Convert PPTX to PDF
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${pptxPath}"`,
      { timeout: 120000, stdio: "pipe" }
    );

    const pdfFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      throw new Error("LibreOffice failed to convert PPTX to PDF");
    }
    const pdfPath = path.join(tempDir, pdfFiles[0]);

    // Convert PDF pages to individual PNG images using LibreOffice
    execSync(
      `libreoffice --headless --convert-to png --outdir "${outputDir}" "${pdfPath}"`,
      { timeout: 120000, stdio: "pipe" }
    );

    // LibreOffice produces a single PNG from PDF. We need per-page images.
    // Use a different approach: convert PPTX directly to individual images
    // by first converting to individual PDFs or using the impress filter.

    // Alternative: convert PPTX slides to images via HTML/SVG export
    // Simplest reliable approach: use pdftoppm if available
    const hasPdftoppm = (() => {
      try {
        execSync("which pdftoppm", { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    })();

    // Clean any single PNG from libreoffice
    const existingPngs = fs.readdirSync(outputDir).filter(f => f.endsWith(".png"));
    for (const f of existingPngs) {
      fs.unlinkSync(path.join(outputDir, f));
    }

    if (hasPdftoppm) {
      execSync(
        `pdftoppm -png -r 200 "${pdfPath}" "${path.join(outputDir, "slide")}"`,
        { timeout: 120000, stdio: "pipe" }
      );
    } else {
      // Fallback: use convert (ImageMagick) or just serve the single page
      try {
        execSync(
          `convert -density 200 "${pdfPath}" "${path.join(outputDir, "slide-%02d.png")}"`,
          { timeout: 120000, stdio: "pipe" }
        );
      } catch {
        // Last fallback: use LibreOffice to convert each slide
        // Just copy the single PNG and call it slide-1
        execSync(
          `libreoffice --headless --convert-to png --outdir "${outputDir}" "${pdfPath}"`,
          { timeout: 120000, stdio: "pipe" }
        );
        const pngs = fs.readdirSync(outputDir).filter(f => f.endsWith(".png"));
        if (pngs.length === 1) {
          fs.renameSync(
            path.join(outputDir, pngs[0]),
            path.join(outputDir, "slide-01.png")
          );
        }
      }
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
