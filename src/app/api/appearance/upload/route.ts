import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, readdir } from "fs/promises";
import path from "path";

const VALID_TYPES = ["logo", "favicon", "loader"] as const;
type UploadType = (typeof VALID_TYPES)[number];

const BASE_NAMES: Record<UploadType, string> = {
  logo: "slider-logo",
  favicon: "favicon",
  loader: "loader-graphic",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as UploadType | null;

    if (!file || !type) {
      return NextResponse.json({ error: "Missing file or type" }, { status: 400 });
    }

    if (!(VALID_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const publicAssetsDir = path.join(process.cwd(), "public", "assets");
    await mkdir(publicAssetsDir, { recursive: true });

    const baseName = BASE_NAMES[type];
    const fileExt = path.extname(file.name).toLowerCase() || ".png";
    const fileName = `${baseName}${fileExt}`;
    const filePath = path.join(publicAssetsDir, fileName);

    // Remove any existing file with the same base name but a different extension.
    try {
      const existing = await readdir(publicAssetsDir);
      for (const f of existing) {
        if (f.startsWith(baseName + ".") && f !== fileName) {
          await unlink(path.join(publicAssetsDir, f)).catch(() => {});
        }
      }
    } catch {}

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({ success: true, url: `/assets/${fileName}` });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save file" },
      { status: 500 }
    );
  }
}

