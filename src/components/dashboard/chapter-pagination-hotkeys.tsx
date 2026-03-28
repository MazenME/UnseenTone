"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ChapterPaginationHotkeysProps {
  prevHref?: string;
  nextHref?: string;
}

export default function ChapterPaginationHotkeys({
  prevHref,
  nextHref,
}: ChapterPaginationHotkeysProps) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isTypingTarget =
          target.isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT";
        if (isTypingTarget) return;
      }

      const key = event.key.toLowerCase();
      const code = event.code;
      const wantsPrev =
        event.key === "ArrowLeft" ||
        code === "ArrowLeft" ||
        code === "KeyA" ||
        key === "a";
      const wantsNext =
        event.key === "ArrowRight" ||
        code === "ArrowRight" ||
        code === "KeyD" ||
        key === "d";

      if (wantsPrev && prevHref) {
        event.preventDefault();
        router.push(prevHref);
      }

      if (wantsNext && nextHref) {
        event.preventDefault();
        router.push(nextHref);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextHref, prevHref, router]);

  return null;
}
