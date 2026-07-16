# Centralized UI Architecture — Reference Document

> Master reference for the UI centralization refactor. Created from full codebase audit of all 5 pages, 7 shared components, CSS, and Tailwind config.

---

## A. Current Architecture — High-Level View

### UI Tree (root → leaf)

```
<html>
  <body className="bg-background text-on-surface font-body-md">
    <AppShell>
      ├── Header                          # Fixed top bar (hamburger, centered title, account link)
      ├── <main id="app-main">            # Page content injected here
      │     └── [Page Component]
      │           ├── <main className="mx-auto max-w-4xl px-6 pt-[24px] pb-[24px]">  # page-level wrapper
      │           │     ├── Hero Header section
      │           │     ├── Feature sections (inline JSX)
      │           │     ├── Inline sub-components (ExerciseCard, etc.)
      │           │     └── Modals (inline JSX)
      ├── SideDrawer                      # Slide-out nav (4 tabs)
    </AppShell>
    <LoadingScreen />                     # Full-screen overlay
  </body>
</html>
```

### Shared Components (`src/components/`) — 7 files

| File | Purpose | Owns Domain UI? |
|------|---------|-----------------|
| `app-shell.client.tsx` | Shell: Header + children + SideDrawer | No — chrome only |
| `header.tsx` | Fixed top bar (hamburger, centered title, account link) | No |
| `side-drawer.tsx` | Slide-out nav (4 tabs: WORKOUT, HISTORY, PROGRESS, PLAN) | No |
| `user-selection.client.tsx` | Landing page: user cards + add user button + AddUserModal | No — this IS a page-level component |
| `add-user-modal.tsx` | Modal for creating users | No — domain-specific, should move to ui/ |
| `loading-context.tsx` | Set-based loading state provider (useLoading) | No |
| `loading-screen.tsx` | Hourglass loading overlay | No |

**Verdict:** Shared components handle chrome and infrastructure. **There is zero component library for page content.** Every page writes its own styling from scratch.

### Pages (`src/app/`) — 5 pages

| Route | File | Inline Sub-Components | Lines |
|-------|------|----------------------|-------|
| `/` | `page.tsx` | None (delegates to `UserSelectionClient`) | 8 |
| `/today` | `page.tsx` | `ExerciseCard` | 434 |
| `/plan` | `page.tsx` | Day selector, assignment cards, modals (all inline) | 514 |
| `/history` | `HistoryPageClient.tsx` | Date badges, session cards, metric boxes, set detail modal | 307 |
| `/progress` | `page.tsx` | Exercise selector, range pills, granularity pills, chart, detail modal | 344 |

**Total inline JSX across pages: ~1,600 lines** — all of it duplicatable/shared-able.

---

## B. The Repeated Micro-Components (What's Duplicated)

15 distinct UI patterns found across 2+ pages with slightly different styling each time:

