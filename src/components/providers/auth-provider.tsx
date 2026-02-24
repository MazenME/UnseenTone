"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "reader" | "admin";
  is_banned: boolean;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = useCallback(async (authUser: User) => {
    // Small delay to allow the DB trigger to create the profile row
    // (relevant for brand-new signups where the trigger may not have fired yet)
    let retries = 0;
    let data: UserProfile | null = null;

    while (retries < 3) {
      const { data: row } = await supabase
        .from("users_profile")
        .select("id, email, display_name, avatar_url, role, is_banned")
        .eq("id", authUser.id)
        .single();

      if (row) {
        data = row as UserProfile;
        break;
      }

      retries++;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (data) {
      // If display_name is still null/empty, derive it from auth metadata
      if (!data.display_name) {
        const meta = authUser.user_metadata;
        const derivedName =
          meta?.full_name || meta?.name || meta?.preferred_username || authUser.email?.split("@")[0] || "Reader";

        // Update the DB so it persists
        await supabase
          .from("users_profile")
          .update({ display_name: derivedName })
          .eq("id", authUser.id);

        data.display_name = derivedName;
      }

      // Same for avatar
      if (!data.avatar_url) {
        const meta = authUser.user_metadata;
        const derivedAvatar = meta?.avatar_url || meta?.picture || null;
        if (derivedAvatar) {
          await supabase
            .from("users_profile")
            .update({ avatar_url: derivedAvatar })
            .eq("id", authUser.id);
          data.avatar_url = derivedAvatar;
        }
      }
    }

    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authUser = session?.user ?? null;
      setUser(authUser);

      if (authUser) {
        const p = await fetchProfile(authUser);
        setProfile(p);
      }

      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);

      if (authUser) {
        const p = await fetchProfile(authUser);
        setProfile(p);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user);
      setProfile(p);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
