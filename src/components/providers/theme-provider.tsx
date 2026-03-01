"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

const BUILTIN_THEMES = ["the-void", "parchment", "blood-moon", "abyssal-sea", "ashen-ruins"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="the-void"
      themes={BUILTIN_THEMES}
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
