/**
 * Per-community OpenGraph / link-preview injection.
 *
 * The app is a single-page app: every route is served the SAME `index.html`,
 * whose OpenGraph tags are hardcoded to the generic platform card ("Your Condo
 * Manager - Condo Property Management Platform"). Link crawlers (iMessage,
 * Slack, Facebook, X) do NOT run client JS, so when an owner shares a community
 * link like `/community/cherryhill` they see the generic platform card instead
 * of that community's own name/description/image. (William 2026-06-30.)
 *
 * Fix: intercept `GET /community/:identifier` HTML navigations on the SERVER,
 * look up that community's public hub config, and rewrite the OG/Twitter tags
 * in the served HTML with the community's own title, description, and image.
 * Asset requests and unknown/disabled communities fall through to the normal
 * index.html (this never breaks the page — any error falls through).
 */
import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { hubPageConfigs, associations } from "@shared/schema";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function registerCommunityOgRoute(app: Express, distPath: string): void {
  const indexPath = path.resolve(distPath, "index.html");

  app.get(
    "/community/:identifier",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Only intercept HTML navigations / crawlers — let asset + data
        // requests (and anything not asking for HTML) fall through untouched.
        const accept = String(req.headers.accept || "");
        if (!accept.includes("text/html")) return next();

        const identifier = String(req.params.identifier || "");
        if (!identifier) return next();

        // Same lookup as GET /api/hub/:identifier/public — slug first, then id.
        let config = (
          await db
            .select()
            .from(hubPageConfigs)
            .where(eq(hubPageConfigs.slug, identifier))
        )[0];
        if (!config) {
          config = (
            await db
              .select()
              .from(hubPageConfigs)
              .where(eq(hubPageConfigs.associationId, identifier))
          )[0];
        }
        // Unknown or disabled community → serve the normal (generic) page.
        if (!config || !config.isEnabled) return next();

        const [assoc] = await db
          .select({
            name: associations.name,
            city: associations.city,
            state: associations.state,
          })
          .from(associations)
          .where(eq(associations.id, config.associationId));

        const proto =
          (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
        const host = req.headers.host || "app.yourcondomanager.org";
        const baseUrl = `${proto}://${host}`;
        const pageUrl = `${baseUrl}/community/${encodeURIComponent(identifier)}`;

        const name = assoc?.name || "Community";
        const locality = [assoc?.city, assoc?.state].filter(Boolean).join(", ");
        const title = locality ? `${name} — ${locality}` : name;
        const desc =
          (config.communityDescription && config.communityDescription.trim()) ||
          `${name}'s community portal — notices, documents, and owner login.`;
        let image =
          config.bannerImageUrl || config.logoUrl || "/brand/og-image.png";
        if (image && !/^https?:\/\//i.test(image)) {
          image = `${baseUrl}${image.startsWith("/") ? "" : "/"}${image}`;
        }

        let html = fs.readFileSync(indexPath, "utf8");

        // Drop the hardcoded generic OG/Twitter tags, then inject per-community
        // ones just before </head>. Leaves <title>/<meta name="description">
        // (the SPA can still update those client-side for human viewers).
        html = html
          .replace(/[ \t]*<meta\s+property="og:[^>]*>\s*\n?/gi, "")
          .replace(/[ \t]*<meta\s+name="twitter:[^>]*>\s*\n?/gi, "");

        const tags = [
          `<meta property="og:type" content="website" />`,
          `<meta property="og:site_name" content="YourCondoManager" />`,
          `<meta property="og:title" content="${esc(title)}" />`,
          `<meta property="og:description" content="${esc(desc)}" />`,
          `<meta property="og:image" content="${esc(image)}" />`,
          `<meta property="og:url" content="${esc(pageUrl)}" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<meta name="twitter:title" content="${esc(title)}" />`,
          `<meta name="twitter:description" content="${esc(desc)}" />`,
          `<meta name="twitter:image" content="${esc(image)}" />`,
        ].join("\n    ");

        html = html.replace(/<\/head>/i, `    ${tags}\n  </head>`);

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        return res.status(200).send(html);
      } catch {
        // Never break the page — fall through to the normal index.html.
        return next();
      }
    },
  );
}
