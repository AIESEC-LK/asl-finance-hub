import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
});

function ChangePasswordCard() {
  const { user, profile, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (newPassword !== confirmPassword) {
      setErr("New passwords do not match");
      return;
    }
    if (!user?.email) {
      setErr("No email on this account");
      return;
    }
    setLoading(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        setErr("Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      if (profile?.must_change_password) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("user_id", user.id);
        await refresh();
      }
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label>Current password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EditNameCard() {
  const { user, profile, refresh } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("user_id", user.id);
      if (error) throw error;
      await refresh();
      toast.success("Name updated");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not update name");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save name"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountPage() {
  const { profile } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">Manage your profile and password.</p>
      </div>
      {profile?.must_change_password && (
        <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm">
          Your password was reset by an admin — please set a new one below.
        </div>
      )}
      <EditNameCard />
      <ChangePasswordCard />
    </div>
  );
}
