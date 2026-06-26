// @vitest-environment jsdom
//
// This suite runs under jsdom instead of the project-wide happy-dom default.
// DOMPurify 3.4.8+ walks the DOM with createNodeIterator for template scrubbing,
// and happy-dom's createNodeIterator implementation is incomplete — it makes
// DOMPurify silently strip wrapper elements while leaking <script> bodies as text.
// That is a happy-dom bug, not a sanitizer regression: under jsdom (and every real
// browser) DOMPurify sanitizes correctly. jsdom's spec-complete DOM is what we want
// to validate the production behavior against.
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("returns empty string when input is empty or falsy", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null as any)).toBe("");
    expect(sanitizeHtml(undefined as any)).toBe("");
  });

  it("sanitizes script tags to prevent XSS", () => {
    const input = '<div>Hello <script>alert("XSS")</script> World</div>';
    const output = sanitizeHtml(input);
    expect(output).not.toContain("<script>");
    expect(output).not.toContain("alert");
    expect(output).toBe("<div>Hello  World</div>");
  });

  it("removes forbidden style attributes", () => {
    const input = '<div style="color: red; position: absolute; left: 0;">Text</div>';
    const output = sanitizeHtml(input);
    expect(output).not.toContain("style");
    expect(output).toBe("<div>Text</div>");
  });

  it("removes forbidden style tags", () => {
    const input = "<style>body { background: red; }</style><div>Text</div>";
    const output = sanitizeHtml(input);
    expect(output).not.toContain("<style>");
    expect(output).toBe("<div>Text</div>");
  });

  it("rewrites all <a> tags to include target='_blank' and rel='noopener noreferrer'", () => {
    const input = '<a href="https://rivers.run">Rivers.run</a>';
    const output = sanitizeHtml(input);
    expect(output).toContain('target="_blank"');
    expect(output).toContain('rel="noopener noreferrer"');
  });

  it("overrides existing target and rel attributes to prevent reverse tabnapping", () => {
    const input = '<a href="https://rivers.run" target="_self" rel="author">Rivers.run</a>';
    const output = sanitizeHtml(input);
    expect(output).toContain('target="_blank"');
    expect(output).toContain('rel="noopener noreferrer"');
    expect(output).not.toContain('target="_self"');
    expect(output).not.toContain('rel="author"');
  });
});
