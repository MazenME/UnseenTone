import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kathion — Dark Fantasy Novels",
    template: "%s | Kathion",
  },
  description:
    "Kathion is a dark fantasy novel platform. Read chapters, rate stories, track your progress, and join a community of readers who crave the unknown.",
  keywords: [
    "dark fantasy",
    "novels",
    "web novels",
    "reading platform",
    "Kathion",
    "chapters",
    "fiction",
    "fantasy books",
  ],
  authors: [{ name: "Mazen Emad Ramadan" }],
  creator: "Mazen Emad Ramadan",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Kathion",
    title: "Kathion — Dark Fantasy Novels",
    description:
      "Kathion is a dark fantasy novel platform. Read chapters, rate stories, and join the community.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kathion — Dark Fantasy Novels",
    description:
      "A dark fantasy novel platform. Read, rate, and discover stories.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-bg text-fg`}
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
