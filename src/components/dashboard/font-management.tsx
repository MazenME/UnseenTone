"use client";

import { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getCustomFonts,
  createCustomFont,
  deleteCustomFont,
  type CustomFont,
} from "@/app/dashboard/moderation/actions";

export default function FontManagement() {
  const [fonts, setFonts] = useState<CustomFont[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [fontFamily, setFontFamily] = useState("");
  const [fontUrl, setFontUrl] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadFonts = async () => {
    setLoading(true);
    const data = await getCustomFonts();
    setFonts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadFonts();
  }, []);

  const handleSubmit = () => {
    setError("");

    if (!name.trim()) {
      setError("Font name is required.");
      return;
    }
    if (!fontFamily.trim()) {
      setError("CSS font-family value is required.");
      return;
    }

    startTransition(async () => {
      const res = await createCustomFont({
        name: name.trim(),
        font_family: fontFamily.trim(),
        ...(fontUrl.trim() ? { font_url: fontUrl.trim() } : {}),
      });

      if (res.error) {
        setError(res.error);
        return;
      }

      setName("");
      setFontFamily("");
      setFontUrl("");
      setShowForm(false);
      loadFonts();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this custom font?")) return;
    startTransition(async () => {
      await deleteCustomFont(id);
      loadFonts();
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-fg">Custom Fonts</h3>
          <p className="text-sm text-fg-muted">
            Add font families that readers can choose from.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors w-full sm:w-auto"
        >
          {showForm ? "Cancel" : "+ Add Font"}
        </button>
      </div>

      {/* Add Font Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Font Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Open Sans"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-fg text-sm focus:border-accent/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  CSS font-family
                </label>
                <input
                  type="text"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  placeholder="e.g. 'Open Sans', sans-serif"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-fg text-sm font-mono focus:border-accent/50 focus:outline-none"
                />
                <p className="text-xs text-fg-muted mt-1">
                  Enter the CSS font-family value. Wrap names with spaces in quotes.
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] text-fg-muted/70">Quick-add system fonts:</p>
                  {[
                    { n: "Georgia", v: "Georgia, serif", u: "" },
                    { n: "Palatino", v: "'Palatino Linotype', 'Book Antiqua', Palatino, serif", u: "" },
                    { n: "Verdana", v: "Verdana, Geneva, sans-serif", u: "" },
                    { n: "Trebuchet", v: "'Trebuchet MS', Helvetica, sans-serif", u: "" },
                    { n: "Garamond", v: "Garamond, 'Times New Roman', serif", u: "" },
                  ].map((ex) => (
                    <button
                      key={ex.n}
                      type="button"
                      onClick={() => { setName(ex.n); setFontFamily(ex.v); setFontUrl(ex.u); }}
                      className="block text-[11px] font-mono text-accent/70 hover:text-accent transition-colors truncate w-full text-left"
                    >
                      {ex.n} → <span className="text-fg-muted/60">{ex.v}</span>
                    </button>
                  ))}
                  <p className="text-[11px] text-fg-muted/70 !mt-3">Quick-add Google Fonts:</p>
                  {[
                    { n: "Lora", v: "'Lora', serif", u: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&display=swap" },
                    { n: "Merriweather", v: "'Merriweather', serif", u: "https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap" },
                    { n: "Noto Naskh Arabic", v: "'Noto Naskh Arabic', serif", u: "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&display=swap" },
                    { n: "Amiri", v: "'Amiri', serif", u: "https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&display=swap" },
                    { n: "Inter", v: "'Inter', sans-serif", u: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" },
                  ].map((ex) => (
                    <button
                      key={ex.n}
                      type="button"
                      onClick={() => { setName(ex.n); setFontFamily(ex.v); setFontUrl(ex.u); }}
                      className="block text-[11px] font-mono text-accent/70 hover:text-accent transition-colors truncate w-full text-left"
                    >
                      {ex.n} → <span className="text-fg-muted/60">{ex.v}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font URL (optional, for Google Fonts) */}
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Font URL <span className="text-fg-muted font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={fontUrl}
                  onChange={(e) => setFontUrl(e.target.value)}
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-fg text-sm font-mono focus:border-accent/50 focus:outline-none"
                />
                <p className="text-xs text-fg-muted mt-1">
                  For Google Fonts, paste the stylesheet URL. System fonts (Georgia, Verdana, etc.) don&apos;t need a URL.
                </p>
              </div>

              {/* Preview */}
              {fontFamily && (
                <div className="bg-bg border border-border rounded-lg p-4">
                  {fontUrl && (
                    // eslint-disable-next-line @next/next/no-page-custom-font
                    <link rel="stylesheet" href={fontUrl} />
                  )}
                  <p className="text-xs text-fg-muted mb-1">Preview:</p>
                  <p style={{ fontFamily: fontFamily, fontSize: "1.125rem" }} className="text-fg">
                    The quick brown fox jumps over the lazy dog.
                  </p>
                  <p style={{ fontFamily: fontFamily, fontSize: "1.125rem" }} className="text-fg" dir="rtl">
                    هذا نص تجريبي لمعاينة الخط العربي.
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="w-full px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {isPending ? "Adding…" : "Add Font"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Font List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : fonts.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-10 text-center text-fg-muted text-sm">
          No custom fonts yet. The default Sans-Serif, Serif, and Monospace are always available.
        </div>
      ) : (
        <div className="space-y-2">
          {fonts.map((font) => (
            <div
              key={font.id}
              className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4"
            >
              {/* Sample letter */}
              <div
                className="w-12 h-12 rounded-lg bg-bg border border-border flex items-center justify-center text-xl text-fg font-bold flex-shrink-0"
                style={{ fontFamily: font.font_family }}
              >
                Aa
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg">{font.name}</p>
                <p className="text-xs text-fg-muted font-mono truncate mt-0.5">
                  {font.font_family}
                </p>
              </div>

              <button
                onClick={() => handleDelete(font.id)}
                disabled={isPending}
                className="p-2 text-fg-muted hover:text-red-400 transition-colors flex-shrink-0"
                title="Delete font"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
