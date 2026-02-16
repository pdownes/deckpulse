import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { extractSlides } from "@/lib/slides";
import { randomUUID } from "crypto";
import { customAlphabet } from "nanoid";
import fs from "fs";
import path from "path";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Untitled Presentation";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".pptx")) {
      return NextResponse.json(
        { error: "Only .pptx files are supported" },
        { status: 400 }
      );
    }

    // Save uploaded file
    const uploadDir = path.join(process.cwd(), "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `${randomUUID()}.pptx`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Generate codes
    const presentationId = randomUUID();
    const shareCode = nanoid();
    const presenterCode = nanoid();

    // Extract slides
    const slidePaths = await extractSlides(filePath, presentationId);

    if (slidePaths.length === 0) {
      // Clean up
      fs.unlinkSync(filePath);
      return NextResponse.json(
        { error: "Could not extract slides from the presentation" },
        { status: 400 }
      );
    }

    // Store in database
    const db = getDb();

    db.prepare(
      `INSERT INTO presentations (id, title, share_code, presenter_code, slide_count)
       VALUES (?, ?, ?, ?, ?)`
    ).run(presentationId, title, shareCode, presenterCode, slidePaths.length);

    const insertSlide = db.prepare(
      `INSERT INTO slides (id, presentation_id, slide_number, image_path) VALUES (?, ?, ?, ?)`
    );

    for (let i = 0; i < slidePaths.length; i++) {
      insertSlide.run(randomUUID(), presentationId, i + 1, slidePaths[i]);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return NextResponse.json({
      id: presentationId,
      title,
      shareCode,
      presenterCode,
      slideCount: slidePaths.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process presentation" },
      { status: 500 }
    );
  }
}
