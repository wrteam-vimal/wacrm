import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    logger.info("DIAGNOSTIC", "Starting diagnostic and auto-repair run...");
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get all auth users
    const { data: authUsersData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;
    const authUsers = authUsersData?.users || [];

    // 2. Get all profiles
    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("*");

    if (pError) throw pError;

    // 3. Get all accounts
    const { data: accounts, error: aError } = await supabase
      .from("accounts")
      .select("*");

    if (aError) throw aError;

    logger.info("DIAGNOSTIC", `Auth users: ${authUsers.length}, Profiles found: ${profiles.length}, Accounts found: ${accounts.length}`);

    let repaired = [];

    // 4. First, repair users who have an auth account but no profile row at all
    for (const u of authUsers) {
      const existingProfile = profiles.find(p => p.user_id === u.id);
      if (!existingProfile) {
        logger.info("DIAGNOSTIC", `User ${u.email} (${u.id}) has no profile row. Bootstrapping account and profile...`);

        // Check if an account owned by this user already exists
        let acc = accounts.find(a => a.owner_user_id === u.id);
        if (!acc) {
          logger.info("DIAGNOSTIC", `Creating new account for owner User ID: ${u.id}`);
          const { data: newAcc, error: createError } = await supabase
            .from("accounts")
            .insert({
              name: u.user_metadata?.full_name || u.email?.split("@")[0] || "My Account",
              owner_user_id: u.id
            })
            .select("id")
            .single();

          if (createError) {
            logger.error("DIAGNOSTIC", `Failed to create account for user: ${u.email}`, createError);
            repaired.push({ email: u.email, status: `Failed to create account: ${createError.message}` });
            continue;
          }
          acc = newAcc;
        }

        // Create profile
        logger.info("DIAGNOSTIC", `Creating profile for user ${u.email} linking to account ${acc.id}`);
        const { error: profileCreateError } = await supabase
          .from("profiles")
          .insert({
            user_id: u.id,
            full_name: u.user_metadata?.full_name || u.email?.split("@")[0] || "My Account",
            email: u.email || "",
            account_id: acc.id,
            account_role: "owner"
          });

        if (profileCreateError) {
          logger.error("DIAGNOSTIC", `Failed to create profile for user: ${u.email}`, profileCreateError);
          repaired.push({ email: u.email, status: `Failed to create profile: ${profileCreateError.message}` });
        } else {
          logger.info("DIAGNOSTIC", `Successfully bootstrapped account and profile for user ${u.email}`);
          repaired.push({ email: u.email, status: "Successfully bootstrapped account and profile as owner" });
        }
      }
    }

    // 5. Find if there are profiles without an account, and repair them
    // Fetch profiles again in case we added some in step 4
    const { data: currentProfiles } = await supabase.from("profiles").select("*");
    const { data: currentAccounts } = await supabase.from("accounts").select("*");
    
    for (const p of currentProfiles || []) {
      if (!p.account_id) {
        logger.info("DIAGNOSTIC", `Found profile without account_id: ${p.email} (User ID: ${p.user_id})`);
        // Find if an account owned by this user already exists
        let acc = (currentAccounts || []).find(a => a.owner_user_id === p.user_id);
        
        if (!acc) {
          logger.info("DIAGNOSTIC", `Creating new account for owner User ID: ${p.user_id}`);
          // Create account
          const { data: newAcc, error: createError } = await supabase
            .from("accounts")
            .insert({
              name: p.full_name || p.email.split('@')[0] || "My Account",
              owner_user_id: p.user_id
            })
            .select("id")
            .single();
            
          if (createError) {
            logger.error("DIAGNOSTIC", `Failed to create account for user: ${p.email}`, createError);
            repaired.push({ email: p.email, status: `Failed to create account: ${createError.message}` });
            continue;
          }
          acc = newAcc;
        }

        logger.info("DIAGNOSTIC", `Linking profile ${p.email} to account ID: ${acc.id}`);
        // Link profile to account
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            account_id: acc.id,
            account_role: "owner"
          })
          .eq("id", p.id);

        if (updateError) {
          logger.error("DIAGNOSTIC", `Failed to update profile account_id for user: ${p.email}`, updateError);
          repaired.push({ email: p.email, status: `Failed to link: ${updateError.message}` });
        } else {
          logger.info("DIAGNOSTIC", `Successfully linked profile ${p.email} to account ID: ${acc.id} as owner.`);
          repaired.push({ email: p.email, status: "Successfully created account and linked as owner" });
        }
      }
    }

    // Re-fetch profiles and accounts after repair
    const { data: finalProfiles } = await supabase.from("profiles").select("*");
    const { data: finalAccounts } = await supabase.from("accounts").select("*");

    logger.info("DIAGNOSTIC", "Diagnostic and repair run completed successfully.");

    return NextResponse.json({
      success: true,
      message: "Diagnostics completed",
      repairedCount: repaired.length,
      repairLog: repaired,
      profiles: finalProfiles,
      accounts: finalAccounts
    });
  } catch (err: any) {
    logger.error("DIAGNOSTIC", "Diagnostic run failed", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Unknown error"
    }, { status: 500 });
  }
}
