"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export interface ReaderSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  maxWidth: number;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  lineHeight: 1.8,
  maxWidth: 720,
};

interface FontOption {
  id: string;
  label: string;
  value: string;
}

const BUILTIN_FONTS: FontOption[] = [
  { id: "sans", label: "Sans-Serif", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { id: "serif", label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Monospace", value: "var(--font-geist-mono), 'Courier New', monospace" },
];

const STORAGE_KEY = "unseen-tone-reader-settings";

function loadSettings(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch { /* empty */ }
  return DEFAULT_SETTINGS;
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setMounted(true);
  }, []);

  const updateSettings = useCallback((updates: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* empty */ }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)); } catch { /* empty */ }
  }, []);

  return { settings, updateSettings, resetSettings, mounted };
}

interface ReaderControlsProps {
  settings: ReaderSettings;
  updateSettings: (updates: Partial<ReaderSettings>) => void;
  resetSettings: () => void;
}

export default function ReaderControls({ settings, updateSettings, resetSettings }: ReaderControlsProps) {
  const [open, setOpen] = useState(false);
  const [allFonts, setAllFonts] = useState<FontOption[]>(BUILTIN_FONTS);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("custom_fonts")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const custom: FontOption[] = data.map((f) => ({
            id: `custom-${f.id}`,
            label: f.name,
            value: f.font_family,
          }));
          setAllFonts([...BUILTIN_FONTS, ...custom]);

          // Load Google Fonts / external font URLs
          data.forEach((f) => {
            if (f.font_url) {
              const linkId = `custom-font-${f.id}`;
              if (!document.getElementById(linkId)) {
                const link = document.createElement("link");
                link.id = linkId;
                link.rel = "stylesheet";
                link.href = f.font_url;
                document.head.appendChild(link);
              }
            }
          });
        }
      });
  }, []);

  // Dynamic grid columns: 3 for built-in only, otherwise auto
  const gridCols = allFonts.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:border-accent/50 transition-all"
        aria-label="Reader settings"
      >
        <svg className="w-5 h-5 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
        <span className="text-sm text-fg-muted hidden sm:block">Reading</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-xl shadow-xl z-50 p-4 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-fg">Reader Settings</h4>
                <button
                  onClick={resetSettings}
                  className="text-xs text-fg-muted hover:text-accent transition-colors"
                >
                  Reset
                </button>
              </div>

              {/* Font Size */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-fg-muted">Font Size</label>
                  <span className="text-xs text-fg font-mono">{settings.fontSize}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-bg border border-border text-fg-muted hover:text-fg hover:border-accent/50 transition-colors text-sm"
                  >
                    A
                  </button>
                  <input
                    type="range"
                    min={12}
                    max={28}
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                    className="flex-1 accent-accent h-1.5"
                  />
                  <button
                    onClick={() => updateSettings({ fontSize: Math.min(28, settings.fontSize + 1) })}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-bg border border-border text-fg-muted hover:text-fg hover:border-accent/50 transition-colors text-lg font-bold"
                  >
                    A
                  </button>
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="text-xs text-fg-muted mb-2 block">Font Family</label>
                <div className={`grid ${gridCols} gap-1.5`}>
                  {allFonts.map((font) => {
                    const isActive = settings.fontFamily === font.value;
                    return (
                      <button
                        key={font.id}
                        onClick={() => updateSettings({ fontFamily: font.value })}
                        className={`px-2 py-1.5 text-xs rounded-md border transition-colors truncate ${
                          isActive
                            ? "bg-accent/15 border-accent/30 text-fg"
                            : "bg-bg border-border text-fg-muted hover:text-fg hover:border-accent/30"
                        }`}
                        style={{ fontFamily: font.value }}
                        title={font.label}
                      >
                        {font.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Line Height */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-fg-muted">Line Spacing</label>
                  <span className="text-xs text-fg font-mono">{settings.lineHeight.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={1.2}
                  max={2.4}
                  step={0.1}
                  value={settings.lineHeight}
                  onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) })}
                  className="w-full accent-accent h-1.5"
                />
              </div>

              {/* Content Width */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-fg-muted">Content Width</label>
                  <span className="text-xs text-fg font-mono">{settings.maxWidth}px</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={1000}
                  step={20}
                  value={settings.maxWidth}
                  onChange={(e) => updateSettings({ maxWidth: Number(e.target.value) })}
                  className="w-full accent-accent h-1.5"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
