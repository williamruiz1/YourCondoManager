import { useState, useEffect, useCallback } from "react";

/**
 * Marketing hero carousel — rotates the 3 brand creatives on the landing page.
 * Auto-advances every 6s, pauses on hover, dot controls + prev/next, respects
 * prefers-reduced-motion. Creatives are shown in full (object-contain) on the
 * deep-teal brand panel so the baked-in headlines are never cropped.
 */
const SLIDES = [
  { src: "/hero/hero-overtime.png", alt: "Leadership shouldn't feel like overtime — simplify the work, strengthen your community." },
  { src: "/hero/hero-dues.png", alt: "See exactly where your dues go — total transparency, real-time clarity." },
  { src: "/hero/hero-clarity.png", alt: "From chaos to clarity — organize, protect, move forward." },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = useCallback((n: number) => setI((n + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-ycm-sky/10 rounded-2xl blur-3xl" aria-hidden="true" />
      <div
        className="relative rounded-2xl overflow-hidden shadow-lg border border-primary/15 bg-primary aspect-[5/4]"
        role="group"
        aria-roledescription="carousel"
        aria-label="Your Condo Manager — what we solve"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {SLIDES.map((s, idx) => (
          <img
            key={s.src}
            src={s.src}
            alt={idx === i ? s.alt : ""}
            aria-hidden={idx !== i}
            loading={idx === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ease-in-out ${idx === i ? "opacity-100" : "opacity-0"}`}
          />
        ))}

        {/* prev / next */}
        <button
          type="button"
          onClick={() => go(i - 1)}
          aria-label="Previous slide"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/25 text-white text-lg leading-none backdrop-blur-sm transition hover:bg-black/40"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => go(i + 1)}
          aria-label="Next slide"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/25 text-white text-lg leading-none backdrop-blur-sm transition hover:bg-black/40"
        >
          ›
        </button>

        {/* dots */}
        <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2">
          {SLIDES.map((_, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => go(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={idx === i}
              className={`h-2 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
