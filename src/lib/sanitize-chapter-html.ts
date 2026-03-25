import sanitizeHtml from "sanitize-html";

export function sanitizeChapterHtml(content: string): string {
  return sanitizeHtml(content || "", {
    allowedTags: [
      "p",
      "br",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "u",
      "s",
      "span",
      "a",
      "code",
      "pre",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      span: ["dir", "lang"],
      p: ["dir", "lang"],
      h1: ["dir", "lang"],
      h2: ["dir", "lang"],
      h3: ["dir", "lang"],
      h4: ["dir", "lang"],
      h5: ["dir", "lang"],
      h6: ["dir", "lang"],
      li: ["dir", "lang"],
      blockquote: ["dir", "lang"],
      code: ["class"],
      pre: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "nofollow noopener noreferrer",
      }),
    },
  });
}
