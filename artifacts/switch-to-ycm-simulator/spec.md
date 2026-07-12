# Switch to YCM Simulator — Spec + Wireframes

**Status:** DESIGN (spec only — not a build)
**Product:** YourCondoManager (YCM) · marketing-site growth feature
**Feeds:** Project Statecraft (lead-gen → migration funnel)
**Date:** 2026-06-20
**Author:** design pass, 2026-06-20
**Worked example:** `~/Downloads/Paddlers Cove Informational Meeting Notice.pdf` (Paddlers Cove POA, Clover SC — managed by CAMS)

---

## 0. One-line concept

An HOA owner or board member drops their current management company's financial report (a budget / balance sheet PDF) into a wizard and gets an **instant, grounded analysis** — concerning charges flagged, budget-vs-actual variance, reserve-health verdict, and management-fee benchmark — ending in a **conservative savings verdict if they switch to YCM** and a low-friction CTA to YCM's sales team for a migration plan + potential discount.

This is the top of the Project Statecraft funnel: a self-serve "audit" turns a board member's vague dissatisfaction into a quantified, shareable case for switching, and hands YCM sales a warm lead with the prospect's own numbers already parsed.

---

## 1. Wizard UX / flow (4 steps, low friction)

Designed for a board treasurer or owner on desktop or mobile, no login required to see the verdict. The lead-capture gate sits **just before the dollar figure** (verdict teaser visible, exact number gated) — the standard "value-first, capture-at-the-aha" pattern.

```
STEP 1 — LANDING / DROP        STEP 2 — ANALYZING            STEP 3 — RESULTS DASHBOARD     STEP 4 — VERDICT + CTA
(hero + drag-drop)        →    (parse + flag, ~8-20s)   →    (flags, variance, reserve,  →  (savings range, gated,
                                                             fee benchmark, peer bench)     book-a-call / migration plan)
```

### Step 1 — Landing & upload
- **Hero copy:** "Is your HOA overpaying its management company? Drop your latest budget or financial report. Get an instant read in under a minute."
- **Drop zone:** drag-and-drop or click-to-browse. Accepts **PDF** (budget, balance sheet, P&L, board packet). Soft-accepts CSV/XLSX later (MVP = PDF).
- **Trust strip directly under the drop zone** (load-bearing — see §3): "We analyze in-browser/securely, never store your document without consent, and never share it. This is an estimate — verify with us."
- **No-document escape hatch:** "Don't have a report handy? Answer 5 quick questions instead →" routes to a manual-input mini-form (door count, annual assessment income, management fee, reserve balance, biggest 3 line items). Keeps the funnel alive when the PDF isn't at hand.
- **What we accept** helper: small list of recognized formats ("CAMS / Vantaca / CINC / AppFolio / QuickBooks exports and most PDF budgets").

### Step 2 — Analyzing (loading state)
- Animated, **honest** progress with named sub-steps so the wait feels like work, not a spinner:
  1. "Reading your document…" (text/table extraction)
  2. "Identifying line items…" (categorization)
  3. "Checking budget vs. actual…" (variance pass)
  4. "Benchmarking against peer HOAs…" (benchmark join)
  5. "Calculating your switch verdict…"
- Typical 8–20s. If parse confidence is low, this step ends in a **"help us read it"** correction screen (see §2.6) rather than a wrong answer.
- Quietly fires the lead-intent event (anonymous) so sales sees engagement even if the user bounces before capture.

### Step 3 — Results dashboard
Four stacked cards (one screen on desktop, scroll on mobile). All numbers cite the source line so the board member trusts them.

1. **Concerning charges & anomalies** — flagged line items with a one-line "why this is flagged" and the dollar amount. Color-coded severity (red = hard flag, amber = watch).
2. **Budget vs. actual variance** — the biggest over/under-spends, % and $, with the worst offenders surfaced first.
3. **Reserve health** — % funded estimate (or "no reserve study detected" flag), reserve balance, annual contribution, and the single most important verdict line ("Underfunded / Healthy / Unknown — no study on file").
4. **Management-fee benchmark** — fee per door per month vs. the peer band, plus total admin overhead as a % of assessments.

