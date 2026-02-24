"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createNovel, updateNovel, deleteNovel } from "@/app/dashboard/novels/actions";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Novel = {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  cover_url: string | null;
  status: string;
  total_reads: number;
  created_at: string;
  novel_avg_rating?: number;
  novel_rating_count?: number;
  chapter_avg_rating?: number;
  chapter_rating_count?: number;
};

export default function NovelManager({ initialNovels }: { initialNovels: Novel[] }) {
  const router = useRouter();
  const [novels] = useState(initialNovels);
  const [showForm, setShowForm] = useState(false);
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    const result = editingNovel
      ? await updateNovel(editingNovel.id, formData)
      : await createNovel(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setShowForm(false);
    setEditingNovel(null);
    setLoading(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    const result = await deleteNovel(id);
    if (result.error) {
      setError(result.error);
    }
    setDeleteConfirm(null);
    setLoading(false);
    router.refresh();
  };

  const openEdit = (novel: Novel) => {
    setEditingNovel(novel);
    setShowForm(true);
    setError("");
  };

  const openCreate = () => {
    setEditingNovel(null);
    setShowForm(true);
    setError("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-fg">All Novels</h3>
          <p className="text-sm text-fg-muted">{novels.length} novel{novels.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Novel
        </button>
      </div>

      {/* Novel Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => { setShowForm(false); setEditingNovel(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold text-fg">
                  {editingNovel ? "Edit Novel" : "Create Novel"}
                </h3>
                <button
                  onClick={() => { setShowForm(false); setEditingNovel(null); }}
                  className="p-1 text-fg-muted hover:text-fg rounded cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-fg-muted mb-1.5">
                    Title *
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    defaultValue={editingNovel?.title || ""}
                    className="w-full px-4 py-2.5 rounded-lg bg-bg-secondary border border-border text-fg placeholder:text-fg-muted/50 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                    placeholder="The Shattered Crown"
                  />
                </div>

                <div>
                  <label htmlFor="synopsis" className="block text-sm font-medium text-fg-muted mb-1.5">
                    Synopsis
                  </label>
                  <textarea
                    id="synopsis"
                    name="synopsis"
                    rows={4}
                    defaultValue={editingNovel?.synopsis || ""}
                    className="w-full px-4 py-2.5 rounded-lg bg-bg-secondary border border-border text-fg placeholder:text-fg-muted/50 focus:outline-none focus:ring-2 focus:ring-accent transition-colors resize-none"
                    placeholder="A tale of darkness and redemption..."
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-fg-muted mb-1.5">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={editingNovel?.status || "ongoing"}
                    className="w-full px-4 py-2.5 rounded-lg bg-bg-secondary border border-border text-fg focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="hiatus">Hiatus</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cover" className="block text-sm font-medium text-fg-muted mb-1.5">
                    Cover Image {editingNovel && "(leave empty to keep current)"}
                  </label>
                  {editingNovel?.cover_url && (
                    <div className="mb-2">
                      <Image
                        src={editingNovel.cover_url}
                        alt="Current cover"
                        width={80}
                        height={120}
                        className="rounded-lg object-cover"
                      />
                    </div>
                  )}
                  <input
                    id="cover"
                    name="cover"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="w-full text-sm text-fg-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent/10 file:text-accent file:font-medium file:cursor-pointer hover:file:bg-accent/20 cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingNovel(null); }}
                    className="flex-1 py-2.5 rounded-lg border border-border text-fg-muted hover:bg-bg-secondary transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Saving..." : editingNovel ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Novel List */}
      {novels.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
          <svg className="w-12 h-12 mx-auto text-fg-muted/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-fg-muted">No novels yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {novels.map((novel) => (
            <motion.div
              key={novel.id}
              layout
              className="bg-surface border border-border rounded-xl overflow-hidden group"
            >
              {/* Cover */}
              <div className="h-56 bg-bg-secondary relative overflow-hidden">
                {novel.cover_url ? (
                  <Image
                    src={novel.cover_url}
                    alt={novel.title}
                    fill
                    className="object-fill"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-fg-muted/30">
                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  </div>
                )}
                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      novel.status === "ongoing"
                        ? "bg-green-500/20 text-green-400"
                        : novel.status === "completed"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {novel.status}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h4 className="text-fg font-semibold mb-1 truncate">{novel.title}</h4>
                <p className="text-sm text-fg-muted line-clamp-2 mb-3 min-h-[2.5rem]">
                  {novel.synopsis || "No synopsis"}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-xs text-fg-muted">
                  <span>{novel.total_reads.toLocaleString()} reads</span>
                  {(novel.novel_avg_rating ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5">
                      <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
                      </svg>
                      <span className="text-amber-400 font-medium">{novel.novel_avg_rating!.toFixed(1)}</span>/10
                      <span className="text-fg-muted/50">({novel.novel_rating_count})</span>
                    </span>
                  )}
                  {(novel.chapter_avg_rating ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5">
                      <svg className="w-3 h-3 text-amber-400/70" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
                      </svg>
                      {novel.chapter_avg_rating!.toFixed(1)}/10 ch.
                      <span className="text-fg-muted/50">({novel.chapter_rating_count})</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(novel)}
                      className="p-1.5 text-fg-muted hover:text-accent rounded-lg hover:bg-accent/10 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(novel.id)}
                      className="p-1.5 text-fg-muted hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Delete Confirmation */}
              <AnimatePresence>
                {deleteConfirm === novel.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-xl"
                  >
                    <div className="text-center p-4">
                      <p className="text-fg text-sm mb-3">Delete &quot;{novel.title}&quot;?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-4 py-1.5 text-sm rounded-lg border border-border text-fg-muted hover:bg-bg-secondary cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(novel.id)}
                          disabled={loading}
                          className="px-4 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
