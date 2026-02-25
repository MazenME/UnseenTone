"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import ThemeSwitcher from "@/components/theme-switcher";
import ReaderControls, { useReaderSettings } from "@/components/reader-controls";
import CommentSection from "@/components/comment-section";
import LikeButton from "@/components/like-button";
import BookmarkButton from "@/components/bookmark-button";
import RatingStars from "@/components/rating-stars";
import { rateChapter } from "@/app/read/actions";
import { useState, useEffect } from "react";

interface Chapter {
  id: string;
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  reads: number;
  created_at: string;
}

interface Novel {
  id: string;
  title: string;
  slug: string;
}

interface SiblingChapter {
  id: string;
  chapter_number: number;
  title: string;
}

interface Props {
  chapter: Chapter;
  novel: Novel;
  prevChapter: SiblingChapter | null;
  nextChapter: SiblingChapter | null;
  userId: string | null;
  initialLikeCount: number;
  initialLiked: boolean;
  initialBookmarked: boolean;
  initialRatingAverage: number;
  initialRatingCount: number;
  initialUserRating: number | null;
}

export default function ChapterReaderClient({ chapter, novel, prevChapter, nextChapter, userId, initialLikeCount, initialLiked, initialBookmarked, initialRatingAverage, initialRatingCount, initialUserRating }: Props) {
  const { settings, updateSettings, resetSettings, mounted } = useReaderSettings();
  const [showTopBar, setShowTopBar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [progress, setProgress] = useState(0);

  // Auto-hide top bar on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setShowTopBar(currentScrollY < 100 || currentScrollY < lastScrollY);
      setLastScrollY(currentScrollY);

      // Reading progress
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min((currentScrollY / docHeight) * 100, 100) : 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const estimatedReadTime = Math.max(1, Math.round(chapter.word_count / 250));

  return (
    <div className="min-h-screen bg-bg">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-border/30">
        <motion.div
          className="h-full bg-accent"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Top Navigation Bar */}
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: showTopBar ? 0 : -80 }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 right-0 z-50 bg-bg/90 backdrop-blur-md border-b border-border"
      >
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          {/* Left: Back to novel */}
          <Link
            href={`/novel/${novel.slug}`}
            className="flex items-center gap-2 text-fg-muted hover:text-fg transition-colors min-w-0 flex-shrink"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm truncate max-w-[150px] sm:max-w-[250px]">
              {novel.title}
            </span>
          </Link>

          {/* Center: Chapter info (desktop) */}
          <div className="hidden md:block text-center">
            <span className="text-xs text-fg-muted">
              Ch. {chapter.chapter_number} &middot; {chapter.title}
            </span>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <ReaderControls
              settings={settings}
              updateSettings={updateSettings}
              resetSettings={resetSettings}
            />
          </div>
        </div>
      </motion.header>

      {/* Chapter Content */}
      <main className="pt-20 pb-24 px-4">
        <article
          className="mx-auto w-full"
          style={{
            maxWidth: mounted ? `${settings.maxWidth}px` : "720px",
          }}
        >
          {/* Chapter Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10 text-center"
          >
            <span className="text-xs font-semibold text-accent uppercase tracking-widest">
              Chapter {chapter.chapter_number}
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-fg mt-3 mb-4">
              {chapter.title}
            </h1>
            <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-fg-muted flex-wrap">
              <span>{chapter.word_count.toLocaleString()} words</span>
              <span>&middot;</span>
              <span>~{estimatedReadTime} min read</span>
              <span>&middot;</span>
              <span>{new Date(chapter.created_at).toLocaleDateString()}</span>
            </div>
          </motion.div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-10">
            <div className="flex-1 h-px bg-border" />
            <svg className="w-5 h-5 text-accent/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Chapter Body */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="chapter-content"
            style={{
              fontSize: mounted ? `${settings.fontSize}px` : "18px",
              fontFamily: mounted ? settings.fontFamily : undefined,
              lineHeight: mounted ? settings.lineHeight : 1.8,
            }}
            dangerouslySetInnerHTML={{
              __html: chapter.content
                // Strip inline font-family so the reader font setting applies
                .replace(/font-family\s*:[^;]*;?\s*/gi, "")
                // Strip inline color so the theme's --content-text / --content-heading apply
                .replace(/(?<![\w-])color\s*:[^;]*;?\s*/gi, "")
                // Clean up empty style attributes left behind
                .replace(/style="\s*"/gi, ""),
            }}
          />

          {/* End Divider */}
          <div className="flex items-center gap-4 mt-14 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-fg-muted uppercase tracking-wider">End of Chapter {chapter.chapter_number}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Like & Bookmark */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <LikeButton
              chapterId={chapter.id}
              initialCount={initialLikeCount}
              initialLiked={initialLiked}
              userId={userId}
            />
            <BookmarkButton
              chapterId={chapter.id}
              initialBookmarked={initialBookmarked}
              userId={userId}
            />
          </div>

          {/* Chapter Rating */}
          <div className="flex flex-col items-center gap-2 mb-10">
            <span className="text-xs text-fg-muted uppercase tracking-wider">Rate this chapter</span>
            <RatingStars
              type="chapter"
              targetId={chapter.id}
              userId={userId}
              initialAverage={initialRatingAverage}
              initialCount={initialRatingCount}
              initialUserRating={initialUserRating}
              onRate={rateChapter}
            />
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {prevChapter ? (
              <Link
                href={`/read/${prevChapter.id}`}
                className="flex-1 flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-accent/50 transition-all group"
              >
                <svg className="w-5 h-5 text-fg-muted group-hover:text-accent group-hover:-translate-x-1 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs text-fg-muted">Previous</p>
                  <p className="text-sm font-medium text-fg group-hover:text-accent transition-colors truncate">
                    Ch. {prevChapter.chapter_number}: {prevChapter.title}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex-1" />
            )}

            {nextChapter ? (
              <Link
                href={`/read/${nextChapter.id}`}
                className="flex-1 flex items-center justify-end gap-3 p-4 bg-surface border border-border rounded-xl hover:border-accent/50 transition-all group text-right"
              >
                <div className="min-w-0">
                  <p className="text-xs text-fg-muted">Next</p>
                  <p className="text-sm font-medium text-fg group-hover:text-accent transition-colors truncate">
                    Ch. {nextChapter.chapter_number}: {nextChapter.title}
                  </p>
                </div>
                <svg className="w-5 h-5 text-fg-muted group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : (
              <Link
                href={`/novel/${novel.slug}`}
                className="flex-1 flex items-center justify-center gap-2 p-4 bg-accent/10 border border-accent/20 rounded-xl hover:bg-accent/20 transition-all text-accent"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">You&apos;ve reached the latest chapter!</span>
              </Link>
            )}
          </div>

          {/* Back to novel page */}
          <div className="text-center mt-8">
            <Link
              href={`/novel/${novel.slug}`}
              className="text-sm text-fg-muted hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              All chapters
            </Link>
          </div>

          {/* Comments */}
          <CommentSection chapterId={chapter.id} userId={userId} />
        </article>
      </main>
    </div>
  );
}
