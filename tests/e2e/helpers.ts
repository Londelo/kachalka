import type { Page } from '@playwright/test'

import { getE2eBaseUrl } from './e2e-config'

export async function loginAsBruno(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'kachalka.userId',
      value: '1',
      url: getE2eBaseUrl(),
    },
  ])
}

export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies()
}
