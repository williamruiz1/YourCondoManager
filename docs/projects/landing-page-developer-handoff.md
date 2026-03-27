# Developer Handoff — Landing Page Redesign
## CondoManager Public Site

**Date:** 2026-03-25
**File:** `client/src/pages/landing.tsx`
**Status:** Design complete, accessibility-validated, implementation live

---

## Typography System

| Role | CSS Variable | Font | Usage in landing page |
|---|---|---|---|
| Headline | `--font-headline` | Newsreader, serif | Section headings, bento titles (`font-headline`) |
| Hero / Display | `--font-serif` | Lora, Georgia, serif | Hero H1, logo wordmark (`font-serif italic`) |
| Body | `--font-body` | Manrope, sans-serif | Body copy, features, proof points (`font-body`) |
| Label | `--font-label` | Manrope, sans-serif | Small caps labels, toggle label (`font-label`) |
| UI / Sans | `--font-sans` | Geist, sans-serif | Button text, default prose |

**Scale in use:**
- Hero H1: `text-5xl md:text-6xl lg:text-7xl font-bold` (`font-serif`)
- Section H2: `text-4xl md:text-5xl font-bold` (`font-serif` or `font-headline`)
- Section H2 (bento): `text-3xl md:text-4xl font-bold` (`font-headline`)
- Card H3: `text-xl font-bold` (`font-headline`)
- Body / subhead: `text-lg md:text-xl` or `text-sm` (`font-body`)
- Small caps label: `text-xs md:text-sm font-bold uppercase tracking-widest` (`font-label`)

---

## Color Token System

Tokens are CSS variables defined in `client/src/index.css`, extended in `tailwind.config.ts`.

### Primary Blues
| Token | Hex (approx) | Usage |
|---|---|---|
| `primary` | `hsl(217 91% 42%)` ≈ `#0C56D0` | CTAs, links, icons, active states |
| `primary-container` | `#0052cc` | CTA gradient endpoint, featured bento card bg |
| `on-primary` | `#ffffff` | Text on primary buttons |
| `on-primary-container` | `#c4d2ff` | Text on featured bento card |

### Surface Scale (light mode)
| Token | Hex | Usage |
|---|---|---|
| `surface-container-lowest` | `#ffffff` | Card backgrounds |
| `surface-container-low` | `#f3f4f5` | Subtle bg areas |
| `surface-container` | `#edeeef` | Persona toggle section bg |
| `surface-container-high` | `#e7e8e9` | Toggle pill container bg |
| `surface-container-highest` | `#e1e3e4` | Compliance section bg tint |

### Text
| Token | Hex | Usage |
|---|---|---|
| `on-surface` | `#191c1d` | Primary headings and body text |
| `on-surface-variant` | `#434654` | Secondary body, descriptions (contrast ~9:1 ✅ WCAG AA) |
| `outline-variant` | `#c3c6d6` | Card borders, dividers |

### Secondary / Accent
| Token | Hex | Usage |
|---|---|---|
| `secondary-container` | `#b6c8fe` | "Architecture of Trust" badge bg |
| `on-secondary-container` | `#415382` | Badge text |

---

## Spacing & Border Radius

