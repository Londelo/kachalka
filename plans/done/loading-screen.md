# Plan — Loading Screen

## WHAT

A single shared loading screen component (`LoadingScreen`) rendered as a full-screen overlay, controlled by a `LoadingContext`. Every page that fetches data on mount signals its loading state. The overlay appears whenever any page is loading and disappears when all pages are done.

**Problem:** Navigation to data-heavy pages (History, Progress) renders the new page instantly, then waits 1–2 seconds for data. User sees a blank screen.

**Solution:** Bottom nav Links emit a loading signal on click. Pages set their key in the context when data starts and clear it when resolved. The LoadingScreen renders as a full-screen overlay whenever at least one page is loading.

## HOW

### src/app/components/loading-context.tsx (new)

```
use LoadingContext {
  pages: Set<string>       // page keys currently loading
  start(key: string): void // add key to set
  end(key: string): void   // remove key from set
}

export const LoadingProvider = ()
export function useLoading(): { start: fn, end: fn, loading: boolean }
```

- `Set<string>` tracks which pages are loading
- `loading` boolean = `pages.size > 0`
- Export `LoadingProvider` (wraps app layout) and `useLoading` hook

### src/app/components/loading-screen.tsx (new)

```
LoadingScreen
  • Fixed overlay: inset-0, z-[100], bg-background
  • Centered content:
    - Spinner icon (material-symbols-outlined: "hourglass_top", filled)
    - "LOADING..." text in label-bold uppercase
  • Only renders when `loading` is true (from context)
  • No close button, no escape key
```

### src/app/layout.tsx

- Wrap `<main>` with `<LoadingProvider>`
- Render `<LoadingScreen />` after `<main>` (inside provider so it can consume context)

### src/app/components/bottom-nav.tsx

- Wrap each nav `<Link>` with `onClick={() => useLoading().start('nav')}`
- This ensures the loading signal fires immediately on click, before the new page renders
- `end('nav')` fires when any page's data finishes loading (pages signal their own keys)

### src/app/(main)/history/HistoryPageClient.tsx

- On `useEffect` mount: call `start('history')` before `getHistoryAction`, `end('history')` in `.then()`
- Remove the existing inline loading state (`if (loading) { return <p>Loading war logs...</p> }`)

### src/app/(main)/today/page.tsx

- On `useEffect` mount: call `start('today')` before `getTodayExercisesAction`, `end('today')` in `.then()`
- Remove the existing inline loading state (`if (loading) { return <p>Loading...</p> }`)

### src/app/(main)/plan/page.tsx

- On `useEffect` + `loadData`: call `start('plan')` at top of `loadData`, `end('plan')` after both fetches complete
- Remove the existing inline loading state (`if (loading) { return <p>LOADING BATTLE PLAN...</p> }`)

### src/app/progress/page.tsx

- On `useEffect` mount: call `start('progress')` before data fetches, `end('progress')` when done
- Remove the existing inline loading state (`{loading && <p>LOADING PROGRESSION DATA...</p>}`)

## FILES TO CHANGE

- `src/app/components/loading-context.tsx` (new)
- `src/app/components/loading-screen.tsx` (new)
- `src/app/layout.tsx`
- `src/app/components/bottom-nav.tsx`
- `src/app/(main)/history/HistoryPageClient.tsx`
- `src/app/(main)/today/page.tsx`
- `src/app/(main)/plan/page.tsx`
- `src/app/progress/page.tsx`
