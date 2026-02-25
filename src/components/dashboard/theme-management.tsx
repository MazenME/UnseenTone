"use client";

import { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getCustomThemes,
  createCustomTheme,
  deleteCustomTheme,
  type CustomTheme,
} from "@/app/dashboard/moderation/actions";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/* Every color field the theme system uses — same vars as built-in themes in globals.css */
const COLOR_FIELDS = [
  { key: "bg",              label: "Background",        group: "ui" },
  { key: "bg_secondary",    label: "Background Alt",    group: "ui" },
  { key: "fg",              label: "Foreground",        group: "ui" },
  { key: "fg_muted",        label: "Foreground Muted",  group: "ui" },
  { key: "accent",          label: "Accent",            group: "ui" },
  { key: "accent_hover",    label: "Accent Hover",      group: "ui" },
  { key: "border_color",    label: "Border",            group: "ui" },
  { key: "surface",         label: "Surface",           group: "ui" },
  { key: "content_text",    label: "Content Text",      group: "content" },
  { key: "content_heading", label: "Content Headings",  group: "content" },
  { key: "content_link",    label: "Content Links",     group: "content" },
] as const;

type ColorKey = (typeof COLOR_FIELDS)[number]["key"];

interface FormState {
  label: string;
  color_scheme: string;
  [k: string]: string;
}

const DEFAULTS: FormState = {
  label: "",
  bg: "#09090b",
  bg_secondary: "#18181b",
  fg: "#e5e5e5",
  fg_muted: "#a1a1aa",
  accent: "#7e22ce",
  accent_hover: "#9333ea",
  border_color: "#27272a",
  surface: "#13131a",
  content_text: "#e5e5e5",
  content_heading: "#ffffff",
  content_link: "#7e22ce",
  color_scheme: "dark",
};

export default function ThemeManagement() {
  const [themes, setThemes] = useState<CustomTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({ ...DEFAULTS });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = async () => { setLoading(true); setThemes(await getCustomThemes()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    setError("");
    if (!form.label.trim()) { setError("Theme name is required."); return; }
    for (const f of COLOR_FIELDS) {
      if (!HEX_RE.test(form[f.key])) { setError(`Invalid hex for "${f.label}": ${form[f.key]}`); return; }
    }

    startTransition(async () => {
      const res = await createCustomTheme({
        label: form.label.trim(),
        bg: form.bg,
        bg_secondary: form.bg_secondary,
        fg: form.fg,
        fg_muted: form.fg_muted,
        accent: form.accent,
        accent_hover: form.accent_hover,
        border_color: form.border_color,
        surface: form.surface,
        content_text: form.content_text,
        content_heading: form.content_heading,
        content_link: form.content_link,
        color_scheme: form.color_scheme,
      });
      if (res.error) { setError(res.error); return; }
      setForm({ ...DEFAULTS });
      setShowForm(false);
      load();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this custom theme?")) return;
    startTransition(async () => { await deleteCustomTheme(id); load(); });
  };

  /* ── Color picker row ─────── */
  const ColorInput = ({ field }: { field: { key: ColorKey; label: string } }) => (
    <div>
      <label className="block text-xs text-fg-muted mb-1">{field.label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={form[field.key]}
          onChange={(e) => set(field.key, e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
        />
        <input
          type="text"
          value={form[field.key]}
          onChange={(e) => set(field.key, e.target.value)}
          className="flex-1 px-2 py-1.5 bg-bg border border-border rounded text-fg text-xs font-mono focus:border-accent/50 focus:outline-none"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-fg">Custom Themes</h3>
          <p className="text-sm text-fg-muted">Create themes that work exactly like the built-in ones.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors w-full sm:w-auto">
          {showForm ? "Cancel" : "+ Add Theme"}
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="bg-surface border border-border rounded-xl p-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Theme Name</label>
                <input type="text" value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Midnight Forest" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-fg text-sm focus:border-accent/50 focus:outline-none" />
              </div>

              {/* Scheme */}
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Color Scheme</label>
                <div className="flex gap-2">
                  {["dark", "light"].map((s) => (
                    <button key={s} onClick={() => set("color_scheme", s)} className={`px-4 py-1.5 rounded-md text-sm capitalize border transition-colors ${form.color_scheme === s ? "bg-accent/15 border-accent/30 text-fg" : "bg-bg border-border text-fg-muted hover:text-fg"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* UI Colors */}
              <div>
                <p className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">UI Colors</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {COLOR_FIELDS.filter((f) => f.group === "ui").map((f) => <ColorInput key={f.key} field={f} />)}
                </div>
              </div>

              {/* Content Colors */}
              <div>
                <p className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">Chapter Content Colors</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {COLOR_FIELDS.filter((f) => f.group === "content").map((f) => <ColorInput key={f.key} field={f} />)}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Preview</label>
                <div className="rounded-lg border p-4" style={{ backgroundColor: form.bg, borderColor: form.border_color, color: form.fg }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: form.accent }} />
                    <span className="text-sm font-bold">{form.label || "Theme Name"}</span>
                  </div>
                  <p style={{ color: form.fg_muted, fontSize: "0.8rem" }}>Muted text preview.</p>
                  <div className="mt-2 p-2 rounded" style={{ backgroundColor: form.surface }}>
                    <span style={{ fontSize: "0.75rem", color: form.fg_muted }}>Surface card · </span>
                    <span style={{ fontSize: "0.75rem", color: form.accent, fontWeight: 600 }}>accent text</span>
                  </div>
                  <div className="mt-3 p-3 rounded" style={{ backgroundColor: form.bg_secondary }}>
                    <p style={{ fontSize: "0.85rem", fontWeight: 700, color: form.content_heading, marginBottom: 4 }}>Chapter Heading</p>
                    <p style={{ fontSize: "0.8rem", color: form.content_text }}>
                      Body text in the chapter. <a style={{ color: form.content_link, textDecoration: "underline" }}>A link</a>.
                    </p>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button onClick={handleSubmit} disabled={isPending} className="w-full px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {isPending ? "Creating…" : "Create Theme"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />)}</div>
      ) : themes.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-10 text-center text-fg-muted text-sm">No custom themes yet.</div>
      ) : (
        <div className="space-y-2">
          {themes.map((t) => (
            <div key={t.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-lg border flex items-center justify-center flex-shrink-0" style={{ backgroundColor: t.bg, borderColor: t.border_color }}>
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.accent }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.fg }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg">{t.label}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {[{ c: t.bg, l: "bg" }, { c: t.accent, l: "accent" }, { c: t.content_text, l: "content" }, { c: t.content_heading, l: "heading" }].map((s) => (
                    <span key={s.l} className="text-xs text-fg-muted font-mono flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm border border-fg/10" style={{ backgroundColor: s.c }} />
                      {s.c}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => handleDelete(t.id)} disabled={isPending} className="p-2 text-fg-muted hover:text-red-400 transition-colors flex-shrink-0" title="Delete">
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
