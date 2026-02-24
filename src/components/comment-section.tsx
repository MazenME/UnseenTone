"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Turnstile from "react-turnstile";
import {
  getChapterComments,
  submitComment,
  type CommentRow,
} from "@/app/read/actions";

interface Props {
  chapterId: string;
  userId: string | null;
}

export default function CommentSection({ chapterId, userId }: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0); // bump to force re-render / reset

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const loadComments = useCallback(async () => {
    setLoading(true);
    const data = await getChapterComments(chapterId);
    setComments(data);
    setLoading(false);
  }, [chapterId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = () => {
    setError("");
    if (!userId) { setError("You must be logged in to comment."); return; }
    if (!body.trim()) { setError("Comment cannot be empty."); return; }
    if (!turnstileToken) { setError("Please complete the captcha."); return; }

    startTransition(async () => {
      const res = await submitComment(chapterId, body.trim(), turnstileToken);
      if (res.error) {
        setError(res.error);
        // Reset turnstile so user can retry
        setTurnstileKey((k) => k + 1);
        setTurnstileToken(null);
        return;
      }
      setBody("");
      setTurnstileToken(null);
      setTurnstileKey((k) => k + 1);
      loadComments();
    });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const getInitial = (c: CommentRow) => {
    const name = c.users_profile?.display_name || c.users_profile?.email || "?";
    return name[0].toUpperCase();
  };

  const getDisplayName = (c: CommentRow) => {
    return c.users_profile?.display_name || c.users_profile?.email?.split("@")[0] || "Anonymous";
  };

  return (
    <div className="mt-14">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-2 text-fg-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          <span className="text-sm font-medium uppercase tracking-wider">
            Comments {!loading && `(${comments.length})`}
          </span>
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Comment Form */}
      {userId ? (
        <div className="bg-surface border border-border rounded-xl p-4 mb-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts on this chapter…"
            maxLength={2000}
            rows={3}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-fg text-sm resize-none focus:border-accent/50 focus:outline-none placeholder:text-fg-muted/50"
          />
          <div className="flex items-end justify-between gap-3 mt-3">
            <div className="flex-shrink-0">
              <Turnstile
                key={turnstileKey}
                sitekey={siteKey}
                onVerify={(token: string) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                theme="dark"
                size="compact"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-fg-muted">{body.length}/2000</span>
              <button
                onClick={handleSubmit}
                disabled={isPending || !body.trim() || !turnstileToken}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {isPending ? "Posting…" : "Post Comment"}
              </button>
            </div>
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-sm text-red-400"
            >
              {error}
            </motion.p>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl px-6 py-4 mb-6 text-center">
          <p className="text-sm text-fg-muted">
            <a href="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">
              Log in
            </a>{" "}
            to join the conversation.
          </p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-border" />
                <div className="h-3 w-24 bg-border rounded" />
              </div>
              <div className="mt-3 h-3 w-full bg-border/50 rounded" />
              <div className="mt-2 h-3 w-2/3 bg-border/50 rounded" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-fg-muted text-sm">
          No comments yet. Be the first to share your thoughts!
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {comments.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  {/* Avatar */}
                  {c.users_profile?.avatar_url ? (
                    <img
                      src={c.users_profile.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                      {getInitial(c)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-fg truncate">
                      {getDisplayName(c)}
                    </span>
                    <span className="text-xs text-fg-muted flex-shrink-0">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-fg/90 leading-relaxed whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