A persistent **"Estimate — verify with us"** ribbon stays on screen.

### Step 4 — Savings verdict + lead capture + sales CTA
- **Verdict teaser (ungated):** a qualitative headline + a **blurred/locked dollar range** — e.g. "We estimate Paddlers Cove could save **\$██,███–\$██,███/yr** by switching to YCM. Unlock your number ↓".
- **Lead-capture gate:** name, email, HOA name, role (board member / owner / manager), door count (pre-filled from parse), phone (optional). One-click "Show my savings."
- **On submit → unlock:** the dollar range reveals, with a **conservative low / likely / high** band and a plain-English breakdown of where it comes from (lower mgmt fee, reserve-study-driven avoided special assessment, reduced variance leakage). Every number labeled **estimate**.
- **Three CTAs, descending commitment:**
  1. **Book a 20-min migration call** (primary — calendar embed)
  2. **Request a written migration plan** (sends the parsed analysis + a tailored switch plan to sales; sales replies with a plan)
  3. **See if you qualify for a switch discount** (discount/onboarding-credit offer — see §4)
- **Shareable:** "Email this analysis to your board" → generates a clean, branded PDF/page summary the prospect forwards to fellow board members (built-in virality; boards decide as a group).

---

## 2. The analysis engine (logic, not code)

The engine has four passes: **extract → categorize → flag → score-and-verdict.** All thresholds are conservative and labeled estimates. It never asserts wrongdoing — it flags *for the board's attention* and frames everything as "worth asking your manager about."

