"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUILTIN_THEMES = ["the-void", "parchment", "blood-moon", "abyssal-sea", "ashen-ruins"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themes, setThemes] = useState<string[]>(BUILTIN_THEMES);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("custom_themes")
      .select("name")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const customNames = data.map((t) => t.name);
          setThemes([...BUILTIN_THEMES, ...customNames]);
        }
      });
  }, []);

  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="the-void"
      themes={themes}
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
