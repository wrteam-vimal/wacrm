import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, readdir } from "fs/promises";
import path from "path";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@supabase/supabase-js";

// Force Node.js runtime — the Edge runtime does not support fs/path.
// On Vercel, local mode will fail since the filesystem is read-only;
// use supabase mode when deploying to Vercel.
export const runtime = "nodejs";

const VALID_TYPES = ["logo", "favicon", "loader"] as const;
type UploadType = (typeof VALID_TYPES)[number];

// Stable base filenames for local storage (no timestamps → deterministic paths).
const LOCAL_BASE_NAMES: Record<UploadType, string> = {
  logo: "slider-logo",
  favicon: "favicon",
  loader: "loader-graphic",
};

// Stable Supabase Storage paths — one fixed path per slot so old objects are
// overwritten in-place rather than accumulating.
const SUPABASE_PATHS: Record<UploadType, string> = {
  logo: "assets/logo/logo",
  favicon: "assets/favicon/favicon",
  loader: "assets/loader/loader",
};

// ─── Local storage helpers ────────────────────────────────────────────────────

async function uploadLocal(
  file: File,
  type: UploadType,
  oldUrl: string | null
): Promise<string> {
  const publicAssetsDir = path.join(process.cwd(), "public", "assets");
  await mkdir(publicAssetsDir, { recursive: true });

  const baseName = LOCAL_BASE_NAMES[type];
  const fileExt = path.extname(file.name).toLowerCase() || ".png";
  const fileName = `${baseName}${fileExt}`;
  const filePath = path.join(publicAssetsDir, fileName);

  // Delete any existing file for this slot (different extension = different file).
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

  return `/assets/${fileName}`;
}

// ─── Supabase storage helpers ─────────────────────────────────────────────────

function supabaseAdminClient() {
  // Service-role key bypasses RLS for storage operations.
  // Falls back to anon key — bucket must have public access enabled.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, key);
}

async function uploadSupabase(
  file: File,
  type: UploadType,
  oldUrl: string | null
): Promise<string> {
  const supabase = supabaseAdminClient();
  const fileExt = path.extname(file.name).toLowerCase() || ".png";
  const storagePath = `${SUPABASE_PATHS[type]}${fileExt}`;

  // Delete the old object if it exists (handles extension change too).
  if (oldUrl) {
    // Derive the old storage path from the URL.
    const oldPath = extractSupabasePath(oldUrl);
    if (oldPath && oldPath !== storagePath) {
      await supabase.storage.from("avatars").remove([oldPath]).catch(() => {});
    }
  }

  // Remove any existing file at this stable path (same extension, stale content).
  await supabase.storage.from("avatars").remove([storagePath]).catch(() => {});

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from("avatars")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Extract the storage bucket path from a full Supabase public URL. */
function extractSupabasePath(url: string): string | null {
  try {
    const clean = url.split("?")[0];
    const marker = "/public/avatars/";
    const idx = clean.indexOf(marker);
    if (idx !== -1) return clean.slice(idx + marker.length);
  } catch {}
  return null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Verify the user is authenticated.
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as UploadType | null;
    const storageMode = (formData.get("storageMode") as string) || "local";
    const oldUrl = (formData.get("oldUrl") as string) || null;

    if (!file || !type) {
      return NextResponse.json(
        { error: "Missing file or type" },
        { status: 400 }
      );
    }

    if (!(VALID_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json(
        { error: "Invalid upload type" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    let url: string;
    if (storageMode === "supabase") {
      url = await uploadSupabase(file, type, oldUrl);
    } else {
      url = await uploadLocal(file, type, oldUrl);
    }

    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save file" },
      { status: 500 }
    );
  }
}

