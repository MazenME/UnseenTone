"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
  const signingOut = useRef(false);
  const supabase = createClient();

  const fetchProfile = useCallback(async (authUser: User, isNewSignup = false) => {
    // Don't fetch profile if we're in the middle of signing out
    if (signingOut.current) return null;

    let data: UserProfile | null = null;

    if (isNewSignup) {
      // For new signups, the DB trigger may not have fired yet — retry a few times
      let retries = 0;
      while (retries < 3) {
        if (signingOut.current) return null;
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

      if (Object.keys(updates).length > 0) {
        supabase.from("users_profile").update(updates).eq("id", authUser.id).then(() => {});
      }
    }

    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Use getUser() for secure server-validated session check
    const init = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      setUser(authUser);
      setLoading(false);

      if (authUser) {
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
        setProfile(null);
        setCachedProfile(null);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip processing if we're signing out — we handle that optimistically
      if (signingOut.current) return;

      const authUser = session?.user ?? null;
      setUser(authUser);
      setLoading(false);

      if (authUser) {
        const isNewSignup = event === "SIGNED_IN";
        const p = await fetchProfile(authUser, isNewSignup);
        if (p && !signingOut.current) {
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

  const signOut = useCallback(async () => {
    // Set signing out flag FIRST to prevent auth listener from re-fetching
    signingOut.current = true;

    // Clear state immediately for instant UI response
    setUser(null);
    setProfile(null);
    setCachedProfile(null);

    // Clear custom theme/font caches so they don't flash on re-login
    try {
      localStorage.removeItem("kathion-custom-themes-cache");
      localStorage.removeItem("kathion-custom-fonts-cache");
    } catch { /* empty */ }

    // Remove injected custom theme CSS and font links
    try {
      const styleEl = document.getElementById("custom-themes-css");
      if (styleEl) styleEl.textContent = "";
      document.querySelectorAll('link[id^="custom-font-"]').forEach((el) => el.remove());
    } catch { /* empty */ }

    // Fire-and-forget the actual sign out
    supabase.auth.signOut().finally(() => {
      signingOut.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user);
      if (p) {
        setProfile(p);
        setCachedProfile(p);
      }
    }
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
