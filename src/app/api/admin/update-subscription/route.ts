import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce strict server-side authentication and role check
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: Missing authorization header." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authErr } = await authClient.auth.getUser(token);

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized: Invalid or expired session." }, { status: 401 });
    }

    const { data: callerProfile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profErr || !callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Super administrator privileges required." }, { status: 403 });
    }

    const body = await req.json();
    const { userId, email, planId, months } = body;

    if (!userId && !email) {
      return NextResponse.json({ error: "userId or email is required." }, { status: 400 });
    }
    if (!planId) {
      return NextResponse.json({ error: "planId is required (free, standard, premium)." }, { status: 400 });
    }

    const durationMonths = parseInt(months, 10) || 0;
    let expiresAt: string | null = null;

    if (planId !== "free" && durationMonths > 0) {
      const now = new Date();
      // Add months safely
      now.setMonth(now.getMonth() + durationMonths);
      expiresAt = now.toISOString();
    }

    let query = supabaseAdmin.from("profiles").update({
      plan_id: planId,
      plan_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    if (userId) {
      query = query.eq("id", userId);
    } else {
      query = query.eq("email", email);
    }

    const { data, error } = await query.select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `User subscription updated to ${planId.toUpperCase()}${expiresAt ? ` valid until ${new Date(expiresAt).toLocaleDateString()}` : " (Permanent)"}`,
      profile: data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update subscription." }, { status: 500 });
  }
}
