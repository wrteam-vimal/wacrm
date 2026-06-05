import { requirePermission, toErrorResponse } from "@/lib/auth/account";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission("manage_roles");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, permissions } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "Role name cannot be empty" }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (permissions !== undefined) {
      updateData.permissions = permissions;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No changes specified" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("roles")
      .update(updateData)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select()
      .single();

    if (error) {
      console.error("[PATCH /api/roles/[id]] update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ role: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission("manage_roles");
    const { id } = await params;

    const { error } = await ctx.supabase
      .from("roles")
      .delete()
      .eq("id", id)
      .eq("account_id", ctx.accountId);

    if (error) {
      console.error("[DELETE /api/roles/[id]] delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
