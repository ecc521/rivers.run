import DOMPurify from "dompurify";

// Force all target blank links to have noopener noreferrer to prevent reverse tabnapping
DOMPurify.addHook("afterSanitizeAttributes", function (node) {
  if (node.tagName === "A") {
    // If it's a link, we ensure it opens in a new tab securely to keep users in the app
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * Uses DOMPurify with strict settings, stripping inline styles.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ["style"],
    FORBID_TAGS: ["style"],
  });
}
