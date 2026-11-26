import { defineConfig } from '@playwright/test'

import { getE2eBaseUrl } from './tests/e2e/e2e-config'

// Sized against the save the suite races, never plucked: the Today page auto-saves a
// set on a debounce (DEBOUNCE_MS in src/app/today/page.tsx, 500 ms today), and the
// brief that sized this window assumed that debounce was 5000 ms and asked for 3x it.
// 15000 ms is that floor — 3x the 5000 ms figure, 30x the live debounce — so no
// assertion can expire while a save is legitimately still in flight. Do not tune
// either timeout back down toward the debounce; a suite that fails at the save
// interval is indistinguishable from a real bug.
const SAVE_DEBOUNCE_TIMEOUT_MS = 15_000

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: SAVE_DEBOUNCE_TIMEOUT_MS,
  expect: {
    timeout: SAVE_DEBOUNCE_TIMEOUT_MS,
  },
  use: {
    baseURL: getE2eBaseUrl(),
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
