"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getComments,
  deleteComment,
  restoreComment,
  hardDeleteComment,
  banUser,
  deleteCommentsByIp,
} from "@/app/dashboard/moderation/actions";

interface Comment {
  id: string;
  body: string;
  ip_address: string | null;
  is_deleted: boolean;
  created_at: string;
  user_id: string;
  users_profile: {
    id: string;
    display_name: string | null;
    email: string;
    is_banned: boolean;
    avatar_url: string | null;
  } | null;
  chapters: {
    id: string;
    title: string;
    novels: { title: string } | null;
  } | null;
}

export default function CommentModeration() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banModal, setBanModal] = useState<{ userId: string; name: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const pageSize = 15;
  const totalPages = Math.ceil(total / pageSize);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const result = await getComments({ page, pageSize, showDeleted, search });
    setComments(result.comments as Comment[]);
    setTotal(result.total);
    setLoading(false);
  }, [page, pageSize, showDeleted, search]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    await deleteComment(id);
    await fetchComments();
    setActionLoading(null);
  };

  const handleRestore = async (id: string) => {
    setActionLoading(id);
    await restoreComment(id);
    await fetchComments();
    setActionLoading(null);
  };

  const handleHardDelete = async (id: string) => {
    setActionLoading(id);
    await hardDeleteComment(id);
    setConfirmDelete(null);
    await fetchComments();
    setActionLoading(null);
  };

  const handleBan = async () => {
    if (!banModal) return;
    setActionLoading(banModal.userId);
    await banUser(banModal.userId, banReason || undefined);
    setBanModal(null);
    setBanReason("");
    await fetchComments();
    setActionLoading(null);
  };

  const handleDeleteByIp = async (ip: string) => {
    setActionLoading(ip);
    await deleteCommentsByIp(ip);
    await fetchComments();
    setActionLoading(null);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search comments..."
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => {
              setShowDeleted(e.target.checked);
              setPage(1);
            }}
            className="rounded border-border accent-accent"
          />
          Show deleted
        </label>
      </div>

      {/* Stats */}
      <div className="text-xs text-fg-muted">
        {total} comment{total !== 1 ? "s" : ""} found
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
          <div className="animate-pulse text-fg-muted">Loading comments...</div>
        </div>
      ) : comments.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
          <p className="text-fg-muted">No comments found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`bg-surface border rounded-xl p-4 ${
                  comment.is_deleted
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border"
                }`}
              >
                {/* Comment Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      {comment.users_profile?.avatar_url ? (
                        <img
                          src={comment.users_profile.avatar_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-accent">
                          {(comment.users_profile?.display_name || "?")[0].toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-fg truncate">
                          {comment.users_profile?.display_name || "Unknown User"}
                        </span>
                        {comment.users_profile?.is_banned && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase">
                            Banned
                          </span>
                        )}
                        {comment.is_deleted && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase">
                            Deleted
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-fg-muted">
                        <span>{comment.users_profile?.email}</span>
                        <span>·</span>
                        <span>{new Date(comment.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Chapter & Novel info */}
                  {comment.chapters && (
                    <div className="text-xs text-fg-muted text-right flex-shrink-0">
                      <div className="font-medium text-fg/70">
                        {comment.chapters.novels?.title}
                      </div>
                      <div>{comment.chapters.title}</div>
                    </div>
                  )}
                </div>

                {/* Comment Body */}
                <div className="text-sm text-fg/90 bg-bg/50 rounded-lg p-3 my-2 break-words">
                  {comment.body}
                </div>

                {/* Footer: IP + Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-2">
                  {/* IP Address */}
                  <div className="text-xs text-fg-muted font-mono">
                    {comment.ip_address ? (
                      <span className="flex items-center gap-1">
                        IP: {comment.ip_address}
                        <button
                          onClick={() => handleDeleteByIp(comment.ip_address!)}
                          disabled={actionLoading === comment.ip_address}
                          className="text-red-400 hover:text-red-300 underline ml-1 disabled:opacity-50"
                          title="Delete all comments from this IP"
                        >
                          nuke IP
                        </button>
                      </span>
                    ) : (
                      "No IP recorded"
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Ban User */}
                    {comment.users_profile && !comment.users_profile.is_banned && (
                      <button
                        onClick={() =>
                          setBanModal({
                            userId: comment.users_profile!.id,
                            name: comment.users_profile!.display_name || comment.users_profile!.email,
                          })
                        }
                        className="px-3 py-1 text-xs rounded-md bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-colors"
                      >
                        Ban User
                      </button>
                    )}

                    {/* Delete / Restore */}
                    {comment.is_deleted ? (
                      <>
                        <button
                          onClick={() => handleRestore(comment.id)}
                          disabled={actionLoading === comment.id}
                          className="px-3 py-1 text-xs rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                        >
                          Restore
                        </button>
                        {confirmDelete === comment.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleHardDelete(comment.id)}
                              disabled={actionLoading === comment.id}
                              className="px-3 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-3 py-1 text-xs rounded-md bg-bg text-fg-muted hover:text-fg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(comment.id)}
                            className="px-3 py-1 text-xs rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                          >
                            Hard Delete
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={actionLoading === comment.id}
                        className="px-3 py-1 text-xs rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-md bg-surface border border-border text-fg-muted hover:text-fg disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-fg-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-md bg-surface border border-border text-fg-muted hover:text-fg disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Ban Modal */}
      <AnimatePresence>
        {banModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setBanModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-bold text-fg mb-1">Ban User</h3>
              <p className="text-sm text-fg-muted mb-4">
                Are you sure you want to ban <strong className="text-fg">{banModal.name}</strong>?
                They will be signed out and unable to interact.
              </p>

              <label className="block text-sm font-medium text-fg mb-1">
                Reason (optional)
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Spam, harassment..."
                rows={3}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none mb-4"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setBanModal(null);
                    setBanReason("");
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-bg border border-border text-fg-muted hover:text-fg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBan}
                  disabled={actionLoading === banModal.userId}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === banModal.userId ? "Banning..." : "Ban User"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
