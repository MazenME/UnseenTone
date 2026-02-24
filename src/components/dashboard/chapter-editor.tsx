"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChapter, updateChapter } from "@/app/dashboard/chapters/actions";
import TipTapEditor from "@/components/dashboard/tiptap-editor";
import Link from "next/link";

type Novel = { id: string; title: string };

type ExistingChapter = {
  id: string;
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string;
  is_published: boolean;
};

export default function ChapterEditor({
  novels,
  existingChapter,
}: {
  novels: Novel[];
  existingChapter?: ExistingChapter;
}) {
  const router = useRouter();
  const isEditing = !!existingChapter;

  const [novelId, setNovelId] = useState(existingChapter?.novel_id || novels[0]?.id || "");
  const [chapterNumber, setChapterNumber] = useState(existingChapter?.chapter_number || 1);
  const [title, setTitle] = useState(existingChapter?.title || "");
  const [content, setContent] = useState(existingChapter?.content || "");
  const [isPublished, setIsPublished] = useState(existingChapter?.is_published || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (publish?: boolean) => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!content.trim() || content === "<p></p>") {
      setError("Content is required");
      return;
    }

    setLoading(true);
    setError("");

    const shouldPublish = publish !== undefined ? publish : isPublished;

    const result = isEditing
      ? await updateChapter(existingChapter!.id, {
          chapter_number: chapterNumber,
          title,
          content,
          is_published: shouldPublish,
        })
      : await createChapter({
          novel_id: novelId,
          chapter_number: chapterNumber,
          title,
          content,
          is_published: shouldPublish,
        });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/dashboard/chapters");
    router.refresh();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/chapters"
            className="p-2 text-fg-muted hover:text-fg rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h3 className="text-lg font-semibold text-fg">
            {isEditing ? "Edit Chapter" : "New Chapter"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!isPublished && (
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-fg-muted border border-border rounded-lg hover:bg-bg-secondary transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Saving..." : "Save Draft"}
            </button>
          )}
          <button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Saving..." : isPublished ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Meta Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="novel" className="block text-sm font-medium text-fg-muted mb-1.5">
            Novel *
          </label>
          <select
            id="novel"
            value={novelId}
            onChange={(e) => setNovelId(e.target.value)}
            disabled={isEditing}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-secondary border border-border text-fg focus:outline-none focus:ring-2 focus:ring-accent transition-colors disabled:opacity-50"
          >
            {novels.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="chapterNumber" className="block text-sm font-medium text-fg-muted mb-1.5">
            Chapter #
          </label>
          <input
            id="chapterNumber"
            type="number"
            min={1}
            value={chapterNumber}
            onChange={(e) => setChapterNumber(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-secondary border border-border text-fg focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          />
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-fg-muted mb-1.5">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Awakening"
            className="w-full px-4 py-2.5 rounded-lg bg-bg-secondary border border-border text-fg placeholder:text-fg-muted/50 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          />
        </div>
      </div>

      {/* Published Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPublished(!isPublished)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            isPublished ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              isPublished ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm text-fg-muted">
          {isPublished ? "Published" : "Draft"}
        </span>
      </div>

      {/* TipTap Editor */}
      <TipTapEditor
        content={content}
        onChange={setContent}
        placeholder="Begin writing your chapter..."
      />
    </div>
  );
}
