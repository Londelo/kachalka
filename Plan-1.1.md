# Phase 1.1 — Design System & User Selection UI

## Goal
Convert the "User Selection" mock from `docs/mocks/userpage.html` into Next.js components. Wire up the full design system (colors, typography, neo-brutalist styling). The backend logic from Phase 1 stays intact — only the presentation layer changes.

## Design Mock Reference
`docs/mocks/userpage.html` — "User Selection" page (SELECT COMMANDER). The mock uses Tailwind CDN with a custom config. We replicate that config in our `tailwind.config.ts`.

## Files to Create/Modify

### 1. `tailwind.config.ts` — Design Token Configuration
Extract the Tailwind config from the mock's `<script id="tailwind-config">`. Extend the default theme with:
- **Colors**: background `#fbfbe2`, primary `#a20000`, primary-container `#d00000`, on-surface `#1b1d0e`, tertiary-fixed `#e3e2e2`, surface-container-high `#eaead1`, surface-container `#efefd7`, secondary `#5f5e5e`, error `#ba1a1a`, and all other tokens from the mock
- **Spacing**: add `xs: 4px`, `unit: 4px`, `stack-heavy: 48px`
- **Font families**: `headline-xl: ['Epilogue']`, `headline-lg: ['Epilogue']`, `headline-md: ['Epilogue']`, `label-bold: ['Space Grotesk']`, `label-mono: ['Space Grotesk']`, `body-lg: ['Inter']`, `body-md: ['Inter']`
- **Font sizes**: match the mock's fontSize definitions (lineHeight, letterSpacing, fontWeight)
- **BorderRadius**: set DEFAULT/lg/xl/full to `0` (neo-brutalist, no rounded corners)

### 2. `src/app/globals.css` — Neo-Brutalist Utilities
Replace the current globals.css with:
- `@tailwind` directives
- Body font-family override to use `font-body-md` from Tailwind
- Custom `.neo-shadow` class: `box-shadow: 4px 4px 0px 0px rgba(27,29,14,1)`
- Custom `.neo-shadow-lg` class: `box-shadow: 8px 8px 0px 0px rgba(27,29,14,1)`
- Custom `.active-press:active` class: `transform: translate(2px, 2px); box-shadow: 0 0 0 0`
- Custom `.active-nav-shadow` class: `box-shadow: 2px 2px 0px 0px rgba(27,29,14,1)`

### 3. `src/app/layout.tsx` — Updated Root Layout
- Change metadata title to "IRON COMMAND"
- Add Google Fonts `<link>` for Epilogue (700,800,900), Inter (400,500,700), Space Grotesk (500,700)
- Replace the top nav with `<Header />` component
- Replace the plain `<body>` styling with design system classes (`bg-background text-on-surface`)
- Add `<BottomNav />` component at the bottom
- Keep `<main>` wrapper with `max-w-4xl mx-auto`

### 4. `src/app/components/header.tsx` — Fixed Header Component
From the mock's `<header>` element:
- Fixed top bar, full width, `z-50`
- Left: hamburger menu icon (`menu` Material Symbol)
- Center: "IRON COMMAND" text (`font-headline-lg`, `font-black`, `text-primary`, `uppercase`, `tracking-tighter`)
- Right: account circle icon (`account_circle` Material Symbol)
- Styling: `bg-background`, `border-b-4 border-on-surface`, `neo-shadow`

### 5. `src/app/components/bottom-nav.tsx` — Fixed Bottom Navigation Component
From the mock's bottom nav:
- Fixed bottom bar, full width, `z-50`
- 4 tabs: WORKOUT, HISTORY, PROGRESS, CONFIG
- Each tab: Material Symbol icon + uppercase label (`font-label-bold`, `text-label-bold`)
- Active tab: `bg-primary text-on-primary`, bordered, `active-nav-shadow`
- Inactive tabs: cream fill, hover `bg-surface-container-highest`, `active:scale-95`
- Accepts `activeTab` prop to highlight the current page

### 6. `src/app/page.tsx` — Redesigned User Selection Page
Convert the "SELECT COMMANDER" mock to a Next.js page:
- **Hero**: "SELECT COMMANDER" centered title (`font-headline-xl`, `uppercase`), full-width divider line below
- **User cards grid**: 2-column grid (`grid-cols-1 md:grid-cols-2`), each card:
  - "ACTIVE" badge (top-right, red bg) for the current user (determine via cookie or session — for now, mark first user as active)
  - Avatar placeholder: `w-24 h-24`, `border-4 border-on-surface`, grayscale image (use placeholder gradient if no image)
  - User name: `font-headline-lg`, `uppercase`
  - Rank line: `font-label-mono`, e.g., "LVL 1 BEGINNER" (derive rank from user data — for MVP, use "LVL 1 BEGINNER" as default)
  - Stats grid: 2-column, TOTAL LOAD and MAX SQUAT tiles (show "0 KG" or placeholder for new users)
- **QUICK ADD card**: dashed border (`border-dashed`), add-circle icon, hover-to-dark (`hover:bg-on-surface hover:text-background`)
- **NEW RECRUIT CTA**: Full-width button (`bg-primary text-on-primary`), neo-shadow, person_add icon with FILL variant
- Preserve all existing functionality: `createUserAction`, `setCookie`, redirect to `/today`

## What Stays Unchanged
- All backend files in `src/features/user/` — entity, repository, use cases, server actions
- Database schema and migration
- Cookie-based user selection logic
- All test files

## Mock Page Mapping
`docs/mocks/` contains 4 mock pages. Each phase maps to one:
- Phase 1 → "User Selection" (SELECT COMMANDER)
- Phase 2 → "Today's Workout" (exercise cards section)
- Phase 3 → Config page (no dedicated mock, follow design system)
- Phase 4 → "Today's Workout" (full page with exercise cards, session toggles, bento grid)
- Phase 5 → "History Log" (WAR LOGS)
- Phase 6 → "Force Progression" (progress chart)
