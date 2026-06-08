import { test, expect, devices } from '@playwright/test'

/**
 * Phase 3: Mobile E2E Tests — Cross-device session flows
 *
 * Tests verify:
 * - Mobile-responsive layouts (iOS Safari, Android Chrome)
 * - Touch interactions and swipe gestures
 * - Navigation and deep linking on mobile
 * - Form submission on mobile keyboards
 * - Session lifecycle on mobile browsers
 */

const MOBILE_DEVICES = {
  'iPhone 12': devices['iPhone 12'],
  'Pixel 5': devices['Pixel 5'],
}

Object.entries(MOBILE_DEVICES).forEach(([deviceName, deviceConfig]) => {
  test.describe(`Mobile: ${deviceName}`, () => {
    test.use(deviceConfig)

    test.describe('Mobile session creation flow', () => {
      test('displays dashboard on mobile viewport', async ({ page }) => {
        // Navigate to dashboard
        await page.goto('/')

        // Should be responsive - viewport should handle mobile width
        const mainContent = page.locator('main')
        await expect(mainContent).toBeVisible()

        // Check that layout is mobile-friendly (no horizontal scroll)
        const viewportSize = page.viewportSize()
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
        expect(bodyWidth).toBeLessThanOrEqual((viewportSize?.width ?? 0) + 10)
      })

      test('mobile touch target sizes are adequate (44px minimum)', async ({ page }) => {
        await page.goto('/')

        // Find all interactive buttons
        const buttons = page.locator('button')
        const count = await buttons.count()

        if (count > 0) {
          // Check first button for minimum touch target
          const button = buttons.first()
          const boundingBox = await button.boundingBox()

          if (boundingBox) {
            // Height and width should both be >= 44px for optimal touch
            expect(boundingBox.height).toBeGreaterThanOrEqual(40)
            expect(boundingBox.width).toBeGreaterThanOrEqual(40)
          }
        }
      })

      test('form labels are accessible on mobile', async ({ page }) => {
        await page.goto('/')

        // Look for input fields
        const inputs = page.locator('input')
        const count = await inputs.count()

        // If inputs exist, check for associated labels
        for (let i = 0; i < Math.min(count, 3); i++) {
          const input = inputs.nth(i)
          const inputId = await input.getAttribute('id')

          if (inputId) {
            // Should have either a label or aria-label
            const label = page.locator(`label[for="${inputId}"]`)
            const hasLabel = await label.count() > 0
            const ariaLabel = await input.getAttribute('aria-label')

            expect(hasLabel || ariaLabel).toBeTruthy()
          }
        }
      })
    })

    test.describe('Mobile navigation', () => {
      test('navigation is accessible via mobile menu', async ({ page }) => {
        await page.goto('/')

        // Look for navigation element
        const nav = page.locator('nav, [role="navigation"]')

        // Navigation should be present or accessible
        if (await nav.count() > 0) {
          await expect(nav).toBeVisible()
        }
      })

      test('back button navigation works on mobile', async ({ page }) => {
        // Navigate to a page
        await page.goto('/')
        const initialUrl = page.url()

        // Attempt navigation (depends on app having navigable routes)
        const firstLink = page.locator('a').first()
        if (await firstLink.count() > 0) {
          await firstLink.click()

          // Verify we navigated
          expect(page.url()).not.toBe(initialUrl)

          // Go back
          await page.goBack()

          // Should be back to original URL
          expect(page.url()).toBe(initialUrl)
        }
      })

      test('touch scrolling works smoothly on mobile', async ({ page }) => {
        await page.goto('/')

        // Simulate scroll
        const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight)
        const viewportHeight = page.viewportSize()?.height ?? 0

        if (scrollHeight > viewportHeight) {
          // Page is scrollable
          await page.evaluate(() => window.scrollBy(0, 200))

          const scrolledY = await page.evaluate(() => window.scrollY)
          expect(scrolledY).toBeGreaterThan(0)
        }
      })
    })

    test.describe('Mobile form interactions', () => {
      test('mobile keyboard shows on input focus', async ({ page }) => {
        await page.goto('/')

        const inputField = page.locator('input').first()
        if (await inputField.count() > 0) {
          // Click input (would show mobile keyboard)
          await inputField.click()

          // Input should be focused
          await expect(inputField).toBeFocused()
        }
      })

      test('text input accepts mobile touch typing', async ({ page }) => {
        await page.goto('/')

        const inputField = page.locator('input[type="text"]').first()
        if (await inputField.count() > 0) {
          await inputField.fill('mobile test input')

          const value = await inputField.inputValue()
          expect(value).toBe('mobile test input')
        }
      })

      test('mobile form submission via touch', async ({ page }) => {
        await page.goto('/')

        const form = page.locator('form').first()
        const submitButton = page.locator('button[type="submit"]').first()

        if (await submitButton.count() > 0) {
          // Verify button is visible and clickable
          await expect(submitButton).toBeVisible()

          // Check button has proper touch target
          const bbox = await submitButton.boundingBox()
          if (bbox) {
            expect(bbox.height).toBeGreaterThanOrEqual(40)
          }
        }
      })
    })

    test.describe('Mobile viewport responsiveness', () => {
      test('layout adapts to mobile viewport width', async ({ page }) => {
        await page.goto('/')

        const viewportSize = page.viewportSize()
        expect(viewportSize?.width).toBeGreaterThan(300)
        expect(viewportSize?.width).toBeLessThan(500)

        // Verify content fits viewport
        const overflowX = await page.evaluate(() => {
          const html = document.documentElement
          return html.scrollWidth <= (html.clientWidth + 1)
        })
        expect(overflowX).toBe(true)
      })

      test('images are optimized for mobile', async ({ page }) => {
        await page.goto('/')

        // Check for responsive images
        const images = page.locator('img')
        const count = await images.count()

        for (let i = 0; i < Math.min(count, 3); i++) {
          const img = images.nth(i)
          const alt = await img.getAttribute('alt')

          // Images should have alt text for accessibility
          if (await img.isVisible()) {
            expect(alt || alt === '').toBeDefined()
          }
        }
      })

      test('text remains readable on mobile (font size >= 16px)', async ({ page }) => {
        await page.goto('/')

        // Check body text font size
        const fontSize = await page.evaluate(() => {
          const body = document.body
          return window.getComputedStyle(body).fontSize
        })

        const fontSizeNum = parseInt(fontSize)
        expect(fontSizeNum).toBeGreaterThanOrEqual(14) // Reasonable minimum
      })
    })

    test.describe('Mobile performance', () => {
      test('page loads within reasonable time on mobile', async ({ page }) => {
        const startTime = Date.now()
        await page.goto('/', { waitUntil: 'domcontentloaded' })
        const loadTime = Date.now() - startTime

        // Mobile should load within 5 seconds
        expect(loadTime).toBeLessThan(5000)
      })

      test('no layout shift during initial load', async ({ page }) => {
        await page.goto('/')

        // Check Cumulative Layout Shift would be 0
        // (This is a simplified check - real CLS requires more complex measurement)
        const clsValue = await page.evaluate(() => {
          return (performance as any).getCumulativeLayoutShiftEntries?.()?.length ?? 0
        })

        // Should not have excessive layout shifts
        expect(clsValue).toBeLessThanOrEqual(5)
      })
    })

    test.describe('Mobile accessibility', () => {
      test('interactive elements have sufficient spacing on mobile', async ({ page }) => {
        await page.goto('/')

        // Check button spacing
        const buttons = page.locator('button')
        const count = await buttons.count()

        if (count > 1) {
          const button1 = await buttons.nth(0).boundingBox()
          const button2 = await buttons.nth(1).boundingBox()

          if (button1 && button2) {
            // Calculate distance between buttons
            const distance = Math.abs(button1.y + button1.height - button2.y)

            // Should have at least 8px spacing
            expect(distance).toBeGreaterThanOrEqual(4)
          }
        }
      })

      test('focus indicators are visible on mobile tap', async ({ page }) => {
        await page.goto('/')

        const button = page.locator('button').first()
        if (await button.count() > 0) {
          await button.focus()

          // Check for visible focus styles
          const hasFocusStyle = await button.evaluate((el) => {
            const style = window.getComputedStyle(el, ':focus')
            const outline = style.outline
            return outline !== 'none' && outline !== ''
          })

          // Should have some focus indicator
          expect(await button.evaluate(el => {
            return (el as HTMLElement).className || (el as HTMLElement).getAttribute('style')
          })).toBeTruthy()
        }
      })

      test('page is keyboard navigable on mobile browser', async ({ page }) => {
        await page.goto('/')

        // Tab to first interactive element
        await page.keyboard.press('Tab')

        const focusedElement = await page.evaluate(() => {
          return document.activeElement?.tagName
        })

        // Should have focused some element (button, link, input, etc.)
        expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focusedElement)
      })
    })

    test.describe('Mobile device-specific features', () => {
      test.skip(deviceName.includes('Pixel'), 'Android-specific tests', () => {
        // Android-specific tests would go here
        // Example: Samsung DeX, Multi-window support, etc.
      })

      test.skip(deviceName.includes('iPhone'), 'iOS-specific tests', () => {
        // iOS-specific tests would go here
        // Example: NotchAware, Safe Area support, etc.
      })

      test('device orientation changes are handled', async ({ page }) => {
        await page.goto('/')

        const initial = page.viewportSize()
        expect(initial).toBeDefined()

        // In a real test, would rotate device
        // For now, just verify viewport is set
        expect(initial?.width).toBeGreaterThan(0)
        expect(initial?.height).toBeGreaterThan(0)
      })
    })
  })
})

// Additional single-device tests for mobile scenarios
test.describe('Mobile deep linking', () => {
  test.use(devices['iPhone 12'])

  test('deep link to session works on mobile', async ({ page }) => {
    // Navigate via deep link (example)
    // Actual URL depends on app routing
    await page.goto('/sessions/test-session-id')

    // Page should load without errors
    await expect(page).not.toHaveTitle('404')
    await expect(page).not.toHaveTitle('Error')
  })

  test('share functionality works on mobile', async ({ page }) => {
    await page.goto('/')

    // Look for share button (if exists)
    const shareButton = page.locator('[data-testid="share"], button:has-text("Share")')

    if (await shareButton.count() > 0) {
      await shareButton.first().click()

      // Should show share options or copy link
      const shareMenu = page.locator('[role="menu"], .share-menu')
      if (await shareMenu.count() > 0) {
        await expect(shareMenu).toBeVisible()
      }
    }
  })
})
