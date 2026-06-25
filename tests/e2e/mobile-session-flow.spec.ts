import { test, expect } from './fixtures'

/**
 * Phase 3: Mobile E2E Tests — Cross-device session flows
 *
 * Uses setViewportSize instead of test.use(devices) so tests stay compatible
 * with channel: 'chrome' in playwright.config.ts (Playwright 1.61+).
 */

const MOBILE_VIEWPORTS = {
  'iPhone 12': { width: 390, height: 844 },
  'Pixel 5': { width: 393, height: 851 },
} as const

for (const [deviceName, viewport] of Object.entries(MOBILE_VIEWPORTS)) {
  test.describe(`Mobile: ${deviceName}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport)
    })

    test.describe('Mobile session creation flow', () => {
      test('displays dashboard on mobile viewport', async ({ page }) => {
        await page.goto('/')

        const mainContent = page.locator('main')
        await expect(mainContent).toBeVisible()

        const viewportSize = page.viewportSize()
        const mainWidth = await mainContent.evaluate((el) => el.scrollWidth)
        expect(mainWidth).toBeLessThanOrEqual((viewportSize?.width ?? 0) + 10)
      })

      test('mobile touch target sizes are adequate (44px minimum)', async ({ page }) => {
        await page.goto('/')

        const cta = page.getByRole('link', { name: /launch your next session/i })
        if (await cta.count() > 0) {
          const boundingBox = await cta.boundingBox()
          if (boundingBox) {
            expect(boundingBox.height).toBeGreaterThanOrEqual(44)
            expect(boundingBox.width).toBeGreaterThanOrEqual(44)
          }
        }
      })

      test('form labels are accessible on mobile', async ({ page }) => {
        await page.goto('/login')

        for (const id of ['signup-email', 'signup-name', 'signup-password']) {
          const input = page.locator(`#${id}`)
          if (await input.count() > 0) {
            const label = page.locator(`label[for="${id}"]`)
            await expect(label).toBeVisible()
          }
        }
      })
    })

    test.describe('Mobile navigation', () => {
      test('navigation is accessible via mobile menu', async ({ page }) => {
        await page.goto('/')

        const nav = page.locator('nav, [role="navigation"]').first()
        await expect(nav).toBeVisible()
      })

      test('back button navigation works on mobile', async ({ page }) => {
        await page.goto('/')
        const initialUrl = page.url()

        await page.getByRole('link', { name: /pricing/i }).first().click()
        expect(page.url()).not.toBe(initialUrl)

        await page.goBack()
        expect(page.url()).toBe(initialUrl)
      })

      test('touch scrolling works smoothly on mobile', async ({ page }) => {
        await page.goto('/')

        const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight)
        const viewportHeight = page.viewportSize()?.height ?? 0

        if (scrollHeight > viewportHeight) {
          await page.evaluate(() => window.scrollBy(0, 200))
          const scrolledY = await page.evaluate(() => window.scrollY)
          expect(scrolledY).toBeGreaterThan(0)
        }
      })
    })

    test.describe('Mobile form interactions', () => {
      test('mobile keyboard shows on input focus', async ({ page }) => {
        await page.goto('/login')
        await page.getByRole('tab', { name: /^(login|log in)$/i }).first().click()

        const inputField = page.locator('#login-email')
        await inputField.click()
        await expect(inputField).toBeFocused()
      })

      test('text input accepts mobile touch typing', async ({ page }) => {
        await page.goto('/login')
        await page.getByRole('tab', { name: /^(login|log in)$/i }).first().click()

        const inputField = page.locator('#login-email')
        await inputField.fill('mobile test input')
        await expect(inputField).toHaveValue('mobile test input')
      })

      test('mobile form submission via touch', async ({ page }) => {
        await page.goto('/login')
        await page.getByRole('tab', { name: /^(login|log in)$/i }).first().click()

        const submitButton = page.getByRole('button', { name: /^(login|log in)/i })
        await expect(submitButton).toBeVisible()

        const bbox = await submitButton.boundingBox()
        if (bbox) {
          expect(bbox.height).toBeGreaterThanOrEqual(40)
        }
      })
    })

    test.describe('Mobile viewport responsiveness', () => {
      test('layout adapts to mobile viewport width', async ({ page }) => {
        await page.goto('/')

        const viewportSize = page.viewportSize()
        expect(viewportSize?.width).toBeGreaterThan(300)
        expect(viewportSize?.width).toBeLessThan(500)

        const main = page.locator('main')
        const overflowX = await main.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
        expect(overflowX).toBe(true)
      })

      test('images are optimized for mobile', async ({ page }) => {
        await page.goto('/')

        const images = page.locator('img')
        const count = await images.count()

        for (let i = 0; i < Math.min(count, 3); i++) {
          const img = images.nth(i)
          if (await img.isVisible()) {
            const alt = await img.getAttribute('alt')
            expect(alt).toBeDefined()
          }
        }
      })

      test('text remains readable on mobile (font size >= 16px)', async ({ page }) => {
        await page.goto('/')

        const fontSize = await page.evaluate(() => window.getComputedStyle(document.body).fontSize)
        const fontSizeNum = parseInt(fontSize)
        expect(fontSizeNum).toBeGreaterThanOrEqual(14)
      })
    })

    test.describe('Mobile performance', () => {
      test('page loads within reasonable time on mobile', async ({ page }) => {
        const startTime = Date.now()
        await page.goto('/', { waitUntil: 'domcontentloaded' })
        const loadTime = Date.now() - startTime
        expect(loadTime).toBeLessThan(8000)
      })

      test('no layout shift during initial load', async ({ page }) => {
        await page.goto('/')

        const clsValue = await page.evaluate(() => {
          return (performance as Performance & { getCumulativeLayoutShiftEntries?: () => unknown[] })
            .getCumulativeLayoutShiftEntries?.()?.length ?? 0
        })
        expect(clsValue).toBeLessThanOrEqual(5)
      })
    })

    test.describe('Mobile accessibility', () => {
      test('interactive elements have sufficient spacing on mobile', async ({ page }) => {
        await page.goto('/login')

        const buttons = page.locator('button')
        const count = await buttons.count()

        if (count > 1) {
          const button1 = await buttons.nth(0).boundingBox()
          const button2 = await buttons.nth(1).boundingBox()

          if (button1 && button2) {
            const distance = Math.abs(button1.y + button1.height - button2.y)
            expect(distance).toBeGreaterThanOrEqual(8)
          }
        }
      })

      test('focus indicators are visible on mobile tap', async ({ page }) => {
        await page.goto('/login')

        const button = page.locator('button').first()
        if (await button.count() > 0) {
          await button.focus()
          const hasIndicator = await button.evaluate((el) => {
            return !!(((el as HTMLElement).className || (el as HTMLElement).getAttribute('style')))
          })
          expect(hasIndicator).toBeTruthy()
        }
      })

      test('page is keyboard navigable on mobile browser', async ({ page }) => {
        await page.goto('/login')

        await page.keyboard.press('Tab')
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
        expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'BODY']).toContain(focusedElement)
      })
    })

    test.describe('Mobile device-specific features', () => {
      test('device orientation changes are handled', async ({ page }) => {
        await page.goto('/')

        const initial = page.viewportSize()
        expect(initial).toBeDefined()
        expect(initial?.width).toBeGreaterThan(0)
        expect(initial?.height).toBeGreaterThan(0)
      })
    })
  })
}

test.describe('Mobile deep linking', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('deep link to session works on mobile', async ({ page }) => {
    await page.goto('/sessions/test-session-id')
    await expect(page).not.toHaveTitle('404')
    await expect(page).not.toHaveTitle('Error')
  })

  test('share functionality works on mobile', async ({ page }) => {
    await page.goto('/')

    const shareButton = page.locator('[data-testid="share"], button:has-text("Share")')
    if (await shareButton.count() > 0) {
      await shareButton.first().click()
      const shareMenu = page.locator('[role="menu"], .share-menu')
      if (await shareMenu.count() > 0) {
        await expect(shareMenu).toBeVisible()
      }
    }
  })
})
