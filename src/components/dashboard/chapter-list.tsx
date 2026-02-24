"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { deleteChapter } from "@/app/dashboard/chapters/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Chapter = {
  id: string;
  novel_id: string;
  chapter_number: number;
  title: string;
  word_count: number;
  is_published: boolean;
  reads: number;
  created_at: string;
  novels: { title: string } | null;
};

type Novel = {
  id: string;
  title: string;
};

export default function ChapterList({
  initialChapters,
  novels,
}: {
  initialChapters: Chapter[];
  novels: Novel[];
}) {
  const router = useRouter();
  const [chapters] = useState(initialChapters);
  const [filterNovel, setFilterNovel] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered =
    filterNovel === "all"
      ? chapters
      : chapters.filter((c) => c.novel_id === filterNovel);

  const handleDelete = async (id: string) => {
    setLoading(true);
    await deleteChapter(id);
    setDeleteConfirm(null);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-fg">All Chapters</h3>
          <p className="text-sm text-fg-muted">{filtered.length} chapter{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterNovel}
            onChange={(e) => setFilterNovel(e.target.value)}
            className="px-3 py-2 rounded-lg bg-bg-secondary border border-border text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">All Novels</option>
            {novels.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
          <Link
            href="/dashboard/chapters/new"
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chapter
          </Link>
        </div>
      </div>

      {/* Chapters Table */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
          <svg className="w-12 h-12 mx-auto text-fg-muted/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-fg-muted">No chapters yet. Write your first one!</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-fg-muted uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-xs font-medium text-fg-muted uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-xs font-medium text-fg-muted uppercase tracking-wider hidden md:table-cell">Novel</th>
                  <th className="px-4 py-3 text-xs font-medium text-fg-muted uppercase tracking-wider hidden sm:table-cell">Words</th>
                  <th className="px-4 py-3 text-xs font-medium text-fg-muted uppercase tracking-wider hidden sm:table-cell">Reads</th>
                  <th className="px-4 py-3 text-xs font-medium text-fg-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-fg-muted uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((chapter) => (
                  <tr key={chapter.id} className="hover:bg-bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-fg-muted">{chapter.chapter_number}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-fg truncate max-w-[200px]">{chapter.title}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-fg-muted hidden md:table-cell">
                      {chapter.novels?.title || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-sm text-fg-muted hidden sm:table-cell">
                      {chapter.word_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-fg-muted hidden sm:table-cell">
                      {chapter.reads.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          chapter.is_published
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {chapter.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 relative">
                        <Link
                          href={`/dashboard/chapters/${chapter.id}/edit`}
                          className="p-1.5 text-fg-muted hover:text-accent rounded-lg hover:bg-accent/10 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(chapter.id)}
                          className="p-1.5 text-fg-muted hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>

                        {/* Delete confirm popover */}
                        <AnimatePresence>
                          {deleteConfirm === chapter.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl p-3 shadow-xl z-10 w-48"
                            >
                              <p className="text-xs text-fg-muted mb-2">Delete this chapter?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="flex-1 py-1 text-xs rounded-lg border border-border text-fg-muted hover:bg-bg-secondary cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleDelete(chapter.id)}
                                  disabled={loading}
                                  className="flex-1 py-1 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
