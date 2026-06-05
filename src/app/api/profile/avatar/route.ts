import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BUCKET = "avatars";

/** Admin client uses service-role key → bypasses storage RLS. */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate via cookie session.
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const oldPath = (formData.get("oldPath") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    const admin = adminClient();

    // Delete the old avatar file to avoid orphaned objects.
    if (oldPath) {
      await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {});
    }

    // Stable per-user path — overwrites the previous avatar in-place.
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const storagePath = `${user.id}/avatar.${ext}`;

    // If extension changed, remove the old extension variant too.
    if (oldPath && oldPath !== storagePath) {
      await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {});
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(BUCKET).getPublicUrl(storagePath);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Avatar API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { path } = await req.json();
    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const admin = adminClient();
    await admin.storage.from(BUCKET).remove([path]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Avatar delete error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete avatar" },
      { status: 500 }
    );
  }
}
