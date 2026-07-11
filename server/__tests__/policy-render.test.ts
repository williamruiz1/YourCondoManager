import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { renderPolicyHtml, wantsHtml } from "../policy-render";

const SAMPLE_MD = `# Privacy Policy

**YourCondoManager (YCM)**

## 1. Introduction

We collect **minimum** data. Visit [our site](https://yourcondomanager.org).

| Your role | Where you appear |
|---|---|
| **Board member** | \`admin_users\` |
| Owner | \`portal_access\` |

- First point
- Second point
`;

function fakeReq(opts: { accept?: string; query?: Record<string, unknown> }): Request {
  return {
    headers: { accept: opts.accept },
    query: opts.query ?? {},
  } as unknown as Request;
}

describe("renderPolicyHtml", () => {
  const html = renderPolicyHtml(SAMPLE_MD, "Privacy Policy");

  it("renders a full HTML document, not raw markdown", () => {
    expect(html).toMatch(/^<!doctype html>/i);
    // No literal markdown leaking through.
    expect(html).not.toContain("# Privacy Policy");
    expect(html).not.toContain("**YourCondoManager");
    expect(html).not.toMatch(/\|\s*Your role\s*\|/);
  });

  it("renders the heading as an <h1>, not a literal '# '", () => {
    expect(html).toMatch(/<h1[^>]*>\s*Privacy Policy\s*<\/h1>/);
  });

  it("renders **bold** as <strong>", () => {
    expect(html).toMatch(/<strong>minimum<\/strong>/);
  });

  it("renders the markdown table as a real <table> with <th>/<td>", () => {
    expect(html).toContain("<table>");
    expect(html).toMatch(/<th[^>]*>Your role<\/th>/);
    expect(html).toMatch(/<td[^>]*>Owner<\/td>/);
  });

  it("renders links as <a href>", () => {
    expect(html).toMatch(/<a href="https:\/\/yourcondomanager\.org">our site<\/a>/);
  });

  it("renders list items as <li>", () => {
    expect(html).toMatch(/<li>First point<\/li>/);
  });

  it("sets the document <title> from the passed title", () => {
    expect(html).toContain("<title>Privacy Policy — Your Condo Manager</title>");
  });

  it("applies on-brand YCM teal styling", () => {
    expect(html).toContain("#014D4A"); // Deep Teal primary
  });
});

describe("wantsHtml — content negotiation", () => {
  it("returns true for a browser Accept header", () => {
    expect(wantsHtml(fakeReq({ accept: "text/html,application/xhtml+xml,*/*;q=0.8" }))).toBe(true);
  });

  it("returns false for curl / wildcard Accept (machine clients get raw markdown)", () => {
    expect(wantsHtml(fakeReq({ accept: "*/*" }))).toBe(false);
  });

  it("returns false when no Accept header is sent", () => {
    expect(wantsHtml(fakeReq({}))).toBe(false);
  });

  it("returns false for Accept: text/plain (auditor tooling)", () => {
    expect(wantsHtml(fakeReq({ accept: "text/plain" }))).toBe(false);
  });

  it("forces raw markdown with ?format=md / ?raw even from a browser", () => {
    expect(wantsHtml(fakeReq({ accept: "text/html", query: { format: "md" } }))).toBe(false);
    expect(wantsHtml(fakeReq({ accept: "text/html", query: { raw: "1" } }))).toBe(false);
  });

  it("forces HTML with ?format=html even from a machine client", () => {
    expect(wantsHtml(fakeReq({ accept: "*/*", query: { format: "html" } }))).toBe(true);
  });
});
