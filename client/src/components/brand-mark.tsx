type BrandMarkProps = {
  className?: string;
  /** Set aria-hidden when the mark is decorative beside a visible wordmark. */
  decorative?: boolean;
};

/**
 * YCM brand mark — buildings-only (no app-icon frame).
 *
 * Theme-aware: V6 "Earth base" (light) — cream side buildings with slate
 * stroke, cool-white center, extended cream ground for white-bg contrast.
 * V9 "Deep slate" (dark) — deeper slate sides, slate-sky center, teal
 * ground band. Renders the right one based on Tailwind's `dark` class on
 * `<html>`. App icons (favicon / PWA / apple-touch / push) use the full
 * canonical rounded-square form, not this mark.
 */
export function BrandMark({ className, decorative = false }: BrandMarkProps) {
  const alt = decorative ? "" : "Your Condo Manager";
  const ariaHidden = decorative ? true : undefined;
  return (
    <>
      <img
        src="/brand/ycm-logo-mark-light.svg"
        alt={alt}
        aria-hidden={ariaHidden}
        className={`${className ?? ""} dark:hidden`}
      />
      <img
        src="/brand/ycm-logo-mark-dark.svg"
        alt=""
        aria-hidden={true}
        className={`${className ?? ""} hidden dark:block`}
      />
    </>
  );
}