### 2.1 Extract — line items from a dropped report
- **Text + table extraction** from the PDF (digital-native first; OCR fallback for scanned reports).
- **Recognize the report archetype:** annual budget (multi-year Budget vs Actual columns, like Paddlers Cove's FY24/FY25/FY26 grid), balance sheet (Operating / Reserve / Total columns), or P&L. The Paddlers Cove example has **both** a budget and a balance sheet — the engine should detect and use each.
- **Pull the canonical fields** per archetype:
  - *Budget:* per-line account code + name, Budget vs Actual per year, totals by section (Admin / R&M / Grounds / Utilities), Operating Fund Net Total, Reserve Fund income & expense.
  - *Balance sheet:* total cash (operating vs reserve split), reserve fund balance, accounts receivable, accounts payable, prepaid/deferred assessments.
- **Infer scale:** door count from assessment income ÷ typical per-door assessment, or directly if stated. (Paddlers Cove: ~$547K assessments + $92K townhome master fees → a multi-hundred-door community.)
- **Parse confidence score.** Below threshold → §2.6 correction screen, never a confident wrong number.

### 2.2 Categorize — map line items to a standard chart
- Map the association's idiosyncratic account names/codes to a **canonical category set**: Management Fees, Insurance, Legal, Landscape/Grounds, Pool/Amenities, Utilities, Repairs & Maintenance, Reserves, Admin/Office, Taxes, Social.
- Categorization is fuzzy + alias-learning (reuses YCM's existing **bank descriptor-alias / AI-ingestion** pattern from the codebase — `auto-matcher.ts` descriptor aliasing + the `ai_ingestion` extraction pipeline — so the simulator's parser is the marketing-facing front of an engine YCM already has).

### 2.3 Flag — what the engine surfaces (with the Paddlers Cove worked numbers)
Each flag = `{severity, category, $amount, why, "ask your manager" prompt}`. Thresholds are conservative defaults, all overridable.

| Flag rule | Trigger | Paddlers Cove example |
|---|---|---|
| **Operating deficit** | Operating Fund Net Total < 0 in actuals | FY24 actual **–$51,992**, FY25 YTD **–$41,383** while budget shows $0 net → "Your operating fund is running a real deficit the budget doesn't show." (RED) |
| **Budget-vs-actual blowout** | actual > budget by > 25% (or > $X) on any line | Legal (5056) budgeted $4,000, actual **$19,008** (+375%); Tree/Trail budgeted $8K, actual **$35,249** (+340%); Pool furniture budgeted $16K, actual **$26,755** (+67%) → "These lines blew past budget — ask why." (AMBER/RED by size) |
| **No reserve study funded** | Reserve-study / audit line = $0 across years, OR no study detected | Line 5105 "Review Audit / Reserve Study" = **$0 every year** → "No reserve study is being funded. Reserve adequacy is unverified — a hidden special-assessment risk." (RED) |
| **Reserve underfunding signal** | reserve balance ÷ rough replacement exposure low, OR contribution flat while costs rise | $730K reserves, ~$95K/yr funding, no study → "Reserve funding may not keep pace; without a study you can't know." (AMBER) |
| **Management fee vs benchmark** | mgmt fee per door/mo outside peer band | $53,294/yr mgmt fee → benchmark per-door check → "Your management fee is \$X/door/mo vs a peer band of \$Y–\$Z." |
| **Admin overhead ratio** | total admin ÷ total assessments > threshold | Admin $125,636 ÷ $544K ≈ 23% → "Admin overhead is ~23% of assessments — peer HOAs run lower." |
| **Flat assessments + deficit** | assessments held flat while operating runs red | "No change in quarterly assessments" + operating deficit → "Holding dues flat while running a deficit defers a future special assessment." (RED — the structural red flag) |
| **Delinquency signal** | AR / total assessments elevated | AR $37,658 → "Receivables suggest collection gaps." (AMBER) |
| **Single-vendor concentration** | one vendor line dominates spend | Landscape $129,120 = the largest single line → "One landscape contract is your biggest cost — worth re-bidding." (AMBER) |
| **Interfund borrowing** | operating owes reserve (negative interfund) | Interfund: operating (–$9,731) / reserve +$9,731 → "Operating has borrowed from reserves — a liquidity flag." (AMBER) |

### 2.4 Score & verdict — the savings model (conservative, clearly labeled)
The savings verdict is a **range** (low / likely / high), never a single hero number, and every component is labeled an **estimate** with its basis. Components:

1. **Management-fee delta** — `(current fee/door − YCM fee/door) × doors`, floored at $0 (never show negative savings; if YCM isn't cheaper on fee alone, the savings story shifts to the items below).
2. **Variance-leakage recovery** — a *conservative fraction* (e.g. 10–25%) of the documented budget-blowout dollars, framed as "tighter financial controls typically recover a portion of overruns." Never claim 100%.
3. **Avoided special-assessment risk** — only shown when "no reserve study" fires: framed qualitatively + a conservative annualized figure ("a reserve study + funding plan reduces the odds of a surprise special assessment"). Labeled as risk-reduction, not guaranteed cash.
4. **Admin-overhead normalization** — if admin ratio is above the peer band, the delta to the band as a soft upper-bound contributor.

**Verdict assembly:**
- **Low** = management-fee delta only (the hardest, most defensible number).
- **Likely** = low + conservative variance recovery.
- **High** = likely + admin normalization + flagged risk-reduction value.
- **Guardrail:** if total estimated savings is small or negative, the product pivots the headline to **"You may already be priced fairly — but here's what's at risk"** (reserve/variance flags), so the wizard is still useful and honest, and still produces a lead.

All figures carry: *"Estimate based on the document you provided and peer benchmarks. Actual savings depend on a full review — let's verify together."*

### 2.5 Benchmarks (peer data)
- Peer bands (fee/door, admin ratio, reserve %) sourced from YCM's own managed-portfolio aggregates + published industry ranges, bucketed by **community type** (condo / townhome / single-family POA), **door count**, and **region**. Paddlers Cove → SC POA, several-hundred doors, with a townhome sub-class (it has a "Master Fees from Townhomes" line) → the engine should pick the matching peer bucket.
- Benchmarks are ranges, not point estimates, and labeled as such.

### 2.6 Parse-correction screen (trust + accuracy)
When confidence is low, show the extracted key fields (door count, total assessments, mgmt fee, reserve balance) as **editable chips** — "Did we read this right? Fix anything before we calculate." This converts a parsing weakness into a trust-building, accuracy-improving moment and feeds correction-memory (reusing the codebase's `association_ingestion_correction_memory` pattern).

---

## 3. Trust + compliance

A board member is uploading their HOA's financial document — privacy and credibility are the whole game.

- **Estimate framing everywhere.** Persistent "Estimate — verify with us" ribbon on results + verdict. No number ever presented as a guarantee or as an accusation of misconduct. Language is "worth asking about," not "your manager is overcharging you."
- **Document privacy:**
  - **Default: ephemeral.** The uploaded PDF is parsed and **not stored** unless the user explicitly consents at lead-capture ("Save my analysis so YCM can build my migration plan" checkbox).
  - Explicit consent line at capture: storing the document is opt-in and tied to the migration-plan request.
  - No third-party sharing of the document, stated plainly.
  - Clear retention statement + a "delete my data" path.
- **No PII over-collection.** Capture only what sales needs (name, email, HOA, role, doors, optional phone).
- **Accuracy disclaimer:** results depend on the document provided; the correction screen (§2.6) lets the user fix mis-reads before any number is shown.
- **No legal/financial-advice claim** — the wizard surfaces observations and estimates; it does not render an audit opinion or legal conclusion.
- **Honest-savings guardrail** (§2.4) — the product will tell a prospect when they're *not* obviously overpaying, which protects YCM's credibility and makes the flagged-risk lead more genuine.

---

## 4. Lead capture + sales handoff

### Capture fields (Step 4 gate)
| Field | Required | Notes |
|---|---|---|
| Name | ✓ | |
| Email | ✓ | |
| HOA / community name | ✓ | pre-filled from parse if detected |
| Role | ✓ | board member · owner · current manager · other |
| Door count | ✓ | pre-filled from parse |
| Phone | optional | enables faster sales callback |
| "Store my doc to build my plan" | optional consent | gates document retention (§3) |

### Where the lead goes
- Lead + the **parsed analysis payload** (flags, variance, reserve verdict, savings range, source community type/size) is created as a lead record routed to **YCM's sales team** — so sales opens the conversation already holding the prospect's own numbers (warm, pre-qualified, with talking points).
- Lead carries a **score** (size of estimated savings × number of red flags × door count) so sales prioritizes high-value boards.
- Triggers a templated **"migration plan request"** workflow when the user picks CTA #2.

### The discount / migration-plan CTA
- **Migration plan:** sales returns a tailored switch plan — onboarding timeline, data-migration steps (reuses YCM's existing onboarding/migration tooling), and a side-by-side cost comparison built from the uploaded numbers.
- **Switch discount:** a configurable offer (e.g. first-N-months onboarding credit, or a waived setup fee) surfaced as "See if you qualify for a switch discount." Qualification is soft (door count / current-spend band) and confirmed by sales — keeps it a real lever, not a blanket coupon.

---

## 5. Wireframes (mandatory)

Low-fidelity box layouts for the four key screens. Inline HTML/CSS render below; ASCII fallback inline for each.

### 5.1 Step 1 — Landing & drop

```
┌──────────────────────────────────────────────────────────────┐
│  YCM ·  Switch to YCM Simulator                  [ Contact ]  │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│     Is your HOA overpaying its management company?             │
│     Drop your latest budget or financial report.              │
│     Get an instant read in under a minute.                    │
│                                                                │
│     ┌────────────────────────────────────────────────┐        │
│     │                                                  │        │
│     │        ⬆  Drag & drop your PDF here              │        │
│     │           or click to browse                     │        │
│     │                                                  │        │
│     └────────────────────────────────────────────────┘        │
│      🔒 Analyzed securely · never stored without consent ·     │
│         never shared · this is an estimate — verify with us    │
│                                                                │
│      Don't have a report handy? Answer 5 quick questions →     │
│      We read: CAMS · Vantaca · CINC · AppFolio · QuickBooks    │
└──────────────────────────────────────────────────────────────┘
```

<div style="font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;border:1px solid #d8dee4;border-radius:12px;overflow:hidden">
  <div style="background:#014D4A;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;font-size:14px">
    <b>YCM · Switch to YCM Simulator</b><span style="border:1px solid #6fa8a4;padding:4px 10px;border-radius:6px;font-size:12px">Contact</span>
  </div>
  <div style="padding:34px 28px;text-align:center;background:#fbfcfc">
    <h2 style="color:#014D4A;margin:0 0 8px;font-size:22px">Is your HOA overpaying its management company?</h2>
    <p style="color:#445;margin:0 0 22px;font-size:15px">Drop your latest budget or financial report. Get an instant read in under a minute.</p>
    <div style="border:2px dashed #6fa8a4;border-radius:12px;padding:38px;background:#fff;color:#014D4A">
      <div style="font-size:30px">⬆</div>
      <b>Drag &amp; drop your PDF here</b><br><span style="color:#789;font-size:13px">or click to browse</span>
    </div>
    <p style="color:#5a6b6a;font-size:12px;margin:14px 0 6px">🔒 Analyzed securely · never stored without consent · never shared · <b>this is an estimate — verify with us</b></p>
    <p style="font-size:13px;margin:10px 0 2px"><a style="color:#014D4A">Don't have a report handy? Answer 5 quick questions →</a></p>
    <p style="color:#90a0a0;font-size:11px;margin:4px 0 0">We read: CAMS · Vantaca · CINC · AppFolio · QuickBooks &amp; most PDF budgets</p>
  </div>
</div>

### 5.2 Step 2 — Analyzing

```
┌──────────────────────────────────────────────────────────────┐
│              Analyzing  Paddlers Cove POA  …                   │
│                                                                │
│     ✓ Reading your document                                    │
│     ✓ Identifying line items  (78 lines found)                 │
│     ⟳ Checking budget vs. actual …                             │
│     ·  Benchmarking against peer HOAs                          │
│     ·  Calculating your switch verdict                         │
│                                                                │
│     [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░]  62%                            │
│                                                                │
│     🔒 We're not storing this document unless you ask us to.   │
└──────────────────────────────────────────────────────────────┘
```

<div style="font-family:system-ui,sans-serif;max-width:760px;margin:14px auto;border:1px solid #d8dee4;border-radius:12px;padding:30px 34px;background:#fbfcfc">
  <h3 style="color:#014D4A;margin:0 0 18px;text-align:center">Analyzing <b>Paddlers Cove POA</b> …</h3>
  <div style="font-size:14px;line-height:2;color:#334">
    <div>✅ Reading your document</div>
    <div>✅ Identifying line items <span style="color:#789">(78 lines found)</span></div>
    <div>⟳ <b>Checking budget vs. actual …</b></div>
    <div style="color:#9aa">◦ Benchmarking against peer HOAs</div>
    <div style="color:#9aa">◦ Calculating your switch verdict</div>
  </div>
  <div style="background:#e6ecec;border-radius:8px;height:14px;margin:18px 0 6px;overflow:hidden"><div style="width:62%;height:100%;background:#014D4A"></div></div>
  <p style="text-align:center;color:#5a6b6a;font-size:12px;margin:6px 0 0">🔒 We're not storing this document unless you ask us to.</p>
</div>

### 5.3 Step 3 — Results dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Paddlers Cove POA — instant analysis     ⚠ Estimate · verify │
├──────────────────────────────────────────────────────────────┤
│  🚩 CONCERNING CHARGES & ANOMALIES                             │
│  ● Operating fund deficit  –$51,992 (FY24 actual)   RED       │
│  ● No reserve study funded  $0 line 5105            RED       │
│  ● Legal blew past budget  $19,008 vs $4,000        AMBER     │
│  ● Flat dues + deficit  structural risk             RED       │
├──────────────────────────────────────────────────────────────┤
│  📊 BUDGET vs ACTUAL — worst overruns                          │
│  Tree/Trail   +340%   $35,249 vs $8,000                       │
│  Legal        +375%   $19,008 vs $4,000                       │
│  Pool Furn.    +67%   $26,755 vs $16,000                      │
├──────────────────────────────────────────────────────────────┤
│  🏦 RESERVE HEALTH        │  💵 MANAGEMENT FEE                 │
│  Balance  $730,629         │  $53,294/yr                       │
│  Funding  $95,418/yr       │  ≈ $X / door / mo                 │
│  Study    NONE on file ⚠   │  Peer band $Y–$Z                  │
│  Verdict  UNVERIFIED       │  Admin overhead ≈ 23% of dues     │
├──────────────────────────────────────────────────────────────┤
│            ↓  See what switching to YCM could save  ↓          │
└──────────────────────────────────────────────────────────────┘
```

<div style="font-family:system-ui,sans-serif;max-width:760px;margin:14px auto;border:1px solid #d8dee4;border-radius:12px;overflow:hidden">
  <div style="background:#014D4A;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;font-size:14px"><b>Paddlers Cove POA — instant analysis</b><span style="background:#b8860b;padding:2px 8px;border-radius:5px;font-size:11px">⚠ Estimate · verify with us</span></div>
  <div style="padding:16px 20px;border-bottom:1px solid #eee">
    <div style="color:#a11;font-weight:700;font-size:13px;margin-bottom:8px">🚩 CONCERNING CHARGES &amp; ANOMALIES</div>
    <div style="font-size:13px;line-height:1.9">
      <div><span style="color:#c00">●</span> Operating fund deficit <b>–$51,992</b> (FY24 actual) <span style="float:right;color:#c00;font-size:11px">RED</span></div>
      <div><span style="color:#c00">●</span> No reserve study funded <b>$0</b> (line 5105) <span style="float:right;color:#c00;font-size:11px">RED</span></div>
      <div><span style="color:#b8860b">●</span> Legal blew past budget <b>$19,008</b> vs $4,000 <span style="float:right;color:#b8860b;font-size:11px">AMBER</span></div>
      <div><span style="color:#c00">●</span> Flat dues + deficit — structural risk <span style="float:right;color:#c00;font-size:11px">RED</span></div>
    </div>
  </div>
  <div style="padding:16px 20px;border-bottom:1px solid #eee">
    <div style="color:#014D4A;font-weight:700;font-size:13px;margin-bottom:8px">📊 BUDGET vs ACTUAL — worst overruns</div>
    <div style="font-size:13px;line-height:1.9">
      <div>Tree / Trail <span style="color:#c00">+340%</span> &nbsp; $35,249 vs $8,000</div>
      <div>Legal <span style="color:#c00">+375%</span> &nbsp; $19,008 vs $4,000</div>
      <div>Pool Furniture <span style="color:#b8860b">+67%</span> &nbsp; $26,755 vs $16,000</div>
    </div>
  </div>
  <div style="display:flex;border-bottom:1px solid #eee">
    <div style="flex:1;padding:16px 20px;border-right:1px solid #eee">
      <div style="color:#014D4A;font-weight:700;font-size:13px;margin-bottom:8px">🏦 RESERVE HEALTH</div>
      <div style="font-size:13px;line-height:1.9">Balance <b>$730,629</b><br>Funding <b>$95,418/yr</b><br>Study <b style="color:#c00">NONE on file ⚠</b><br>Verdict <b style="color:#c00">UNVERIFIED</b></div>
    </div>
    <div style="flex:1;padding:16px 20px">
      <div style="color:#014D4A;font-weight:700;font-size:13px;margin-bottom:8px">💵 MANAGEMENT FEE</div>
      <div style="font-size:13px;line-height:1.9">$53,294/yr<br>≈ $X / door / mo<br>Peer band $Y–$Z<br>Admin overhead <b>≈ 23% of dues</b></div>
    </div>
  </div>
  <div style="padding:16px;text-align:center;background:#fbfcfc;color:#014D4A;font-weight:600;font-size:14px">↓ See what switching to YCM could save ↓</div>
</div>

### 5.4 Step 4 — Verdict + lead capture + CTA

```
┌──────────────────────────────────────────────────────────────┐
│            Your estimated savings by switching to YCM          │
│                                                                │
│            ┌──────────────────────────────────────┐           │
│            │   $██,███  –  $██,███  / year         │  (locked) │
│            │   Low      Likely     High            │           │
│            └──────────────────────────────────────┘           │
│                                                                │
│   Unlock your number — and we'll build a free migration plan: │
│   ┌──────────────┐ ┌──────────────┐                           │
│   │ Name         │ │ Email        │                           │
│   ├──────────────┤ ├──────────────┤                           │
│   │ HOA: Paddlers│ │ Role ▾ Board │  Doors: 600  Phone (opt)  │
│   └──────────────┘ └──────────────┘                           │
│   ☐ Store my doc so YCM can build my migration plan           │
│                                                                │
│        [   Show my savings  →   ]                              │
│                                                                │
│   ── after unlock ──────────────────────────────────────────  │
│   📅 Book a 20-min migration call   (primary)                 │
│   📝 Request a written migration plan                         │
│   🎁 See if you qualify for a switch discount                 │
│   ✉  Email this analysis to your board                        │
│   ⚠ Estimate based on your document + peer benchmarks.        │
└──────────────────────────────────────────────────────────────┘
```

<div style="font-family:system-ui,sans-serif;max-width:760px;margin:14px auto;border:1px solid #d8dee4;border-radius:12px;overflow:hidden">
  <div style="background:#014D4A;color:#fff;padding:14px 18px;text-align:center;font-size:16px"><b>Your estimated savings by switching to YCM</b></div>
  <div style="padding:22px;text-align:center;background:#fbfcfc">
    <div style="display:inline-block;border:2px solid #014D4A;border-radius:10px;padding:14px 26px;background:#fff;filter:blur(0.4px)">
      <div style="font-size:26px;color:#014D4A;font-weight:800;letter-spacing:1px">$██,███ – $██,███ <span style="font-size:14px;font-weight:500">/ year</span></div>
      <div style="font-size:11px;color:#789;margin-top:4px">Low &nbsp;·&nbsp; Likely &nbsp;·&nbsp; High</div>
    </div>
    <p style="color:#445;font-size:13px;margin:18px 0 10px">Unlock your number — and we'll build a free migration plan:</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;font-size:12px">
      <span style="border:1px solid #cdd;border-radius:6px;padding:8px 14px;background:#fff">Name</span>
      <span style="border:1px solid #cdd;border-radius:6px;padding:8px 14px;background:#fff">Email</span>
      <span style="border:1px solid #cdd;border-radius:6px;padding:8px 14px;background:#fff">HOA: Paddlers Cove</span>
      <span style="border:1px solid #cdd;border-radius:6px;padding:8px 14px;background:#fff">Role ▾ Board member</span>
      <span style="border:1px solid #cdd;border-radius:6px;padding:8px 14px;background:#fff">Doors: 600</span>
      <span style="border:1px solid #cdd;border-radius:6px;padding:8px 14px;background:#fff">Phone (optional)</span>
    </div>
    <p style="font-size:12px;color:#5a6b6a;margin:10px 0">☐ Store my document so YCM can build my migration plan</p>
    <div style="display:inline-block;background:#014D4A;color:#fff;padding:11px 26px;border-radius:8px;font-weight:700;font-size:14px">Show my savings →</div>
  </div>
  <div style="padding:14px 20px;border-top:1px solid #eee;font-size:13px;line-height:2">
    <div>📅 <b>Book a 20-min migration call</b> &nbsp;<span style="color:#789">(primary)</span></div>
    <div>📝 Request a written migration plan</div>
    <div>🎁 See if you qualify for a switch discount</div>
    <div>✉ Email this analysis to your board</div>
    <div style="color:#b8860b;font-size:11px;margin-top:8px">⚠ Estimate based on your document + peer benchmarks. Actual savings depend on a full review — let's verify together.</div>
  </div>
</div>

---

## 6. Build notes

### Ties into the marketing site
- Lives as a standalone route on the YCM marketing site (e.g. `/switch` or `/simulator`), linked from the homepage hero and the "Switching managers?" nav. No login.
- Visual language = YCM brand (deep teal `#014D4A` + cream, per the ratified v1 brand).
- The result page is shareable/forwardable (board-group decision dynamic).

### Reuses existing YCM engine (don't rebuild)
The simulator is the marketing-facing front of parsing/analysis the codebase **already has** (per AUDIT-HOA-001):
- **Document extraction:** the `ai_ingestion` pipeline (`ai_ingestion_jobs` / `ai_extracted_records` / `association_ingestion_correction_memory`) — already extracts structured records + clauses from uploaded files with a correction-memory loop. The §2.6 correction screen reuses this directly.
- **Categorization / alias learning:** the reconciliation `auto-matcher.ts` descriptor-alias pattern → fuzzy line-item categorization.
- **Benchmarks:** YCM's managed-portfolio aggregates feed peer bands.
- **Lead → sales:** reuse existing lead/CRM handoff; attach the parsed analysis payload.
- **Migration plan / onboarding:** CTA #2 hands to YCM's existing onboarding/migration tooling.

### MVP vs later
| | MVP | Later |
|---|---|---|
| Input | **PDF** (heuristic parse of common CAMS/Vantaca/CINC/QuickBooks budget + balance-sheet formats) + the 5-question manual fallback | CSV/XLSX upload; multi-doc (full board packet); prior-year trend ingestion |
| Flags | Operating deficit, budget-vs-actual blowout, no-reserve-study, mgmt-fee benchmark, admin-overhead ratio, flat-dues-+-deficit | Single-vendor concentration, interfund borrowing, delinquency, line-item peer benchmarking per category |
| Verdict | Mgmt-fee delta (Low) + conservative variance recovery (Likely) | Full reserve-risk modeling, admin normalization (High band), region-tuned peer bands |
| Parse | Digital-native PDF text/table extraction + low-confidence correction screen | OCR for scanned reports; archetype auto-detect across more vendor templates |
| Trust | Ephemeral-by-default, opt-in storage, estimate ribbon | Per-doc delete dashboard, SOC2-aligned handling note |
| CTA | Book-a-call + migration-plan request + email-to-board | Configurable switch-discount qualification engine; self-serve side-by-side cost comparison |

### Why this feeds Project Statecraft
Project Statecraft is YCM's path from "one managed HOA" to "repeatable multi-state product." The simulator is its **demand-generation front door**: it turns a passive marketing visit into (a) a quantified, board-shareable case against the incumbent manager, and (b) a warm, pre-parsed lead handed to sales with the prospect's own numbers. Low CAC, high intent, and it shows off YCM's parsing/analysis depth before the prospect ever signs.

---

## 7. Open questions for sales/founder (not blockers)
1. **Switch-discount mechanics** — onboarding credit vs waived setup fee vs first-N-months — sales to define the lever.
2. **Peer-benchmark source of record** — confirm YCM's managed-portfolio data is large enough to publish bands, else seed from published industry ranges with that caveat.
3. **Gate placement** — confirm the value-first / capture-at-the-aha gate (verdict teaser ungated, dollar gated) vs a harder gate before the dashboard. Recommended: teaser-ungated (more leads, more shares).
