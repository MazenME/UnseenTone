"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";

interface ThemeEntry {
  id: string;
  label: string;
  colors: { bg: string; accent: string; fg: string };
  isCustom?: boolean;
}

const BUILTIN_THEMES: ThemeEntry[] = [
  {
    id: "the-void",
    label: "The Void",
    colors: { bg: "#09090b", accent: "#7e22ce", fg: "#e5e5e5" },
  },
  {
    id: "parchment",
    label: "Parchment",
    colors: { bg: "#f4f1ea", accent: "#78350f", fg: "#2c241b" },
  },
  {
    id: "blood-moon",
    label: "Blood Moon",
    colors: { bg: "#150f0f", accent: "#991b1b", fg: "#d1d5db" },
  },
  {
    id: "abyssal-sea",
    label: "Abyssal Sea",
    colors: { bg: "#020617", accent: "#0891b2", fg: "#cbd5e1" },
  },
  {
    id: "ashen-ruins",
    label: "Ashen Ruins",
    colors: { bg: "#1c1917", accent: "#9a3412", fg: "#d6d3d1" },
  },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [allThemes, setAllThemes] = useState<ThemeEntry[]>(BUILTIN_THEMES);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load custom themes only when user is logged in
  useEffect(() => {
    if (!user) {
      // Not logged in → only builtin themes
      setAllThemes(BUILTIN_THEMES);

      // Remove injected custom theme CSS
      const styleEl = document.getElementById("custom-themes-css");
      if (styleEl) styleEl.textContent = "";

      // If current theme is a custom one, fall back to default
      if (theme && !BUILTIN_THEMES.some((t) => t.id === theme)) {
        setTheme("the-void");
      }
      return;
    }

    const supabase = createClient();
    supabase
      .from("custom_themes")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const custom: ThemeEntry[] = data.map((t) => ({
            id: t.name,
            label: t.label,
            colors: { bg: t.bg, accent: t.accent, fg: t.fg },
            isCustom: true,
          }));

          setAllThemes([...BUILTIN_THEMES, ...custom]);

          // Inject CSS custom properties for each custom theme
          let styleEl = document.getElementById("custom-themes-css");
          if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "custom-themes-css";
            document.head.appendChild(styleEl);
          }

          const css = data
            .map(
              (t) => `[data-theme="${t.name}"] {
  --bg: ${t.bg};
  --bg-secondary: ${t.bg_secondary};
  --fg: ${t.fg};
  --fg-muted: ${t.fg_muted};
  --accent: ${t.accent};
  --accent-hover: ${t.accent_hover};
  --border-color: ${t.border_color};
  --surface: ${t.surface};
  --content-text: ${t.content_text};
  --content-heading: ${t.content_heading};
  --content-link: ${t.content_link};
  color-scheme: ${t.color_scheme};
}`
            )
            .join("\n");

          styleEl.textContent = css;
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-surface border border-border animate-pulse" />
    );
  }

  const currentTheme = allThemes.find((t) => t.id === theme) || allThemes[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:border-accent/50 transition-all group"
        aria-label="Change theme"
      >
        {/* Color preview dot */}
        <motion.div
          key={currentTheme.id}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-5 h-5 rounded-full border-2 border-fg/20"
          style={{ backgroundColor: currentTheme.colors.accent }}
        />
        <span className="text-sm text-fg-muted group-hover:text-fg transition-colors hidden sm:block">
          {currentTheme.label}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto"
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium text-fg-muted uppercase tracking-wider">Theme</p>
              </div>

              <div className="p-1.5">
                {allThemes.map((t) => {
                  const isActive = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${
                        isActive
                          ? "text-fg"
                          : "text-fg-muted hover:text-fg hover:bg-bg-secondary"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="theme-active-bg"
                          className="absolute inset-0 bg-accent/10 border border-accent/20 rounded-lg"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                        />
                      )}

                      {/* Color swatch row */}
                      <div className="relative z-10 flex items-center gap-1.5">
                        <div
                          className="w-4 h-4 rounded-full border border-fg/10"
                          style={{ backgroundColor: t.colors.bg }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-fg/10"
                          style={{ backgroundColor: t.colors.accent }}
                        />
                      </div>

                      <span className="relative z-10 flex-1 text-left">
                        {t.label}
                        {t.isCustom && (
                          <span className="ml-1 text-[10px] text-accent/60 uppercase">custom</span>
                        )}
                      </span>

                      {isActive && (
                        <motion.svg
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-4 h-4 text-accent relative z-10"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </motion.svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
