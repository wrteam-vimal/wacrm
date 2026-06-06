import { requirePermission, toErrorResponse } from "@/lib/auth/account";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function GET() {
  try {
    const ctx = await requirePermission("manage_users");
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("id, user_id, full_name, email, avatar_url, account_role, role_id, created_at, roles(id, name, permissions)")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET /api/users] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requirePermission("manage_users");
    const body = await req.json().catch(() => ({}));
    const { email, name, password, role_id } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Email, name, and password are required" },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please add it to your environment variables." },
        { status: 500 }
      );
    }

    const admin = adminClient();

    // 1. Create the user in auth.users
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
      },
    });

    if (authError || !authData?.user) {
      console.error("[POST /api/users] auth.createUser error:", authError);
      return NextResponse.json(
        { error: authError?.message || "Failed to create authentication user" },
        { status: 400 }
      );
    }

    const newUserId = authData.user.id;

    // 2. The database trigger automatically bootstraps a new personal account + profile row.
    // We fetch this auto-created profile to get its temporary account_id.
    const { data: tempProfile, error: profileFetchErr } = await admin
      .from("profiles")
      .select("account_id")
      .eq("user_id", newUserId)
      .maybeSingle();

    if (profileFetchErr) {
      console.error("[POST /api/users] fetch temp profile error:", profileFetchErr);
    }

    const tempAccountId = tempProfile?.account_id;

    // 3. Re-scope the profile to join the admin's account and set the custom role_id.
    const { error: profileUpdateErr } = await admin
      .from("profiles")
      .update({
        account_id: ctx.accountId,
        account_role: "agent", // Standard member
        role_id: role_id || null,
        full_name: name,
      })
      .eq("user_id", newUserId);

    if (profileUpdateErr) {
      console.error("[POST /api/users] profile update error:", profileUpdateErr);
    }

    // 4. Delete the temporary personal account created by the trigger.
    if (tempAccountId && tempAccountId !== ctx.accountId) {
      const { error: accountDeleteErr } = await admin
        .from("accounts")
        .delete()
        .eq("id", tempAccountId);

      if (accountDeleteErr) {
        console.error("[POST /api/users] delete temp account error:", accountDeleteErr);
      }
    }

    // Fetch the newly compiled user profile to return
    const { data: finalUser } = await admin
      .from("profiles")
      .select("id, user_id, full_name, email, avatar_url, account_role, role_id, created_at, roles(id, name, permissions)")
      .eq("user_id", newUserId)
      .single();

    return NextResponse.json({ user: finalUser });
  } catch (err) {
    return toErrorResponse(err);
  }
}
