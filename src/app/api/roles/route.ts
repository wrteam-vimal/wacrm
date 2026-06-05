import { requirePermission, toErrorResponse } from "@/lib/auth/account";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Accessible by anyone who can manage roles OR manage users (to fill selection lists)
    let ctx;
    try {
      ctx = await requirePermission("manage_roles");
    } catch {
      ctx = await requirePermission("manage_users");
    }

    const { data, error } = await ctx.supabase
      .from("roles")
      .select("id, name, permissions, created_at")
      .eq("account_id", ctx.accountId)
      .order("name", { ascending: true });

    if (error) {
      console.error("[GET /api/roles] fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ roles: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requirePermission("manage_roles");
    const body = await req.json().catch(() => ({}));
    const { name, permissions } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("roles")
      .insert({
        account_id: ctx.accountId,
        name: name.trim(),
        permissions: permissions || {},
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/roles] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ role: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
