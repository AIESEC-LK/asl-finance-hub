// ── Supabase Edge Function: admin-reset-password ────────────────────────────
// Lets an mc_user reset another user's password to a random temp value,
// with no email involved (free-tier auth email quota is 2/hour, unusable
// for this). The admin relays the returned temp password to the user
// out-of-band (Slack/WhatsApp/in person); the user changes it themselves
// via /account after logging in.
//
// Deploy: npx supabase functions deploy admin-reset-password
//
// Flow:
//   1. Verify caller has a valid Supabase JWT
//   2. Confirm caller has mc_user role
//   3. Generate a random temp password
//   4. Service-role client: auth.admin.updateUserById(user_id, { password })
//   5. Return { ok: true, tempPassword }
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // ── 1. Authenticate: require a valid Supabase JWT ────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Missing auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 2. Authorise: caller must have mc_user role ───────────────────────────
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

  const isMC = (roles ?? []).some((r: { role: string }) => r.role === "mc_user");
  if (!isMC) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden — MC role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 3. Read target user_id ────────────────────────────────────────────────
  const body = await req.json();
  const targetUserId = body.user_id as string | undefined;
  if (!targetUserId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing user_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 4. Service-role client: reset the password ────────────────────────────
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tempPassword = generateTempPassword();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    password: tempPassword,
  });

  if (updateError) {
    return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 5. Return the temp password (shown once, admin relays it manually) ───
  return new Response(JSON.stringify({ ok: true, tempPassword }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
