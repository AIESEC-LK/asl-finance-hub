import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "lc_user" | "mc_user" | "efb_user";

export interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  entity_id: string | null;
}

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isLC: boolean;
  isMC: boolean;
  isEFB: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,email,entity_id").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as Profile | null);
    setRoles(((rs as { role: AppRole }[] | null) ?? []).map((r) => r.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => loadUserData(session.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) await loadUserData(session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        roles,
        loading,
        isLC: roles.includes("lc_user"),
        isMC: roles.includes("mc_user"),
        isEFB: roles.includes("efb_user"),
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
