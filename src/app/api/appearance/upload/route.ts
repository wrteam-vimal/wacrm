import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, readdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as "logo" | "favicon" | null;

    if (!file || !type) {
      return NextResponse.json({ error: "Missing file or type" }, { status: 400 });
    }

    const validTypes = ["logo", "favicon"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
    }

    // Check directory exists
    const publicAssetsDir = path.join(process.cwd(), "public", "assets");
    await mkdir(publicAssetsDir, { recursive: true });

    // Proper naming convention:
    // Logo -> slider-logo.<extension>
    // Favicon -> favicon.<extension>
    const fileExt = path.extname(file.name) || (type === "logo" ? ".png" : ".ico");
    const baseName = type === "logo" ? "slider-logo" : "favicon";
    const fileName = `${baseName}${fileExt}`;
    const filePath = path.join(publicAssetsDir, fileName);

    // Delete any existing files matching baseName to prevent old extensions from staying around
    try {
      const files = await readdir(publicAssetsDir);
      for (const f of files) {
        if (f.startsWith(baseName + ".")) {
          try {
            await unlink(path.join(publicAssetsDir, f));
          } catch (_) {}
        }
      }
    } catch (_) {}

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicUrl = `/assets/${fileName}`;
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to save file" }, { status: 500 });
  }
}