| # | Pattern | Where Used | Times | Severity |
|---|---------|-----------|-------|----------|
| 1 | **Page shell** `mx-auto max-w-4xl flex col items-center px-6 pt-[24px] pb-[24px]` | All 5 pages | 5 | Critical |
| 2 | **Hero header** `font-headline-xl` + `h-1 w-full bg-on-surface` underline + subtitle | today, history, plan, progress, user-selection | 5 | Critical |
| 3 | **Neo-brutalist card** `border-4 border-on-surface bg-X neo-shadow` (p-3 to p-8) | ExerciseCard, history, progress, modals, user-selection | 37+ | Critical |
| 4 | **Primary button** `border-4 border-on-surface bg-primary p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow active-press` | today, plan, history, progress, add-user-modal | 6+ | High |
| 5 | **Secondary button** `border-2 border-on-surface bg-surface px-3 py-2 font-label-bold text-label-bold uppercase text-on-surface hover:bg-surface-container` | add-user-modal, plan | 4+ | High |
| 6 | **Input wrapper** `flex-1 flex-row items-center border-4 border-on-surface bg-background p-2 gap-2` + label span + input | today (set inputs), history modal, progress modal | 20+ | High |
| 7 | **Direct input** `border-2/4 border-on-surface bg-background p-md font-body-lg focus:border-primary` | plan modal input, add-user-modal input | 3 | High |
| 8 | **Select** `appearance-none border-4 border-on-surface bg-background py-3 pl-4 pr-12 font-label-bold text-label-bold uppercase neo-shadow` | progress, plan modal | 2 | Medium |
| 9 | **Set row** — SET/LB/REPS in 3 side-by-side bordered boxes | today (editable), history modal (read-only), progress modal (read-only) | 3 pages | Critical |
| 10 | **Metric box** `border-4 border-on-surface bg-on-surface p-3` with label `font-label-mono text-background` + value `font-headline-md font-black` | history aggregate row (3 boxes), history modal (3 boxes), progress modal (3 boxes) | 9 | High |
| 11 | **Modal overlay** `fixed inset-0 z-[60] flex items-center justify-center bg-black/50` | plan, history, progress, add-user-modal | 4 | High |
| 12 | **Modal content** `border-4 border-on-surface bg-background p-6 neo-shadow-lg` (sometimes `max-h-[90vh] overflow-y-auto`) | history, progress, plan, add-user-modal | 4 | High |
| 13 | **Day/time pill** active: `bg-primary text-on-primary` / inactive: `bg-surface-container-low text-on-surface shadow-[...]` | plan day selector (7 pills), progress range (3 pills), progress granularity (3 pills) | 13 | High |
| 14 | **Badge** `border-4 border-on-surface bg-primary px-2 py-0.5 neo-shadow-sm` or `bg-primary px-2 py-0.5` | history date badges, progress modal, today view toggle | 6+ | Medium |
| 15 | **Empty state** centered icon + `font-headline-md uppercase` + `font-label-bold` subtitle | today, history, progress | 3 | Medium |
| 16 | **Error banner** `border-2 border-error bg-error-container p-2 text-error font-label-bold` | plan, add-user-modal, plan modal | 3 | Low |
| 17 | **Label-value pair** `font-label-mono text-label-mono text-secondary` label + `font-body-md text-body-md` or `font-headline-md` value | Every page, dozens of times | 50+ | High |
| 18 | **Delete button** `size-8 bg-error p-1 text-on-primary neo-shadow active-press` | today | 1 | Low (but pattern exists) |
| 19 | **Toggle/view button** `border-4 border-on-surface bg-surface-container-low p-2 font-label-mono text-label-mono uppercase` | today | 1 | Low (but pattern exists) |
| 20 | **Add exercise button** `border-4 border-on-surface bg-background py-3 font-headline-md uppercase font-bold text-on-surface active-press` | plan | 1 | Low (but pattern exists) |
| 21 | **Icon button (modal close/toggle)** `size-10 border-2 border-on-surface bg-background font-headline-md uppercase font-bold neo-shadow active:shadow-none` | plan (2 instances) | 2 | Low (but pattern exists) |

### Smoking Guns (highest priority for centralization)

