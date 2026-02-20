import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { extractSlides } from "@/lib/slides";
import { randomUUID } from "crypto";
import { customAlphabet } from "nanoid";
import fs from "fs";
import path from "path";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export async function POST(request: NextRequest) {
  let filePath: string | null = null;
  let presentationId: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Untitled Presentation";
    const presenterEmail = (formData.get("email") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".pptx")) {
      return NextResponse.json(
        { error: "Only .pptx files are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 50 MB)" },
        { status: 400 }
      );
    }

    // Save uploaded file
    const uploadDir = path.join(process.cwd(), "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    filePath = path.join(uploadDir, `${randomUUID()}.pptx`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Generate codes
    presentationId = randomUUID();
    const shareCode = nanoid();
    const presenterCode = nanoid();

    // Extract slides
    const slidePaths = await extractSlides(filePath, presentationId);

    if (slidePaths.length === 0) {
      return NextResponse.json(
        { error: "Could not extract slides from the presentation" },
        { status: 400 }
      );
    }

    // Store in database (transactional)
    const db = getDb();
    const insertAll = db.transaction(() => {
      db.prepare(
        `INSERT INTO presentations (id, title, share_code, presenter_code, presenter_email, slide_count)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(presentationId, title, shareCode, presenterCode, presenterEmail?.toLowerCase().trim() || null, slidePaths.length);

      const insertSlide = db.prepare(
        `INSERT INTO slides (id, presentation_id, slide_number, image_path) VALUES (?, ?, ?, ?)`
      );

      for (let i = 0; i < slidePaths.length; i++) {
        insertSlide.run(randomUUID(), presentationId, i + 1, slidePaths[i]);
      }
    });
    insertAll();

    return NextResponse.json({
      id: presentationId,
      title,
      shareCode,
      presenterCode,
      slideCount: slidePaths.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    // Clean up extracted slides on error
    if (presentationId) {
      const slideDir = path.join(process.cwd(), "public", "slides", presentationId);
      fs.rmSync(slideDir, { recursive: true, force: true });
    }
    const message =
      error instanceof Error ? error.message : "Failed to process presentation";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Always clean up uploaded file
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch { /* already gone */ }
    }
  }
}
