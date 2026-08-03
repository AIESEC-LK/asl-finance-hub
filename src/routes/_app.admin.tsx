import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchEntities, type Entity } from "@/lib/finance";
import { useAuth, type AppRole } from "@/lib/auth";
import { useSheetSync, type SyncMode } from "@/hooks/useSheetSync";
import { useAuditSync } from "@/hooks/useAuditSync";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  KeyRound,
  Trash2,
  Copy,
  UserX,
  UserCheck,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id);
    const isMC = (roles ?? []).some((r) => r.role === "mc_user");
    if (!isMC) throw redirect({ to: "/overview" });
  },
  component: AdminPage,
});

interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  entity_id: string | null;
  role: AppRole | null;
  disabled: boolean;
}

type PendingAction =
  | { type: "deactivate"; user: UserRow }
  | { type: "reactivate"; user: UserRow }
  | { type: "delete"; user: UserRow }
  | { type: "reset"; user: UserRow };

function AdminPage() {
  const { user } = useAuth();
  const { sync, loading, result, error } = useSheetSync();
  const {
    sync: syncAudit,
    loading: auditLoading,
    result: auditResult,
    error: auditError,
  } = useAuditSync();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [editingName, setEditingName] = useState<{ uid: string; value: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [tempPasswordFor, setTempPasswordFor] = useState<{
    name: string;
    password: string;
  } | null>(null);

  const load = async () => {
    setPageLoading(true);
    const [e, p, r] = await Promise.all([
      fetchEntities(),
      supabase.from("profiles").select("user_id,full_name,email,entity_id,disabled"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setEntities(e);
    const profiles = (p.data ?? []) as {
      user_id: string;
      full_name: string | null;
      email: string | null;
      entity_id: string | null;
      disabled: boolean;
    }[];
    const rolesByUser = new Map<string, AppRole>();
    ((r.data ?? []) as { user_id: string; role: AppRole }[]).forEach((x) =>
      rolesByUser.set(x.user_id, x.role),
    );
    setUsers(profiles.map((p) => ({ ...p, role: rolesByUser.get(p.user_id) ?? null })));
    setPageLoading(false);
  };

  const TERMS = ["24-25", "25-26", "26-27"]; // append each new term here annually
  const [syncMode, setSyncMode] = useState<SyncMode>("current");
  const [syncTerm, setSyncTerm] = useState<string>(TERMS[TERMS.length - 1]);

  useEffect(() => {
    load();
  }, []);

  const handleSync = async () => {
    await sync({ mode: syncMode, term: syncMode === "term" ? syncTerm : undefined });
  };

  const setRole = async (uid: string, role: AppRole) => {
    // Remove existing roles, then insert new
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) toast.error(error.message);
    else {
      toast.success("Role updated");
      load();
    }
  };

  const setEntity = async (uid: string, entity_id: string | null) => {
    const { error } = await supabase.from("profiles").update({ entity_id }).eq("user_id", uid);
    if (error) toast.error(error.message);
    else {
      toast.success("Entity updated");
      load();
    }
  };

  const saveName = async (uid: string, full_name: string) => {
    const { error } = await supabase.from("profiles").update({ full_name }).eq("user_id", uid);
    if (error) toast.error(error.message);
    else {
      toast.success("Name updated");
      setEditingName(null);
      load();
    }
  };

  const callAdminFn = async (fnName: string, payload: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; [k: string]: unknown };
    if (!data.ok) throw new Error(data.error ?? "Request failed");
    return data;
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    const { type, user: u } = pendingAction;
    setActionLoading(true);
    try {
      switch (type) {
        case "deactivate":
          await callAdminFn("admin-deactivate-user", { user_id: u.user_id });
          toast.success("User deactivated");
          setPendingAction(null);
          load();
          break;
        case "reactivate":
          await callAdminFn("admin-reactivate-user", { user_id: u.user_id });
          toast.success("User reactivated");
          setPendingAction(null);
          load();
          break;
        case "delete":
          await callAdminFn("admin-delete-user", { user_id: u.user_id });
          toast.success("User deleted");
          setPendingAction(null);
          load();
          break;
        case "reset": {
          const data = await callAdminFn("admin-reset-password", { user_id: u.user_id });
          setPendingAction(null);
          setTempPasswordFor({
            name: u.full_name ?? u.email ?? "user",
            password: data.tempPassword as string,
          });
          break;
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const ACTION_COPY: Record<
    PendingAction["type"],
    {
      title: string;
      description: (name: string) => string;
      confirmLabel: string;
      destructive: boolean;
    }
  > = {
    deactivate: {
      title: "Deactivate user?",
      description: (name) => `${name} won't be able to log in until reactivated.`,
      confirmLabel: "Deactivate",
      destructive: true,
    },
    reactivate: {
      title: "Reactivate user?",
      description: (name) =>
        `This will restore ${name}'s access — they'll be able to log in again.`,
      confirmLabel: "Reactivate",
      destructive: false,
    },
    delete: {
      title: "Delete user?",
      description: (name) =>
        `This will permanently and irreversibly delete ${name}'s account. This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    },
    reset: {
      title: "Reset password?",
      description: (name) =>
        `This will set a new temporary password for ${name} and require them to change it on next login. Continue?`,
      confirmLabel: "Reset password",
      destructive: false,
    },
  };

  const visibleUsers = showDeactivated ? users : users.filter((u) => !u.disabled);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Admin — Users &amp; Roles</h2>
        <p className="text-sm text-muted-foreground">
          Assign roles and entities. Only MC users see this page.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">All users ({visibleUsers.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="show-deactivated"
              checked={showDeactivated}
              onCheckedChange={setShowDeactivated}
            />
            <Label htmlFor="show-deactivated" className="text-sm font-normal">
              Show deactivated users
            </Label>
          </div>
        </CardHeader>
        <CardContent>
          {pageLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Entity (LC only)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsers.map((u) => (
                  <TableRow key={u.user_id} className={u.disabled ? "opacity-60" : undefined}>
                    <TableCell>
                      {editingName?.uid === u.user_id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-8 w-36"
                            value={editingName.value}
                            onChange={(e) =>
                              setEditingName({ uid: u.user_id, value: e.target.value })
                            }
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => saveName(u.user_id, editingName.value)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => setEditingName(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() =>
                            setEditingName({ uid: u.user_id, value: u.full_name ?? "" })
                          }
                        >
                          {u.full_name ?? "—"}
                        </button>
                      )}
                      {u.user_id === user?.id && (
                        <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                      )}
                      {u.disabled && (
                        <span className="ml-1 text-xs font-medium text-muted-foreground">
                          (Deactivated)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role ?? ""}
                        onValueChange={(v) => setRole(u.user_id, v as AppRole)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="No role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lc_user">LC user</SelectItem>
                          <SelectItem value="mc_user">MC user</SelectItem>
                          <SelectItem value="efb_user">EFB user</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.entity_id ?? "none"}
                        onValueChange={(v) => setEntity(u.user_id, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {entities.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setPendingAction({ type: "reset", user: u })}
                        >
                          <KeyRound className="mr-1 h-3 w-3" />
                          Reset password
                        </Button>
                        {u.disabled ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => setPendingAction({ type: "reactivate", user: u })}
                            >
                              <UserCheck className="mr-1 h-3 w-3" />
                              Reactivate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-destructive hover:text-destructive"
                              onClick={() => setPendingAction({ type: "delete", user: u })}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Delete
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => setPendingAction({ type: "deactivate", user: u })}
                            disabled={u.user_id === user?.id}
                          >
                            <UserX className="mr-1 h-3 w-3" />
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          {pendingAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{ACTION_COPY[pendingAction.type].title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {ACTION_COPY[pendingAction.type].description(
                    pendingAction.user.full_name ?? pendingAction.user.email ?? "this user",
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    runPendingAction();
                  }}
                  disabled={actionLoading}
                  className={
                    ACTION_COPY[pendingAction.type].destructive
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                >
                  {actionLoading ? "Working…" : ACTION_COPY[pendingAction.type].confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!tempPasswordFor} onOpenChange={(open) => !open && setTempPasswordFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password for {tempPasswordFor?.name}</DialogTitle>
            <DialogDescription>
              Shown once — relay this to the user directly (Slack/WhatsApp/in person). They should
              log in with it and change it via their Account page.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
            <span className="flex-1 select-all">{tempPasswordFor?.password}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (tempPasswordFor) {
                  navigator.clipboard.writeText(tempPasswordFor.password);
                  toast.success("Copied to clipboard");
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPasswordFor(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Sheets Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Triggers AppScript to refresh the master sheet, then pulls data into Supabase.
          </p>

          {/* Sync mode selector */}
          <div className="flex gap-2">
            {(["current", "term", "all"] as SyncMode[]).map((m) => (
              <Button
                key={m}
                variant={syncMode === m ? "default" : "outline"}
                size="sm"
                onClick={() => setSyncMode(m)}
              >
                {m === "current" ? "Current Month" : m === "term" ? "By Term" : "Sync All"}
              </Button>
            ))}
          </div>

          {/* Term selector — only when mode is "term" */}
          {syncMode === "term" && (
            <Select value={syncTerm} onValueChange={setSyncTerm}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button onClick={handleSync} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Syncing…
              </>
            ) : (
              "Run Sync"
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex gap-2 items-start">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <AlertDescription className="font-semibold">{result.message}</AlertDescription>
                  {result.webhookRows != null && (
                    <AlertDescription className="text-xs">
                      Sheet rows refreshed: {result.webhookRows}
                    </AlertDescription>
                  )}
                  {result.metricsInserted > 0 && (
                    <AlertDescription className="text-xs">
                      {result.metricsInserted} metrics · {result.revenueInserted} revenue ·{" "}
                      {result.costInserted} cost entries
                    </AlertDescription>
                  )}
                  {(result.webhookWarnings ?? []).length > 0 && (
                    <AlertDescription className="text-xs text-yellow-600">
                      Warnings: {result.webhookWarnings!.join("; ")}
                    </AlertDescription>
                  )}
                  {result.errors.length > 0 && (
                    <AlertDescription className="text-xs">
                      {result.errors.length} error(s): {result.errors.join("; ")}
                    </AlertDescription>
                  )}
                </div>
              </div>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">EFB Audit Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Rebuilds the audit master sheet from the EFB Audit Performance Dashboard, then pulls
            results &amp; scores into Supabase.
          </p>

          <Button onClick={() => syncAudit()} disabled={auditLoading} className="w-full">
            {auditLoading ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Syncing audits…
              </>
            ) : (
              "Run Audit Sync"
            )}
          </Button>

          {auditResult && (
            <Alert variant={auditResult.success ? "default" : "destructive"}>
              <div className="flex gap-2 items-start">
                {auditResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <AlertDescription className="font-semibold">
                    {auditResult.message}
                  </AlertDescription>
                  {auditResult.webhookRows != null && (
                    <AlertDescription className="text-xs">
                      Sheet rows refreshed: {auditResult.webhookRows}
                    </AlertDescription>
                  )}
                  {auditResult.scoresInserted > 0 && (
                    <AlertDescription className="text-xs">
                      {auditResult.scoresInserted} audit score rows
                    </AlertDescription>
                  )}
                  {(auditResult.webhookWarnings ?? []).length > 0 && (
                    <AlertDescription className="text-xs text-yellow-600">
                      Warnings: {auditResult.webhookWarnings!.join("; ")}
                    </AlertDescription>
                  )}
                  {auditResult.errors.length > 0 && (
                    <AlertDescription className="text-xs">
                      {auditResult.errors.length} error(s): {auditResult.errors.join("; ")}
                    </AlertDescription>
                  )}
                </div>
              </div>
            </Alert>
          )}

          {auditError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{auditError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How invites work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            New users sign up themselves at the login page. After signup they appear here with no
            role — assign them an LC/MC/EFB role and (for LC) an entity.
          </p>
          <Button variant="outline" onClick={load}>
            Refresh list
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