| Pattern | Files | Lines of Duplicated Code |
|---------|-------|-------------------------|
| Set row (#9) | today/page.tsx, history/HistoryPageClient.tsx, progress/page.tsx | ~60 lines |
| Page shell (#1) | All 5 pages | 5 identical wrappers |
| Hero header (#2) | All 4 content pages | 20+ identical heading patterns |
| Modal overlay+content (#11, #12) | plan, history, progress, add-user-modal | ~40 lines per modal pair |
| Metric box (#10) | history, progress | ~30 lines |
| Label-value pair (#17) | Every page | 50+ instances |

---

## C. Font System — How It Works Now

### Defined in `tailwind.config.js`

**Font size tokens (7):**

| Token | Size | Line Height | Weight | Letter Spacing |
|-------|------|-------------|--------|----------------|
| `headline-xl` | 48px | 1.0 | 900 (black) | -0.04em |
| `headline-lg` | 32px | 1.1 | 800 (extrabold) | -0.02em |
| `headline-md` | 24px | 1.2 | 800 (extrabold) | — |
| `body-lg` | 18px | 1.5 | 500 (medium) | — |
| `body-md` | 16px | 1.5 | 400 (normal) | — |
| `label-bold` | 14px | 1.0 | 700 (bold) | 0.05em |
| `label-mono` | 12px | 1.0 | 500 (medium) | — |

**Font family tokens (6):**

| Token | Font | Used For |
|-------|------|----------|
| `headline-xl`, `headline-lg`, `headline-md` | Epilogue, sans-serif | All headings |
| `label-bold`, `label-mono` | Space Grotesk, sans-serif | Labels, badges, set numbers |
| `body-lg`, `body-md` | Inter, sans-serif | Body text, inputs |

### Usage Pattern

Fonts are used as paired className duplets: `font-headline-xl text-headline-xl` (font-family + font-size). This is correct Tailwind pattern.

### Problems

1. **Fixed pixel sizes** — `headline-xl` is always 48px, even on a 360px phone
2. **No media queries** — nothing in the design token system accounts for viewport width
3. **No CSS custom properties** — font sizes are literal pixel values in the Tailwind config, not CSS variables
4. **`font-headline-sm`** is used in `progress/page.tsx:306` but **NOT defined** in `tailwind.config.js` — either a bug or missing config
5. **5 Material Symbols icons** use arbitrary pixel sizes (`text-[48px]`, `text-[14px]`, `text-[64px]` × 3) instead of design tokens

### What globals.css Has

Only **one** CSS custom property:
```css
:root { --header-height: 3.5rem; }
```

No font-related CSS variables at all.

---

## D. Color System — How It Works Now

### 51 Color Tokens in `tailwind.config.js`

Material Design 3-inspired system:

| Category | Tokens |
|----------|--------|
| **Background/Surface** | `background`, `surface`, `surface-dim`, `surface-bright`, `surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `surface-container-highest`, `surface-tint`, `surface-variant`, `surface-variant` |
| **Primary** | `primary`, `primary-container`, `on-primary`, `on-primary-fixed`, `on-primary-container`, `on-primary-fixed-variant` |
| **Secondary** | `secondary`, `secondary-container`, `on-secondary`, `on-secondary-fixed`, `on-secondary-fixed-variant` |
| **Tertiary** | `tertiary`, `tertiary-container`, `on-tertiary`, `on-tertiary-fixed`, `on-tertiary-fixed-variant`, `on-tertiary-container`, `tertiary-fixed`, `tertiary-fixed-dim` |
| **Error** | `error`, `error-container`, `on-error`, `on-error-container` |
| **Inverse/Accent** | `inverse-primary`, `inverse-surface`, `inverse-on-surface`, `outline`, `outline-variant` |

### Hardcoded Color Violations (should use tokens)

| File | Line | Hardcoded Value | Should Be |
|------|------|----------------|-----------|
| `user-selection.client.tsx` | 54 | `bg-red-500` / `hover:bg-red-600` | `bg-primary` / `hover:bg-primary-container` or a new `cta` token |
| `progress/page.tsx` | 267 | `fill="#a20000"` (Recharts bar) | Should reference `primary` token |
| `progress/page.tsx` | 252 | `stroke="rgba(27,29,14,0.2)"` (Recharts grid) | Should reference `on-surface` token |

### Shadow Duplication

| Pattern | Count | Where |
|---------|-------|-------|
| `.neo-shadow` CSS class (`4px 4px 0px 0px rgba(27,29,14,1)`) | 24 uses | Cards, buttons |
| `.neo-shadow-sm` CSS class (same as neo-shadow — **duplicate**) | 3 uses | Badges |
| `.neo-shadow-lg` CSS class (`8px 8px 0px 0px rgba(27,29,14,1)`) | 2 uses | Modals |
| `shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]` inline arbitrary | 5 uses | Progress pills, select |
| `shadow-[2px_2px_0px_0px_rgba(27,29,14,1)]` inline arbitrary | 1 use | Day selector (plan) |

The inline `shadow-[...]` values duplicate the `.neo-shadow` class. The `neo-shadow-sm` and `.neo-shadow` are **identical definitions** in `globals.css` (one is dead code).

---

## E. How the Mobile Problem Happened

1. **Fixed pixel fonts** — `headline-xl: 48px` renders at 48px on a 360px phone, overflowing the viewport. A hero header (headline + underline + subtitle) takes ~3 rows at full mobile width.

2. **Fixed pixel inputs** — set input rows use `font-body-md` (16px) × 3 side-by-side in a `flex` row with label spans, which overflows or wraps on narrow screens.

3. **No responsive font scaling** — nothing in the design token system accounts for viewport width. No CSS custom properties, no media queries.

4. **No centralized component definitions** — because every page writes its own styling inline, there's no single place to add `@media (max-width: 480px) { ... }` font adjustments. Fixing mobile would require editing 5 different page files.

5. **No responsive page padding** — `pt-[24px] pb-[24px]` is hardcoded in all 5 pages instead of using a responsive or tokenized value.

---

## F. Hardcoded Values That Should Be Tokens

| Category | Hardcoded | Should Be |
|----------|-----------|-----------|
| Color | `bg-red-500` / `hover:bg-red-600` | `bg-primary` / `bg-primary-container` |
| Shadow | `shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]` | `neo-shadow` (CSS class) |
| Shadow | `shadow-[2px_2px_0px_0px_rgba(27,29,14,1)]` | New `neo-shadow-xs` class or config token |
| Spacing | `pt-[24px] pb-[24px]` (5 pages) | `pt-lg pb-lg` (from `spacing.lg: 24px`) |
| Font | `font-headline-sm` (progress/page.tsx) | Either add to config or use existing `headline-md` |
| Font | `text-3xl` (user-selection) | Custom token or `headline-md` |
| Icon | 3× `fontVariationSettings: "'FILL' 1"` inline | `.material-symbols-filled` CSS class |
| Icon | 5× `text-[48px]`, `text-[64px]`, `text-[14px]` | Design token sizes or CSS class |
| Recharts | `fill="#a20000"` | CSS variable or token reference |
| Recharts | `stroke="rgba(27,29,14,0.2)"` | CSS variable or token reference |
| CSS | `.neo-shadow` and `.neo-shadow-sm` are identical | Remove duplicate |
| Font weight | `font-bold` in 3 places in plan/page.tsx | `font-label-bold` for consistency |

---

## G. Utility Functions Duplicated Across Pages

| Function | Defined In | Should Move To |
|----------|-----------|----------------|
| `getStoredUserId()` / `getUserId()` | today/page.tsx, plan/page.tsx, history/HistoryPageClient.tsx, progress/page.tsx, user-selection.client.tsx, add-user-modal.tsx | `shared/utils/cookie.ts` |
| `generateId()` | today/page.tsx, plan/page.tsx | `shared/utils/id.ts` |
| `formatDate()` | history/HistoryPageClient.tsx, progress/page.tsx | `shared/utils/date.ts` |
| `calcIntensity()` | history/HistoryPageClient.tsx, progress/page.tsx | `shared/utils/workout.ts` |
| `formatFullDate()` | progress/page.tsx | `shared/utils/date.ts` |
| `formatVolume()` | progress/page.tsx | `shared/utils/workout.ts` |
| `calcExerciseMetrics()` | progress/page.tsx | `shared/utils/workout.ts` |
| `DAYS` / `MONTHS` arrays | history/HistoryPageClient.tsx, progress/page.tsx | `shared/utils/date.ts` |

---

## H. Proposed Centralized Architecture

### Directory Structure

```
src/
├── app/
│   ├── globals.css              # CSS vars + @media responsive rules + global classes
│   ├── layout.tsx               # Root shell (unchanged)
│   └── ...pages...              # Thin composition layers
│
├── components/                  # Chrome only (already good — no changes needed)
│   ├── app-shell.client.tsx
│   ├── header.tsx
│   ├── side-drawer.tsx
│   ├── loading-context.tsx
│   ├── loading-provider.client.tsx
│   ├── loading-screen.tsx
│   └── user-selection.client.tsx  # Could move to ui/Layout/ later
│
├── ui/                          # ★ NEW — Primitive component library
│   ├── index.ts                 # Barrel export
│   │
│   ├── Button/
│   │   ├── index.ts
│   │   ├── PrimaryButton.tsx    # bg-primary + neo-shadow + active-press + text-on-primary
│   │   ├── SecondaryButton.tsx  # border-2 + bg-surface + hover:bg-surface-container
│   │   ├── DestructiveButton.tsx # bg-error + neo-shadow + text-on-primary + active-press
│   │   ├── PillButton.tsx       # active/inactive toggle (range pills, day selector)
│   │   └── IconBtn.tsx          # size-8/10, neo-shadow, material symbol, active-press
│   │
│   ├── Input/
│   │   ├── index.ts
│   │   ├── TextInput.tsx        # border-2/4 + bg-background + p-md + focus:border-primary
│   │   ├── NumberInput.tsx      # appearance-none + transparent bg + [-moz-appearance]
│   │   ├── Select.tsx           # appearance-none + border-4 + neo-shadow + chevron icon
│   │   └── SetInputRow.tsx      # LB/REPS input row with label box (today page pattern)
│   │
│   ├── Text/
│   │   ├── index.ts
│   │   ├── Headline.tsx         # responsive headline-xl/lg/md/sm via CSS vars
│   │   ├── Body.tsx             # responsive body-lg/md
│   │   └── Label.tsx            # responsive label-bold/mono
│   │
│   ├── Layout/
│   │   ├── index.ts
│   │   ├── PageShell.tsx        # mx-auto max-w-4xl px-6 pt-lg pb-lg
│   │   ├── HeroHeader.tsx       # headline + h-1 underline + subtitle
│   │   ├── Card.tsx             # border-4 border-on-surface neo-shadow + variant bg prop
│   │   ├── SetRow.tsx           # SET/LB/REPS read-only row (history/progress modal pattern)
│   │   ├── MetricBox.tsx        # bg-on-surface, label + value + unit (grid cell)
│   │   ├── EmptyState.tsx       # icon + headline + label (centered)
│   │   └── DateBadge.tsx        # bg-primary px-2 py-0.5 neo-shadow-sm
│   │
│   ├── Overlays/
│   │   ├── index.ts
│   │   ├── Modal.tsx            # fixed inset-0 z-[60] bg-black/50 + dialog attrs
│   │   ├── ModalContent.tsx     # border-4 neo-shadow-lg + max-w-lg + children
│   │   └── Badge.tsx            # bg-primary px-2 py-0.5 neo-shadow-sm (could also be in Layout)
│   │
│   └── Feedback/
│       ├── index.ts
│       ├── ErrorBanner.tsx      # border-2 border-error bg-error-container text-error
│       └── SuccessBanner.tsx    # future-proofing
│
├── features/                    # Business logic (unchanged)
│   └── ...
│
├── config/                      # DB, env (unchanged)
│   └── ...
│
└── shared/
    ├── errors/app-error.ts
    └── utils/
        ├── date.ts              # formatDate, getTodayISO, jsDayToAppIndex
        ├── cookie.ts            # ★ NEW — getStoredUserId()
        ├── id.ts                # ★ NEW — generateId()
        └── workout.ts           # ★ NEW — calcIntensity(), formatVolume(), calcExerciseMetrics()
```

### Component Specifications

#### `ui/Button/PrimaryButton`

```tsx
// Props: children, onClick?, disabled?, data-id?, className?
// Style: border-4 border-on-surface bg-primary p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press
// Disabled: opacity-50
// Variant: size prop ('sm' = py-2 px-3, 'md' = py-3 px-6, 'lg' = py-3 px-8)
// Variant: fullWidth prop (w-full)
```

#### `ui/Button/SecondaryButton`

```tsx
// Style: border-2 border-on-surface bg-surface px-3 py-2 font-label-bold text-label-bold uppercase text-on-surface hover:bg-surface-container transition-colors
// Variant: fullWidth, disabled
```

#### `ui/Button/PillButton`

```tsx
// Props: children, active, onClick?, data-id?
// Active: bg-primary text-on-primary (with optional shadow)
// Inactive: bg-surface-container-low text-on-surface hover:bg-surface-variant
// Style: border-2 border-on-surface py-3 font-label-bold text-label-bold uppercase transition-colors
// Variant: fullWidth (for day selectors)
```

#### `ui/Input/TextInput`

```tsx
// Props: value, onChange?, placeholder?, type?, autoFocus?, disabled?, data-id?, maxLength?
// Style: border-2 border-on-surface bg-background p-md font-body-lg focus:border-primary focus:ring-0 outline-none
// Variant: variant='primary' → border-4 neo-shadow
```

#### `ui/Input/NumberInput`

```tsx
// Props: value, onChange?, placeholder?, data-id?
// Style: w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]
// Used inside bordered wrapper divs
```

#### `ui/Input/Select`

```tsx
// Props: value, onChange?, options[], placeholder?, data-id?
// Style: w-full appearance-none border-4 border-on-surface bg-background py-3 pl-4 pr-12 font-label-bold text-label-bold uppercase text-on-surface neo-shadow transition-all
// Includes chevron icon (expand_more) positioned absolutely right
// Options render as <option> children
```

#### `ui/Input/SetInputRow`

```tsx
// Props: label, value, onChange?, readOnly?, data-id?
// Renders: <div className="flex-1 flex-row items-center border-4 border-on-surface bg-background p-2 gap-2">
//   <span className="font-label-mono text-label-mono text-secondary">{label}:</span>
//   {readOnly ? <span className="font-body-md text-body-md text-on-surface">{value}</span> : <NumberInput ... />}
// </div>
// Used in: today (editable), history modal (read-only), progress modal (read-only)
```

#### `ui/Text/Headline`

```tsx
// Props: children, size ('xl' | 'lg' | 'md' | 'sm'), italic?, className?, data-id?
// Style: responsive via CSS custom properties
// xl: text-[var(--font-headline-xl)] font-black italic uppercase (default italic for "Force Progression")
// lg: text-[var(--font-headline-lg)] font-black uppercase
// md: text-headline-md uppercase
// sm: text-headline-sm font-black uppercase
// Element: <h2> by default, configurable via as prop
```

#### `ui/Text/Body`

```tsx
// Props: children, size ('lg' | 'md'), className?, data-id?
// lg: font-body-lg text-body-lg
// md: font-body-md text-body-md
// Element: <p> by default, configurable via as prop
```

#### `ui/Text/Label`

```tsx
// Props: children, variant ('bold' | 'mono'), className?, data-id?
// bold: font-label-bold text-label-bold
// mono: font-label-mono text-label-mono
// Element: <span> by default, configurable via as prop
```

#### `ui/Layout/PageShell`

```tsx
// Props: children, id?
// Style: mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-lg pb-lg
// Replaces 5 identical page wrappers
```

#### `ui/Layout/HeroHeader`

```tsx
// Props: title, subtitle?, className?, id?
// Renders: <div className="mb-8 w-full text-center"> (or configurable spacing)
//   <h1 className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">{title}</h1>
//   <div className="mt-2 h-1 w-full bg-on-surface" />
//   {subtitle && <p className="mt-3 font-label-bold text-label-bold uppercase text-secondary">{subtitle}</p>}
// </div>
// Replaces 5 identical hero headers
```

#### `ui/Layout/Card`

```tsx
// Props: children, bg ('surface-container' | 'surface-container-low' | 'surface-container-high' | 'tertiary-fixed' | 'on-surface' | 'background'), className?, id?
// Style: border-4 border-on-surface neo-shadow
// bg prop controls background color
// Padding: configurable (default p-6, variants: p-3, p-4, p-5, p-8)
```

#### `ui/Layout/SetRow` (read-only)

```tsx
// Props: rows: { label: string; value: string }[]
// Style: <div className="flex items-center gap-3">
//   {rows.map(r => <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background p-2 gap-2">
//     <span className="font-label-mono text-label-mono text-secondary">{r.label}:</span>
//     <span className="font-body-md text-body-md text-on-surface">{r.value}</span>
//   </div>)}
// </div>
// Used in: history modal, progress modal (read-only set display)
```

#### `ui/Layout/MetricBox`

```tsx
// Props: label, value, unit?, className?
// Style: border-4 border-on-surface bg-on-surface p-3
//   <p className="font-label-mono text-label-mono uppercase text-background">{label}</p>
//   <p className="mt-1 font-headline-md text-headline-md font-black text-tertiary-fixed">{value.toLocaleString()}{unit && <span className="font-label-mono text-label-mono text-background"> {unit}</span>}</p>
// Used in: history aggregate row (3 boxes), history modal (3 boxes), progress modal (3 boxes)
```

#### `ui/Layout/EmptyState`

```tsx
// Props: icon (Material Symbol name), headline, body?, className?
// Style: w-full border-4 border-on-surface bg-surface-container p-8 text-center neo-shadow
//   <span className="mb-4 block text-center text-[64px] opacity-40 grayscale">
//     <span className="material-symbols-outlined">{icon}</span>
//   </span>
//   <p className="font-label-bold text-label-bold uppercase text-secondary">{headline}</p>
//   {body && <p className="mt-2 font-label-mono text-label-mono text-secondary">{body}</p>}
// Used in: history, progress
```

#### `ui/Layout/DateBadge`

```tsx
// Props: children, className?
// Style: border-4 border-on-surface bg-primary px-3 py-1 (or px-2 py-0.5 for compact)
//   <span className="font-label-bold text-label-bold uppercase text-on-primary">{children}</span>
// Used in: history date badges, progress modal date badge
```

#### `ui/Overlays/Modal`

```tsx
// Props: children, onClose?, id?, aria-label?, aria-modal?
// Style: fixed inset-0 z-[60] flex items-center justify-center bg-black/50
// onClick on overlay calls onClose
// role="dialog", aria-modal="true"
```

#### `ui/Overlays/ModalContent`

```tsx
// Props: children, className?, id?
// Style: w-full max-w-lg border-4 border-on-surface bg-background p-6 neo-shadow-lg
// Variant: overflow-y-auto max-h-[90vh] (for modals with long content)
// Variant: sm:max-w-sm (for smaller modals)
```

#### `ui/Feedback/ErrorBanner`

```tsx
// Props: children, className?, role?
// Style: border-2 border-error bg-error-container p-2 text-sm text-error
// role="alert" by default
```

---

## I. Responsive Font Sizing — How It Works After

### `globals.css` additions

```css
:root {
  --header-height: 3.5rem;

  /* Responsive font sizes */
  --font-headline-xl: 48px;
  --font-headline-lg: 32px;
  --font-headline-md: 24px;
  --font-headline-sm: 20px;
  --font-body-lg: 18px;
  --font-body-md: 16px;
  --font-label-bold: 14px;
  --font-label-mono: 12px;

  /* Responsive page padding */
  --page-padding-x: 24px;
  --page-padding-y: 24px;
}

/* Tablet */
@media (max-width: 768px) {
  :root {
    --font-headline-xl: 36px;
    --font-headline-lg: 26px;
    --font-headline-md: 22px;
    --font-headline-sm: 18px;
    --font-body-lg: 17px;
    --font-body-md: 16px;
    --font-label-bold: 13px;
    --font-label-mono: 11px;
    --page-padding-x: 20px;
    --page-padding-y: 20px;
  }
}

/* Mobile */
@media (max-width: 480px) {
  :root {
    --font-headline-xl: 24px;
    --font-headline-lg: 20px;
    --font-headline-md: 18px;
    --font-headline-sm: 16px;
    --font-body-lg: 16px;
    --font-body-md: 15px;
    --font-label-bold: 12px;
    --font-label-mono: 11px;
    --page-padding-x: 16px;
    --page-padding-y: 16px;
  }
}
```

### Tailwind config updates

```js
// fontSize — reference CSS variables
'headline-xl': ['var(--font-headline-xl)', { lineHeight: '1.0', letterSpacing: '-0.04em', fontWeight: '900' }],
'headline-lg': ['var(--font-headline-lg)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
'headline-md': ['var(--font-headline-md)', { lineHeight: '1.2', fontWeight: '800' }],
'headline-sm': ['var(--font-headline-sm)', { lineHeight: '1.2', fontWeight: '800' }],  // was missing!
'body-lg': ['var(--font-body-lg)', { lineHeight: '1.5', fontWeight: '500' }],
'body-md': ['var(--font-body-md)', { lineHeight: '1.5', fontWeight: '400' }],
'label-bold': ['var(--font-label-bold)', { lineHeight: '1.0', letterSpacing: '0.05em', fontWeight: '700' }],
'label-mono': ['var(--font-label-mono)', { lineHeight: '1.0', fontWeight: '500' }],
```

### Result

Every `<Headline size="xl">` component automatically scales with viewport. No page-level changes needed. The single source of truth is `globals.css` `:root` → `@media` queries.

---

## J. Migration Path (Step-by-Step)

Each step is a **pure refactor** — find all usages of a pattern, replace with the component, verify nothing breaks. No behavior changes. Run `npm run typecheck` after each step.

### Phase 0: Shared Utilities (low risk, quick win)

| Action | Files |
|--------|-------|
| Create `shared/utils/cookie.ts` with `getStoredUserId(): number \| null` | today, plan, history, progress, user-selection, add-user-modal |
| Create `shared/utils/id.ts` with `generateId(): string` | today, plan |
| Extend `shared/utils/date.ts` with `formatDate()`, `formatFullDate()`, `DAYS`, `MONTHS` | history, progress |
| Create `shared/utils/workout.ts` with `calcIntensity()`, `formatVolume()`, `calcExerciseMetrics()` | history, progress |

**Estimated change:** ~30 lines of new code, ~40 lines of deletions across 6 files.

### Phase 1: PageShell + HeroHeader (instant win)

| Action | Files |
|--------|-------|
| Create `ui/Layout/PageShell.tsx` | Replace `mx-auto max-w-4xl flex col items-center px-6 pt-lg pb-lg` wrapper in all 5 pages |
| Create `ui/Layout/HeroHeader.tsx` | Replace hero header pattern in 4 content pages |
| Update `globals.css` with responsive font CSS variables + `@media` queries | Global |

**Estimated change:** ~40 lines of new code, ~80 lines of deletions across 5 files.

### Phase 2: Text Components (solves mobile font problem)

| Action | Files |
|--------|-------|
| Create `ui/Text/Headline.tsx` | Replace all `font-headline-xl text-headline-xl`, `font-headline-lg text-headline-lg`, `font-headline-md text-headline-md` pairs |
| Create `ui/Text/Body.tsx` | Replace all `font-body-lg text-body-lg`, `font-body-md text-body-md` pairs |
| Create `ui/Text/Label.tsx` | Replace all `font-label-bold text-label-bold`, `font-label-mono text-label-mono` pairs |
| Add `headline-sm` to tailwind.config.js | Global |

**Estimated change:** ~60 lines of new code, ~100+ lines of deletions across 5 files.

### Phase 3: SetInputRow (today page's most complex pattern)

| Action | Files |
|--------|-------|
| Create `ui/Input/SetInputRow.tsx` (editable) | today/page.tsx set inputs |
| Create `ui/Layout/SetRow.tsx` (read-only) | history/HistoryPageClient.tsx modal, progress/page.tsx modal |
| Create `ui/Input/NumberInput.tsx` | Reused by SetInputRow |

**Estimated change:** ~50 lines of new code, ~80 lines of deletions across 3 files.

### Phase 4: Card + MetricBox + EmptyState + DateBadge

| Action | Files |
|--------|-------|
| Create `ui/Layout/Card.tsx` | ExerciseCard wrapper, history session cards, progress cards |
| Create `ui/Layout/MetricBox.tsx` | History aggregate row, history modal, progress modal |
| Create `ui/Layout/EmptyState.tsx` | today, history, progress empty states |
| Create `ui/Layout/DateBadge.tsx` | history date badges, progress modal |

**Estimated change:** ~60 lines of new code, ~100 lines of deletions across 3 files.

### Phase 5: Button Components

| Action | Files |
|--------|-------|
| Create `ui/Button/PrimaryButton.tsx` | today add-set, history close, progress close, plan assign/add |
| Create `ui/Button/SecondaryButton.tsx` | plan cancel, add-user cancel |
| Create `ui/Button/PillButton.tsx` | plan day selector, progress range pills, progress granularity pills |
| Create `ui/Button/DestructiveButton.tsx` | today delete-set |
| Create `ui/Button/IconBtn.tsx` | plan remove exercise, plan toggle mode, today delete-set |

**Estimated change:** ~80 lines of new code, ~60 lines of deletions across 5 files.

### Phase 6: Modal Components

| Action | Files |
|--------|-------|
| Create `ui/Overlays/Modal.tsx` + `ModalContent.tsx` | plan add-exercise modal, history set detail modal, progress detail modal, add-user-modal.tsx |
| Move `add-user-modal.tsx` to use `ui/` components | add-user-modal.tsx |

**Estimated change:** ~30 lines of new code, ~40 lines of deletions across 4 files.

### Phase 7: Input Components

| Action | Files |
|--------|-------|
| Create `ui/Input/TextInput.tsx` | plan new exercise input, add-user name input |
| Create `ui/Input/Select.tsx` | plan exercise selector, progress exercise selector |

**Estimated change:** ~40 lines of new code, ~20 lines of deletions across 3 files.

### Phase 8: Feedback Components

| Action | Files |
|--------|-------|
| Create `ui/Feedback/ErrorBanner.tsx` | plan error, add-user error |

**Estimated change:** ~15 lines of new code, ~10 lines of deletions across 2 files.

### Phase 9: Polish & Cleanup

| Action | Files |
|--------|-------|
| Remove duplicate `.neo-shadow-sm` from globals.css | globals.css |
| Add `.material-symbols-filled` CSS class | globals.css |
| Replace inline `shadow-[...]` with `.neo-shadow` class | All pages |
| Replace `bg-red-500` with `bg-primary` | user-selection.client.tsx |
| Replace `font-bold` with `font-label-bold` in plan | plan/page.tsx |
| Replace `text-3xl` with proper font token | user-selection.client.tsx |
| Replace `pt-[24px] pb-[24px]` with `pt-lg pb-lg` | All pages (already done via PageShell) |
| Run full test suite | `npm test` + `npm run typecheck` |

---

## K. File Index (What Was Audited)

### Pages (5 files)
| File | Type | Lines |
|------|------|-------|
| `src/app/page.tsx` | Login page (SSR) | 8 |
| `src/app/today/page.tsx` | Today's workout | 434 |
| `src/app/plan/page.tsx` | Battle plan | 514 |
| `src/app/history/HistoryPageClient.tsx` | War logs | 307 |
| `src/app/progress/page.tsx` | Force progression | 344 |

### Shared Components (7 files)
| File | Type | Lines |
|------|------|-------|
| `src/components/app-shell.client.tsx` | Layout shell | 19 |
| `src/components/header.tsx` | Top nav | 43 |
| `src/components/side-drawer.tsx` | Slide-out nav | 63 |
| `src/components/user-selection.client.tsx` | User cards | 84 |
| `src/components/add-user-modal.tsx` | Create user modal | 105 |
| `src/components/loading-context.tsx` | Loading state | 44 |
| `src/components/loading-screen.tsx` | Loading overlay | 25 |
| `src/components/loading-provider.client.tsx` | Provider wrapper | (referenced) |

### Config / Infrastructure (3 files)
| File | Type | Lines |
|------|------|-------|
| `src/app/globals.css` | Global CSS | 33 |
| `src/app/layout.tsx` | Root layout | 42 |
| `tailwind.config.js` | Tailwind config | 98 |

### Business Logic (read, not modified)
| Directory | Contents |
|-----------|----------|
| `src/features/user/` | Entity, repo, use cases, server actions |
| `src/features/exercise/` | Entity, repo, use cases, server actions |
| `src/features/routine/` | Entity, repo, use cases, server actions |
| `src/features/workout/` | Entity, repo, use cases, server actions, types |
| `src/features/chart/` | Entity, repo, server actions, utils |
| `src/config/` | DB singleton, env validation |
| `src/db/` | Schema, migrations |
| `src/shared/` | AppError, date utils |

**Total files audited: 25+**