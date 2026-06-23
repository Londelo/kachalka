# E2E Test Page

Write comprehensive Playwright E2E tests for a Next.js page by studying the codebase, then create the test file and fix any bugs discovered.

## Workflow

### Phase 1: Research (parallel agents)

Spawn 4 Explore agents in parallel:

1. **Page UI** — Study the target page file, all components it imports, server actions, use cases, entities, and data flow. Note all selectors, roles, data-ids, buttons, inputs, modals, and conditional rendering.

2. **Feature module** — Study the relevant feature module (e.g., `src/features/routine/` for plan page). All server actions, use cases, repository interface/impl, entities. Focus on params, return types, business rules, error messages.

3. **Related feature** — Study any related feature modules (e.g., exercise feature for plan page). Same depth.

4. **E2E patterns** — Study `playwright.config.ts`, existing E2E tests, helpers, and test utilities. Document conventions: import style, test structure, auth patterns, selector priorities, assertion types, wait strategies.

### Phase 2: Analyze & Design

Synthesize findings from all agents. Identify:
- All user interactions to test
- Data dependencies (what seed data exists, what tests need to create)
- Bug discovery (mismatches between expected and actual behavior)
- Test cases to write (aim for 10-15 tests)

### Phase 3: Write Tests

Create `tests/e2e/<feature>.spec.ts` following these conventions:

```ts
import { test, expect } from '@playwright/test'
import { loginAsBruno } from './helpers'

test('test name', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/<path>')
  await expect(page.getByRole('heading', { name: '...' })).toBeVisible()
  // ... test steps
})
```

**Selector priorities:**
1. `getByRole` for buttons, headings, links with accessible names
2. `locator('#id')` for elements with id attributes
3. `locator('tag').filter({ hasText })` as last resort
4. Never use `getByText` when multiple elements match (strict mode violation)

**Test patterns:**
- Each test is self-contained — no shared state between tests
- Use `loginAsBruno(page)` for auth (sets cookie `kachalka.userId=1`)
- Navigate directly to the target page with `page.goto('http://localhost:3111/<path>')`
- Wait for client-side hydration: `await expect(page.getByRole('heading', { name: 'CURRENT ASSETS' })).toBeVisible({ timeout: 10000 })`
- For modals: `getByRole('dialog')`, `getByRole('button', { name: 'CANCEL' })`

### Phase 4: Fix Bugs

Common bugs to watch for:
- **`loadData()` returning `undefined`** — functions that callers check with `if (!result)` must explicitly `return true` on success
- **Day-of-week mismatches** — seed scripts may use JS `getDay()` (Sun=0) vs app convention (Mon=0)
- **Strict mode violations** — `getByText` matching multiple elements
- **Loading state blocking** — wait for content, not just headings

### Phase 5: Run & Verify

```bash
npm run test:e2e -- tests/e2e/<feature>.spec.ts --retries=0
```

If tests fail due to missing data, ensure `scripts/run-playwright-tests.sh` seeds test data:
```bash
echo "Wiping test data..."
node scripts/cleanup-test-data.js
echo "Creating test user and exercises..."
node scripts/seed-test-data.js
echo "Starting dev server on port $PORT..."
```

Create `scripts/seed-test-data.js` if it doesn't exist — minimal seed: Bruno user + basic exercises, no routines.

## Bug Fixes

When bugs are found, fix them before re-running tests. Common fixes:
- Add `return true` to functions whose return value is checked
- Fix day-of-week values in seed scripts
- Tighten selectors to avoid strict mode violations
- Add waits for client-side hydration
