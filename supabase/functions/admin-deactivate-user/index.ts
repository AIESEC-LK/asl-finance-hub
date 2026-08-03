// ── Supabase Edge Function: admin-deactivate-user ────────────────────────────
// Lets an mc_user block another user's sign-in without deleting their account.
// Uses Supabase Auth's native ban mechanism (enforced server-side by Auth
// itself, not just hidden in the UI) and mirrors the state into
// profiles.disabled so the /admin table can render it without a separate
// "list users" call.
//
// Deploy: npx supabase functions deploy admin-deactivate-user
//
// Flow:
//   1. Verify caller has a valid Supabase JWT
//   2. Confirm caller has mc_user role
//   3. Read { user_id }; guard against self-deactivation
//   4. Service-role client: ban the user, then set profiles.disabled = true
//   5. Return { ok: true }
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  // ── 3. Read target user_id; guard against self-deactivation ──────────────
  const body = await req.json();
  const targetUserId = body.user_id as string | undefined;
  if (!targetUserId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing user_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (targetUserId === user.id) {
    return new Response(
      JSON.stringify({ ok: false, error: "Cannot deactivate your own account" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── 4. Service-role client: ban + mirror into profiles.disabled ──────────
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error: banError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    ban_duration: "876000h",
  });
  if (banError) {
    return new Response(JSON.stringify({ ok: false, error: banError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ disabled: true })
    .eq("user_id", targetUserId);
  if (profileError) {
    return new Response(JSON.stringify({ ok: false, error: profileError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 5. Done ────────────────────────────────────────────────────────────
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
