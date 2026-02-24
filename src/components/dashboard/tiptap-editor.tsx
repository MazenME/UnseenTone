"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Placeholder from "@tiptap/extension-placeholder";
import { useState } from "react";

const FONT_OPTIONS = [
  { label: "Default (Sans)", value: "ui-sans-serif, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, 'Courier New', monospace" },
  { label: "Garamond", value: "'EB Garamond', Garamond, serif" },
  { label: "Crimson", value: "'Crimson Text', serif" },
];

const COLOR_PRESETS = [
  { label: "Default", value: "" },
  { label: "Magic Purple", value: "#a855f7" },
  { label: "Blood Red", value: "#ef4444" },
  { label: "Ember Orange", value: "#f97316" },
  { label: "Arcane Cyan", value: "#06b6d4" },
  { label: "Venom Green", value: "#22c55e" },
  { label: "Gold", value: "#eab308" },
  { label: "Frost Blue", value: "#60a5fa" },
  { label: "Shadow Gray", value: "#6b7280" },
];

type TipTapEditorProps = {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
};

export default function TipTapEditor({
  content = "",
  onChange,
  placeholder = "Begin writing your chapter...",
}: TipTapEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#a855f7");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: {
          HTMLAttributes: { class: "border-l-3 border-accent pl-4 italic text-fg-muted my-4" },
        },
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "tiptap prose-sm max-w-none focus:outline-none text-fg min-h-[400px]",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  if (!editor) {
    return (
      <div className="border border-border rounded-xl bg-surface animate-pulse">
        <div className="h-12 border-b border-border" />
        <div className="h-[400px]" />
      </div>
    );
  }

  const ToolbarButton = ({
    onClick,
    isActive = false,
    title,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg text-sm transition-colors cursor-pointer ${
        isActive
          ? "bg-accent/20 text-accent"
          : "text-fg-muted hover:text-fg hover:bg-bg-secondary"
      }`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-border mx-1" />;

  return (
    <div className="border border-border rounded-xl bg-surface overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-bg-secondary/50">
        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <span className="font-bold text-xs">H1</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <span className="font-bold text-xs">H2</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <span className="font-bold text-xs">H3</span>
        </ToolbarButton>

        <Divider />

        {/* Basic formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0l-4 16m0 0h4m2-16l-4 16" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="Underline (Ctrl+U)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v7a5 5 0 0010 0V4M5 21h14" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 4H9a3 3 0 000 6h1M4 12h16M8 20h7a3 3 0 000-6h-1" />
          </svg>
        </ToolbarButton>

        <Divider />

        {/* Blockquote */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11V7.5a2.5 2.5 0 00-5 0V11m0 0h5m-5 0v3a2.5 2.5 0 005 0v-3m4 0V7.5a2.5 2.5 0 00-5 0V11m0 0h5m-5 0v3a2.5 2.5 0 005 0v-3" transform="translate(2, 1)" />
          </svg>
        </ToolbarButton>

        {/* Bullet/Ordered List */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h10.5M8.25 12h10.5m-10.5 5.25h10.5M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Ordered List"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h10.5M8.25 12h10.5m-10.5 5.25h10.5M3.75 6.75V4.5h1.5v2.25m-1.5 0h1.5M3.75 15v-1.5l1.5-.75m-1.5 0h1.5m-1.5 5.25v-.75l1.5-.75h-1.5" />
          </svg>
        </ToolbarButton>

        <Divider />

        {/* Text Color */}
        <div className="relative">
          <ToolbarButton
            onClick={() => { setShowColorPicker(!showColorPicker); setShowFontPicker(false); }}
            isActive={showColorPicker}
            title="Text Color"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-bold">A</span>
              <div
                className="w-4 h-1 rounded-full"
                style={{
                  backgroundColor:
                    (editor.getAttributes("textStyle").color as string) || "currentColor",
                }}
              />
            </div>
          </ToolbarButton>

          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-xl p-3 shadow-xl z-50 w-48">
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.label}
                    type="button"
                    onClick={() => {
                      if (color.value) {
                        editor.chain().focus().setColor(color.value).run();
                      } else {
                        editor.chain().focus().unsetColor().run();
                      }
                      setShowColorPicker(false);
                    }}
                    className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer"
                    title={color.label}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-border"
                      style={{ backgroundColor: color.value || "var(--fg)" }}
                    />
                    <span className="text-[10px] text-fg-muted">{color.label}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-border pt-2">
                <label className="text-xs text-fg-muted mb-1 block">Custom Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().setColor(customColor).run();
                      setShowColorPicker(false);
                    }}
                    className="flex-1 py-1 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Font Family */}
        <div className="relative">
          <ToolbarButton
            onClick={() => { setShowFontPicker(!showFontPicker); setShowColorPicker(false); }}
            isActive={showFontPicker}
            title="Font Family"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16" />
            </svg>
          </ToolbarButton>

          {showFontPicker && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-xl py-1 shadow-xl z-50 w-52">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.label}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setFontFamily(font.value).run();
                    setShowFontPicker(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-bg-secondary transition-colors cursor-pointer"
                  style={{ fontFamily: font.value }}
                >
                  {font.label}
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetFontFamily().run();
                    setShowFontPicker(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-fg-muted hover:bg-bg-secondary transition-colors cursor-pointer"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Undo / Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
        </ToolbarButton>

        {/* Horizontal Rule */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 12h18" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <div
        onClick={() => editor.chain().focus().run()}
        className="cursor-text"
      >
        <EditorContent editor={editor} />
      </div>

      {/* Word Count Footer */}
      <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-fg-muted">
        <span>
          {editor.storage.characterCount?.words?.() ??
            editor.getText().split(/\s+/).filter(Boolean).length}{" "}
          words
        </span>
        <span>
          {editor.storage.characterCount?.characters?.() ??
            editor.getText().length}{" "}
          characters
        </span>
      </div>
    </div>
  );
}
