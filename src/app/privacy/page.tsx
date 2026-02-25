import Navbar from "@/components/navbar";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Kathion privacy policy — learn how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          {/* Header */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-fg mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-fg-muted mb-8">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <div className="w-16 h-1 rounded-full bg-accent mb-10" />

          <div className="prose-custom space-y-8 text-fg-muted leading-relaxed text-sm">
            {/* 1 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">1. Information We Collect</h2>
              <p>When you create an account on Kathion, we collect:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-fg">Account data</strong> — email address, display name, and avatar (if provided via a social login such as Google or GitHub).</li>
                <li><strong className="text-fg">Usage data</strong> — pages visited, chapters read, likes, bookmarks, favourites, ratings, and comments you submit.</li>
                <li><strong className="text-fg">Device data</strong> — IP address, browser type, and operating system. This is stored temporarily for spam prevention and comment moderation.</li>
              </ul>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">2. How We Use Your Data</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To provide and maintain the platform and your account.</li>
                <li>To display your public profile (display name and avatar) next to comments and interactions.</li>
                <li>To personalise your experience (bookmarks, favourites, reading settings).</li>
                <li>To moderate comments and prevent abuse (spam filtering, Cloudflare Turnstile verification).</li>
                <li>To calculate and display aggregate ratings and read counts.</li>
              </ul>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">3. Third-Party Services</h2>
              <p>Kathion relies on the following third-party services:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-fg">Supabase</strong> — authentication, database, and file storage.</li>
                <li><strong className="text-fg">Cloudflare Turnstile</strong> — bot protection on comment forms.</li>
                <li><strong className="text-fg">Vercel</strong> — hosting and deployment.</li>
              </ul>
              <p className="mt-2">
                Each service has its own privacy policy. We encourage you to review them.
              </p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">4. Cookies & Local Storage</h2>
              <p>
                We use <strong className="text-fg">cookies</strong> to maintain your authentication session.
                We also use <strong className="text-fg">local storage</strong> to save your reading preferences
                (theme, font size, line height) so they persist across visits. No advertising cookies are used.
              </p>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">5. Data Sharing</h2>
              <p>
                We do <strong className="text-fg">not</strong> sell, trade, or rent your personal information
                to third parties. Data is only shared with the service providers listed above, solely for
                the purposes of running the platform.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">6. Data Retention</h2>
              <p>
                Your account data is retained as long as your account exists. If you delete your account,
                your personal data will be removed. Comments and ratings may be anonymised and retained
                for platform integrity.
              </p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">7. Your Rights</h2>
              <p>
                You have the right to access, correct, or delete your personal data at any time.
                To make a request, contact us at{" "}
                <a href="mailto:mazenemad099@gmail.com" className="text-accent hover:underline">
                  mazenemad099@gmail.com
                </a>.
              </p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">8. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. Any changes will be posted on this
                page with an updated revision date.
              </p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-lg font-bold text-fg mb-2">9. Contact</h2>
              <p>
                If you have any questions about this policy, reach out at{" "}
                <a href="mailto:mazenemad099@gmail.com" className="text-accent hover:underline">
                  mazenemad099@gmail.com
                </a>.
              </p>
            </section>
          </div>

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
