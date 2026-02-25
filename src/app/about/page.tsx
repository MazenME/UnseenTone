import Navbar from "@/components/navbar";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Kathion — a dark fantasy novel platform built for readers and storytellers.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          {/* Header */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-fg mb-2">
            About <span className="text-accent">Kathion</span>
          </h1>
          <div className="w-16 h-1 rounded-full bg-accent mb-8" />

          {/* About the Platform */}
          <section className="space-y-5 text-fg-muted leading-relaxed">
            <p>
              <strong className="text-fg">Kathion</strong> is a dark fantasy novel
              platform crafted for readers who crave immersive storytelling. Every
              chapter is designed to pull you deeper into worlds of forgotten gods,
              shattered kingdoms, and the unseen forces that shape fate.
            </p>
            <p>
              The platform lets you read novels chapter by chapter, rate stories and
              chapters on a 1–10 scale, bookmark your favourite moments, leave
              comments, and interact with other readers through likes, dislikes, and
              threaded replies.
            </p>
            <p>
              Whether you&rsquo;re here to discover your next obsession or follow
              an ongoing saga, Kathion is built to give you a clean, dark-themed
              reading experience with zero distractions.
            </p>
          </section>

          {/* Features */}
          <section className="mt-12">
            <h2 className="text-xl font-bold text-fg mb-5">What you can do</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  ),
                  title: "Read Novels",
                  desc: "Browse and read dark fantasy novels chapter by chapter.",
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  ),
                  title: "Rate & Review",
                  desc: "Rate novels and individual chapters out of 10.",
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                  ),
                  title: "Bookmark & Favourite",
                  desc: "Save chapters and novels to your personal library.",
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  ),
                  title: "Comment & Discuss",
                  desc: "Threaded comments with likes, dislikes, and replies.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-surface border border-border rounded-xl p-4 flex gap-3 items-start"
                >
                  <div className="p-2 rounded-lg bg-accent/10 text-accent flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-fg">{item.title}</h3>
                    <p className="text-xs text-fg-muted mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Developer */}
          <section className="mt-14 bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold text-fg mb-4">Developer</h2>
            <div className="space-y-2 text-sm text-fg-muted">
              <p>
                <span className="text-fg font-medium">Name:</span>{" "}
                Mazen Emad Ramadan
              </p>
              <p>
                <span className="text-fg font-medium">Email:</span>{" "}
                <a
                  href="mailto:mazenemad099@gmail.com"
                  className="text-accent hover:underline"
                >
                  mazenemad099@gmail.com
                </a>
              </p>
            </div>
          </section>

          {/* Back */}
          <div className="mt-10">
            <Link
              href="/"
              className="text-sm text-fg-muted hover:text-accent transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Library
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