Defined in `tailwind.config.ts`:

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` | `3px` | Subtle radius (badges, small pills) |
| `rounded-md` | `6px` | Default buttons |
| `rounded` / `rounded-lg` | `9px` | Standard cards, inputs |
| `rounded-xl` | `12px` | Feature cards, compliance container |
| `rounded-2xl` | `16px` | Compliance section wrapper |
| `rounded-3xl` | `24px` | Dark CTA canvas |
| `rounded-full` | `50%` | Icon circles (compliance icons), pills |

**Page max-width:** `max-w-7xl` (1280px), centered, `px-8` padding on mobile.

---

## Shadow System

Defined as CSS variables in `client/src/index.css`:

| Variable | Usage in landing page |
|---|---|
| `--shadow-sm` | Feature cards (`shadow-sm`) |
| `--shadow-lg` | Hero dashboard card (`shadow-lg`), security log card (`shadow-lg`) |

---

## Component Usage

### Buttons
The landing page uses a mix of `<Button>` (shadcn/ui) and raw `<button>` elements.

**Primary gradient CTA** (hero "Get Started Free"):
```tsx
<button className="bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
```

**Primary solid CTA** (persona section):
```tsx
<button className="bg-primary text-white px-8 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity">
```

**Ghost/outline CTA**:
```tsx
<button className="border border-primary text-primary px-8 py-3 rounded-lg font-bold hover:bg-primary/5 transition-colors">
```

**Dark CTA canvas — white button**:
```tsx
<button className="bg-white text-slate-900 px-8 py-4 rounded-lg font-bold hover:bg-slate-100 transition-colors">
```

### Badge (section pill)
Uses shadcn `<Badge>` component:
```tsx
<Badge className="mb-4">{content.badge}</Badge>
```
Also: custom `<span>` pill for "Architecture of Trust":
```tsx
<span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold tracking-widest uppercase mb-4">
```

### Icons
Two icon systems in use:
- **Lucide React** — used in persona feature cards, proof checkmarks, nav/footer UI
- **Material Symbols Outlined** — used in hero card, bento grid, compliance section (loaded via font)

Material Symbol usage:
```tsx
<span className="material-symbols-outlined" aria-hidden="true">icon_name</span>
// With fill variant:
<span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}} aria-hidden="true">icon_name</span>
```

---

## Section Inventory

| Section | ID / key class | Notes |
|---|---|---|
| Nav | `<header>` fixed top | Scroll-triggered `backdrop-blur-xl`; mobile hamburger dropdown |
| Hero | `id="main-content"` | Two-column `lg:grid-cols-2`; right column hidden on mobile |
| Persona toggle | `role="group"` | `aria-pressed` on each button; `aria-live` on content |
| Persona content | `aria-live="polite"` | 160ms opacity fade on persona switch |
| Bento grid | `lg:grid-cols-4` | 6 regular cards + 1 `md:col-span-2` featured card |
| Compliance & Security | — | Two-column: copy + security log mockup |
| Dark CTA canvas | `bg-slate-900 rounded-3xl` | Background image + two CTAs |
| Footer | `role="contentinfo"` | 4-column grid; `aria-label` on nav sections |

---

## Interaction Behaviors

### Persona toggle
- **Trigger:** click any persona button
- **Effect:** 160ms opacity fade on content div (`transition-opacity duration-160`)
- **State:** `persona` (useState), `animating` (useState)
- **Flow:** `setAnimating(true)` → 160ms timeout → `setPersona(next)` → `setAnimating(false)`

### Navigation scroll effect
- **Trigger:** `window.scrollY > 24`
- **Effect:** `scrolled` state set — nav background shifts from transparent to `bg-white/80 backdrop-blur-xl`
- **Note:** `scrolled` state is tracked but the class switch is on the header's static classes (`bg-white/80` always on). `scrolled` is available for further scroll-aware effects.

### Mobile menu
- **Trigger:** hamburger button click
- **Effect:** dropdown reveals below nav header
- **State:** `mobileMenuOpen` (useState)

### Demo modal
- **Trigger:** "Schedule Demo", "Speak with an Expert", and persona secondary CTA buttons
- **Effect:** `DemoRequestModal` opens (state: `demoModalOpen`)
- **Component:** `client/src/components/demo-request-modal.tsx`

---

## Accessibility Checklist (validated 2026-03-25)

| Check | Status |
|---|---|
| Skip-to-content link | ✅ `<a href="#main-content">` with `sr-only focus:not-sr-only` |
| `aria-current="page"` on active nav link | ✅ Platform link |
| Main landmark `id="main-content"` | ✅ Hero section |
| Nav `aria-label` | ✅ "Main navigation" |
| Footer `role="contentinfo"` | ✅ |
| Footer nav `aria-label` | ✅ Solutions, Company |
| Social links `aria-label` | ✅ |
| Persona toggle `role="group"` + `aria-labelledby` | ✅ |
| Persona buttons `aria-pressed` | ✅ |
| Persona content `aria-live="polite"` | ✅ |
| Decorative icons `aria-hidden="true"` | ✅ All Material Symbol decorative icons |
| CTA focus rings `focus-visible:outline` | ✅ Primary CTAs |
| Nested anchor removal (footer) | ✅ `<Link>` without child `<a>` |
| Text contrast `on-surface-variant` on white | ✅ ~9:1 ratio (WCAG AA requires 4.5:1) |
| Text contrast `primary` on white | ✅ ~5.8:1 ratio |
| Mobile breakpoints present | ✅ All sections have `md:` and `lg:` variants |

---

## Known Limitations / Future Work

- `scrolled` state is computed but nav styling uses static `bg-white/80` — wire if a fully transparent initial nav is desired
- Hero image is served from an external CDN URL — consider migrating to a self-hosted asset for production
- "1,500+ communities" and "$4B in assets" social proof stats are hardcoded — connect to a CMS or config variable when stats are verified
- Cookie Settings link in footer is `href="#"` — wire to actual cookie consent mechanism
- Footer social links are `href="#"` — wire to real social profiles before launch
