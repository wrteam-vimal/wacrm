import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    logger.info("CACHE_CLEAR", "Initiating server-side Next.js cache revalidation...");
    
    // Purge all Next.js Server-side App Router caches globally
    revalidatePath("/", "layout");
    
    logger.info("CACHE_CLEAR", "Server-side cache revalidated successfully.");
    return NextResponse.json({ success: true, message: "Next.js cache revalidated successfully" });
  } catch (err: any) {
    logger.error("CACHE_CLEAR", "Failed to clear server-side cache", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to clear cache" }, { status: 500 });
  }
}
