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

const PROFILE_CACHE_KEY = "kathion-profile-cache";

function getCachedProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
}

function setCachedProfile(profile: UserProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch { /* empty */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(getCachedProfile);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = useCallback(async (authUser: User, isNewSignup = false) => {
    let data: UserProfile | null = null;

    if (isNewSignup) {
      // For new signups, the DB trigger may not have fired yet — retry a few times
      let retries = 0;
      while (retries < 3) {
        const { data: row } = await supabase
          .from("users_profile")
          .select("id, email, display_name, avatar_url, role, is_banned")
          .eq("id", authUser.id)
          .single();
        if (row) { data = row as UserProfile; break; }
        retries++;
        await new Promise((r) => setTimeout(r, 500));
      }
    } else {
      // Normal load — single fast query, no retries
      const { data: row } = await supabase
        .from("users_profile")
        .select("id, email, display_name, avatar_url, role, is_banned")
        .eq("id", authUser.id)
        .single();
      data = row as UserProfile | null;
    }

    if (data) {
      const meta = authUser.user_metadata;
      const updates: Record<string, string> = {};

      if (!data.display_name) {
        const derivedName =
          meta?.full_name || meta?.name || meta?.preferred_username || authUser.email?.split("@")[0] || "Reader";
        data.display_name = derivedName;
        updates.display_name = derivedName;
      }

      if (!data.avatar_url) {
        const derivedAvatar = meta?.avatar_url || meta?.picture || null;
        if (derivedAvatar) {
          data.avatar_url = derivedAvatar;
          updates.avatar_url = derivedAvatar;
        }
      }

      // Single update call if needed (instead of two sequential)
      if (Object.keys(updates).length > 0) {
        supabase.from("users_profile").update(updates).eq("id", authUser.id).then(() => {});
      }
    }

    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authUser = session?.user ?? null;
      setUser(authUser);
      // Show user immediately — profile loads in background
      setLoading(false);

      if (authUser) {
        // If we have a cached profile for this user, use it instantly
        const cached = getCachedProfile();
        if (cached && cached.id === authUser.id) {
          setProfile(cached);
        }
        // Then refresh from DB in background
        const p = await fetchProfile(authUser);
        if (p) {
          setProfile(p);
          setCachedProfile(p);
        }
      } else {
        // No user — clear cached profile
        setProfile(null);
        setCachedProfile(null);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      setLoading(false);

      if (authUser) {
        const isNewSignup = _event === "SIGNED_IN";
        const p = await fetchProfile(authUser, isNewSignup);
        if (p) {
          setProfile(p);
          setCachedProfile(p);
        }
      } else {
        setProfile(null);
        setCachedProfile(null);
      }
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
    setCachedProfile(null);
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
