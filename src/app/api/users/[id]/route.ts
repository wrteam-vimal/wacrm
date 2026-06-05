import { requirePermission, toErrorResponse } from "@/lib/auth/account";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission("manage_users");
    const { id: userId } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, role_id, password } = body;

    const admin = adminClient();

    // 1. If password is provided, update it in auth.users
    if (password && password.trim() !== "") {
      const { error: authError } = await admin.auth.admin.updateUserById(userId, {
        password: password,
      });
      if (authError) {
        console.error("[PATCH /api/users/[id]] auth update error:", authError);
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    // 2. Update profile name and role_id
    const updateData: Record<string, any> = {};
    if (name !== undefined) {
      updateData.full_name = name.trim();
    }
    if (role_id !== undefined) {
      updateData.role_id = role_id || null;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await admin
        .from("profiles")
        .update(updateData)
        .eq("user_id", userId)
        .eq("account_id", ctx.accountId);

      if (profileError) {
        console.error("[PATCH /api/users/[id]] profile update error:", profileError);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }

    // Fetch and return the updated user profile
    const { data: updatedUser } = await admin
      .from("profiles")
      .select("id, user_id, full_name, email, avatar_url, account_role, role_id, created_at, roles(id, name, permissions)")
      .eq("user_id", userId)
      .single();

    return NextResponse.json({ user: updatedUser });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission("manage_users");
    const { id: userId } = await params;

    // Prevent a user from deleting themselves
    if (userId === ctx.userId) {
      return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
    }

    // Fetch the target user's profile to make sure they belong to the same account
    const { data: targetProfile, error: fetchErr } = await ctx.supabase
      .from("profiles")
      .select("account_id, account_role")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: "User not found or inaccessible" }, { status: 404 });
    }

    if (targetProfile.account_id !== ctx.accountId) {
      return NextResponse.json({ error: "Unauthorized access to this user" }, { status: 403 });
    }

    if (targetProfile.account_role === "owner") {
      return NextResponse.json({ error: "You cannot delete the account owner" }, { status: 400 });
    }

    const admin = adminClient();

    // Delete the user from auth.users (cascades to profiles)
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);

    if (deleteErr) {
      console.error("[DELETE /api/users/[id]] error:", deleteErr);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
