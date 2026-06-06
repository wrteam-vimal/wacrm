import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRelativeStoragePath } from "@/lib/themes";

// Force Node.js runtime so cookies() and server-side Supabase client work correctly.
export const runtime = "nodejs";


export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify the user is authenticated via cookies (server-side session).
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    // Fetch account_id from profiles.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.account_id) {
      return NextResponse.json(
        { error: "No organization account linked to this user" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const dbPayload = {
      theme: body.theme,
      custom_color: body.customColor,
      show_logo: body.showLogo,
      show_title: body.showTitle,
      title_text: body.titleText,
      logo_url: getRelativeStoragePath(body.logoUrl),
      favicon_url: getRelativeStoragePath(body.faviconUrl),
      loader_type: body.loaderType,
      loader_image_url: getRelativeStoragePath(body.loaderImageUrl),
      storage_mode: body.storageMode === "supabase" ? "supabase" : "local",
      allow_signup: body.allowSignup !== undefined ? body.allowSignup : true,
      updated_at: new Date().toISOString(),
    };

    // Check if a row already exists for this account.
    const { data: existing } = await supabase
      .from("appearance_settings")
      .select("id")
      .eq("account_id", profile.account_id)
      .maybeSingle();

    let saveError;
    if (existing) {
      const { error } = await supabase
        .from("appearance_settings")
        .update(dbPayload)
        .eq("id", existing.id);
      saveError = error;
    } else {
      const { error } = await supabase
        .from("appearance_settings")
        .insert({ account_id: profile.account_id, ...dbPayload });
      saveError = error;
    }

    if (saveError) {
      console.error("Appearance settings save error:", saveError);
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Appearance settings API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save settings" },
      { status: 500 }
    );
  }
}
