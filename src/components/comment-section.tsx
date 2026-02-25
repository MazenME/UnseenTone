"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Turnstile from "react-turnstile";
import {
  getChapterComments,
  submitComment,
  toggleCommentReaction,
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
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [replyTurnstileToken, setReplyTurnstileToken] = useState<string | null>(null);
  const [replyTurnstileKey, setReplyTurnstileKey] = useState(0);

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

  const handleReplySubmit = async (parentId: string) => {
    setReplyError("");
    if (!userId) { setReplyError("You must be logged in."); return; }
    if (!replyBody.trim()) { setReplyError("Reply cannot be empty."); return; }
    if (!replyTurnstileToken) { setReplyError("Please complete the captcha."); return; }

    setReplyPending(true);
    const res = await submitComment(chapterId, replyBody.trim(), replyTurnstileToken, parentId);
    if (res.error) {
      setReplyError(res.error);
      setReplyTurnstileKey((k) => k + 1);
      setReplyTurnstileToken(null);
      setReplyPending(false);
      return;
    }
    setReplyBody("");
    setReplyTurnstileToken(null);
    setReplyTurnstileKey((k) => k + 1);
    setReplyingTo(null);
    setReplyPending(false);
    loadComments();
  };

  const handleReaction = async (commentId: string, type: "like" | "dislike") => {
    if (!userId) return;
    const res = await toggleCommentReaction(commentId, type);
    if (res.error) return;
    // Update local state
    setComments((prev) => updateReactionInTree(prev, commentId, res));
  };

  function updateReactionInTree(
    list: CommentRow[],
    commentId: string,
    res: { likes?: number; dislikes?: number; user_reaction?: "like" | "dislike" | null }
  ): CommentRow[] {
    return list.map((c) => {
      if (c.id === commentId) {
        return { ...c, likes: res.likes ?? c.likes, dislikes: res.dislikes ?? c.dislikes, user_reaction: res.user_reaction ?? null };
      }
      if (c.replies?.length) {
        return { ...c, replies: updateReactionInTree(c.replies, commentId, res) };
      }
      return c;
    });
  }

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

  const renderComment = (c: CommentRow, depth = 0) => {
    const indent = Math.min(depth, 3); // cap visual nesting at 3 levels
    const mlClass = indent > 0 ? `ml-${indent * 4} sm:ml-${indent * 6}` : "";
    return (
    <motion.div
      key={c.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-surface border border-border rounded-xl p-4 ${depth > 0 ? "border-l-2 border-l-accent/30" : ""}`}
      style={depth > 0 ? { marginLeft: `${Math.min(depth, 3) * 0.75}rem` } : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
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

      {/* Body */}
      <p className="text-sm text-fg/90 leading-relaxed whitespace-pre-wrap break-words">
        {c.body}
      </p>

      {/* Actions: Like / Dislike / Reply */}
      <div className="flex items-center gap-4 mt-3">
        {/* Like (arrow up) */}
        <button
          onClick={() => handleReaction(c.id, "like")}
          disabled={!userId}
          className={`flex items-center gap-1 text-xs transition-colors ${
            c.user_reaction === "like"
              ? "text-emerald-400"
              : "text-fg-muted hover:text-emerald-400"
          } ${!userId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={c.user_reaction === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          {c.likes > 0 && <span>{c.likes}</span>}
        </button>

        {/* Dislike (arrow down) */}
        <button
          onClick={() => handleReaction(c.id, "dislike")}
          disabled={!userId}
          className={`flex items-center gap-1 text-xs transition-colors ${
            c.user_reaction === "dislike"
              ? "text-rose-400"
              : "text-fg-muted hover:text-rose-400"
          } ${!userId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={c.user_reaction === "dislike" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          {c.dislikes > 0 && <span>{c.dislikes}</span>}
        </button>

        {/* Reply button (on any comment) */}
        {userId && (
          <button
            onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyBody(""); setReplyError(""); }}
            className="text-xs text-fg-muted hover:text-accent transition-colors cursor-pointer flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
            Reply
          </button>
        )}
      </div>

      {/* Reply Form (inline) */}
      {replyingTo === c.id && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 ml-2"
        >
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder={`Reply to ${getDisplayName(c)}…`}
            maxLength={2000}
            rows={2}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-fg text-sm resize-none focus:border-accent/50 focus:outline-none placeholder:text-fg-muted/50"
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 mt-2">
            <div className="flex-shrink-0">
              <Turnstile
                key={replyTurnstileKey}
                sitekey={siteKey}
                onVerify={(token: string) => setReplyTurnstileToken(token)}
                onExpire={() => setReplyTurnstileToken(null)}
                theme="dark"
                size="compact"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setReplyingTo(null); setReplyBody(""); setReplyError(""); }}
                className="px-3 py-1.5 rounded-lg text-fg-muted text-xs hover:text-fg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReplySubmit(c.id)}
                disabled={replyPending || !replyBody.trim() || !replyTurnstileToken}
                className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
              >
                {replyPending ? "Posting…" : "Reply"}
              </button>
            </div>
          </div>
          {replyError && <p className="mt-1 text-xs text-red-400">{replyError}</p>}
        </motion.div>
      )}

      {/* Nested Replies */}
      {c.replies && c.replies.length > 0 && (
        <div className="mt-3 space-y-2">
          {c.replies.map((reply) => renderComment(reply, depth + 1))}
        </div>
      )}
    </motion.div>
    );
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 mt-3">
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
            <div className="flex items-center gap-3 justify-end">
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
            {comments.map((c) => renderComment(c))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
