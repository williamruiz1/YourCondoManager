import type { Page } from "@playwright/test";

/**
 * page.goto that absorbs webkit's interrupted-navigation replay
 * (founder-os#8337 gate revival). On webkit, a client-side redirect racing a
 * document load makes page.goto throw "Navigation to X is interrupted by
 * another navigation to Y" — and webkit then KEEPS the interrupted entry
 * queued and replays it against the NEXT goto, so a single retry just moves
 * the failure downstream. This helper retries the goto (bounded), letting the
 * replayed entry land and settle between attempts, then verifies the page
 * actually sits on the requested path. Chromium and firefox never take the
 * retry branch. Assertions after the goto are untouched — this stabilizes the
 * transport, not the contract.
 */
export async function gotoStable(page: Page, path: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.goto(path);
      // Let any queued client-side navigation replay + settle now, so it
      // cannot interrupt the NEXT goto.
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
      const want = path.split("?")[0];
      const at = new URL(page.url()).pathname;
      if (at === want) return;
      // A replayed navigation moved us — try again.
      lastErr = new Error(`gotoStable: landed on ${at}, wanted ${want}`);
      continue;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("interrupted by another navigation")) throw err;
      lastErr = err;
      await page.waitForLoadState("load").catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  throw lastErr;
}
