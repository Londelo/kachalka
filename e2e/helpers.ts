import type { Page } from '@playwright/test'

export async function loginAsBruno(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'kachalka.userId',
      value: '1',
      url: 'http://localhost:3111',
    },
  ])
}

export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies()
}
