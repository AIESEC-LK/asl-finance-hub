// ── Supabase Edge Function: admin-delete-user ────────────────────────────────
// Lets an mc_user permanently (hard) delete another user's auth account, but
// only once that user has already been deactivated (see admin-deactivate-user)
// — a deliberate two-step "deactivate, then delete" flow rather than a
// one-click irreversible action. profiles.user_id and user_roles.user_id are
// ON DELETE CASCADE to auth.users(id), so no orphan rows need manual cleanup.
//
// Deploy: npx supabase functions deploy admin-delete-user
//
// Flow:
//   1. Verify caller has a valid Supabase JWT
//   2. Confirm caller has mc_user role
//   3. Read { user_id }; guard against self-deletion
//   4. Guard: target must already have profiles.disabled = true
//   5. Service-role client: auth.admin.deleteUser(user_id) — hard delete
//   6. Return { ok: true }
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

  // ── 3. Read target user_id; guard against self-deletion ──────────────────
  const body = await req.json();
  const targetUserId = body.user_id as string | undefined;
  if (!targetUserId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing user_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (targetUserId === user.id) {
    return new Response(JSON.stringify({ ok: false, error: "Cannot delete your own account" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 4. Service-role client: require the target already be deactivated ────
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: targetProfile, error: profileLookupError } = await adminClient
    .from("profiles")
    .select("disabled")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (profileLookupError) {
    return new Response(JSON.stringify({ ok: false, error: profileLookupError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!targetProfile?.disabled) {
    return new Response(
      JSON.stringify({ ok: false, error: "Deactivate this user before deleting" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── 5. Hard delete ─────────────────────────────────────────────────────
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);

  if (deleteError) {
    return new Response(JSON.stringify({ ok: false, error: deleteError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 5. Done ────────────────────────────────────────────────────────────
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
