# Plan 6 — Slide-Out Drawer + Floating Header

## WHAT

Replace the fixed bottom navigation bar with a left-side slide-out drawer (80% screen width) triggered by clicking the app header. The drawer lists four routes: Workout (/today), History (/history), Progress (/progress), and Plan (/plan). Clicking any part of the header opens the drawer; the user icon navigates to the select-user page. The drawer closes automatically when a route is selected.

Files to change:
- src/app/layout.tsx
- src/app/components/header.tsx
- src/app/components/bottom-nav.tsx
- src/app/components/nav-wrapper.client.tsx

## HOW

### src/app/layout.tsx
- Remove `<NavWrapper />` from the body (bottom nav is gone)
- Keep `<Header />` as-is (fixed, edge-to-edge) — pass it a menu toggle callback
- Add state: `isDrawerOpen` (boolean, default false)
- Pass `onMenuToggle` to Header that toggles the drawer state
- Render `<SideDrawer>` after `<main>` with isOpen and onClose props
- Main content area needs top padding to account for the header height (remove any existing bottom padding that was compensating for bottom nav)

### src/app/components/header.tsx
- Wrap the entire header content (branding + user icon) in a `<button>` element that calls onMenuToggle when clicked
- Keep the user icon (`account_circle`) as a `<Link>` to the select-user page — wrap it in a div with `onClick={(e) => e.stopPropagation()}` so the header-click toggle doesn't fire on icon clicks
- Keep the hamburger icon for visual clarity (menu icon)
- Keep the branding text "IRON COMMAND"

### src/app/components/side-drawer.tsx (new)

SideDrawer(props: { isOpen: boolean, onClose: () => void })
  • Render a fixed-position overlay panel positioned at the left edge
  • Width: 80% of viewport
  • Z-index: higher than the header so it slides on top
  • Background: same as app background with right border for visual separation
  • When closed: transform translateX(-100%) so it's off-screen
  • When open: transform translateX(0)
  • Transition: 200ms ease-in-out slide animation
  • Content:
    • Branding section at the top (IRON COMMAND title)
    • Divider line
    • Navigation links for all four routes:
      - Workout → /today (icon: fitness_center)
      - History → /history (icon: calendar_today)
      - Progress → /progress (icon: monitoring)
      - Plan → /plan (icon: settings)
    • Active route highlighted with border and shadow styling matching the existing bottom-nav pattern
  • Close behavior:
    • Clicking the backdrop closes the drawer (fixed inset-0 bg-black/50 overlay)
    • Clicking a nav item closes the drawer AND navigates (automatic close on selection)
    • No explicit close button, no escape key, no ARIA attributes

### src/app/components/nav-wrapper.client.tsx
- Remove the `BottomNav` import and rendering
- Export a `<SideDrawer>` component (or inline the drawer) that manages its own open/close state via React state
- The drawer should be rendered here (client component) since it needs `usePathname` and open/close state
- `NavWrapper` in the root layout can either be removed entirely or repurposed to render `<SideDrawer />` at the end of the body

## WHY

The bottom nav takes up valuable screen real estate and doesn't scale well on different viewport sizes. Moving navigation to a slide-out drawer gives more content area, creates a cleaner reading experience, and follows a common mobile app pattern. The header is already the natural "app chrome" element — making it the drawer trigger keeps the interaction intuitive without adding extra touch targets.

## QUESTIONS

- Drawer width: 80% on very small screens (320px) = 256px. Is that fine?
- Should the drawer have a backdrop overlay (click to close)? (Yes — confirmed)
- Should the drawer remember its open/closed state across page navigations? (No — starts closed on navigation)

## CRITIQUES

- Making the entire header clickable to open the drawer could cause accidental opens — users trying to interact with the header area might trigger the drawer unexpectedly.
- No explicit close button or escape key means the drawer can only be closed by tapping the backdrop or selecting a route. Users who accidentally open it might find it annoying.
- 80% drawer on very small screens leaves cramped content space. Consider a max-width cap (e.g., 320px) on larger viewports.
- Need to ensure the drawer doesn't interfere with scrolling — should prevent body scroll when open.
- The branding section inside the drawer might feel redundant since the header already shows "IRON COMMAND." Consider whether it's needed.
