type BrandMarkProps = {
  className?: string;
  /** Set aria-hidden when the mark is decorative beside a visible wordmark. */
  decorative?: boolean;
  /**
   * Override theme detection for surfaces whose page background dictates a
   * specific variant regardless of the global light/dark mode. E.g. the
   * owner-portal-login left section uses bg-ycm-sky and needs the V9 dark
   * mark for contrast even when the app is in light mode.
   */
  forceTheme?: "light" | "dark";
};

/**
 * YCM brand mark — buildings-only (no app-icon frame).
 *
 * Theme-aware: V6 "Earth base" (light) — cream side buildings with slate
 * stroke, cool-white center, extended cream ground for white-bg contrast.
 * V9 "Deep slate" (dark) — deeper slate sides, slate-sky center, teal
 * ground band. Renders the right one based on Tailwind's `dark` class on
 * `<html>`, unless `forceTheme` overrides. App icons (favicon / PWA /
 * apple-touch / push) use the full canonical rounded-square form, not
 * this mark.
 */
export function BrandMark({ className, decorative = false, forceTheme }: BrandMarkProps) {
  const alt = decorative ? "" : "Your Condo Manager";
  const ariaHidden = decorative ? true : undefined;
  const base = className ?? "";

  if (forceTheme === "light") {
    return (
      <img
        src="/brand/ycm-logo-mark-light.svg"
        alt={alt}
        aria-hidden={ariaHidden}
        className={base}
      />
    );
  }
  if (forceTheme === "dark") {
    return (
      <img
        src="/brand/ycm-logo-mark-dark.svg"
        alt={alt}
        aria-hidden={ariaHidden}
        className={base}
      />
    );
  }
  return (
    <>
      <img
        src="/brand/ycm-logo-mark-light.svg"
        alt={alt}
        aria-hidden={ariaHidden}
        className={`${base} dark:hidden`}
      />
      <img
        src="/brand/ycm-logo-mark-dark.svg"
        alt=""
        aria-hidden={true}
        className={`${base} hidden dark:block`}
      />
    </>
  );
}
