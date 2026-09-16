/**
 * Fresh Day-30 walkthrough evidence captures (post Legal contrast fix).
 * Run: node scripts/capture-day30-walkthrough.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

async function dismissCookieIfPresent() {
  const accept = page.getByRole('button', { name: /^Accept$/i })
  if (await accept.count()) {
    await accept.first().click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
}

async function setTheme(theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t)
    try {
      localStorage.setItem('qesto-color-scheme', t)
    } catch {
      /* ignore */
    }
  }, theme)
  await page.waitForTimeout(200)
}

async function shot(name) {
  const path = `${OUT}/${name}`
  await page.screenshot({ path, fullPage: false })
  console.log('wrote', path)
}

// ── Home light desktop ─────────────────────────────────────────────────────
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await setTheme('light')
await shot('walkthrough_home_light_desktop.png')
await dismissCookieIfPresent()
await shot('walkthrough_home_light_desktop_no_cookie.png')

// ── Home dark desktop ──────────────────────────────────────────────────────
await setTheme('dark')
await shot('walkthrough_home_dark_desktop.png')

// ── Home mobile light ──────────────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 844 })
await page.reload({ waitUntil: 'networkidle' })
await setTheme('light')
await dismissCookieIfPresent()
await shot('walkthrough_home_light_mobile.png')
await setTheme('dark')
await shot('walkthrough_home_dark_mobile.png')

// Open mobile nav
const menuBtn = page.getByRole('button', { name: /menu|navigatie|open/i }).first()
if (await menuBtn.count()) {
  await menuBtn.click()
  await page.waitForTimeout(350)
  await shot('walkthrough_home_dark_mobile_nav_open.png')
  // close if possible
  const closeBtn = page.getByRole('button', { name: /close|sluit/i }).first()
  if (await closeBtn.count()) await closeBtn.click().catch(() => {})
}

// ── Legal desktop light + dark ─────────────────────────────────────────────
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto('http://127.0.0.1:5173/legal', { waitUntil: 'networkidle' })
await setTheme('light')
await dismissCookieIfPresent()
await shot('walkthrough_legal_light_desktop.png')
await setTheme('dark')
await shot('walkthrough_legal_dark_desktop.png')

const h1LightDark = await page.locator('h1').evaluate((el) => getComputedStyle(el).color)
console.log('legal dark h1 color', h1LightDark)

// ── Legal mobile dark + jump ───────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 844 })
await page.reload({ waitUntil: 'networkidle' })
await setTheme('dark')
await dismissCookieIfPresent()
await page.waitForSelector('#doc-toc-jump')
await shot('walkthrough_legal_dark_mobile_toc.png')
await page.selectOption('#doc-toc-jump', 'l4')
await page.waitForTimeout(700)
await shot('walkthrough_legal_dark_mobile_jumped_section4.png')

// ── Legal mobile light ─────────────────────────────────────────────────────
await setTheme('light')
await shot('walkthrough_legal_light_mobile.png')

// ── Pricing smoke (MainLayout continuity) ──────────────────────────────────
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto('http://127.0.0.1:5173/pricing', { waitUntil: 'networkidle' })
await setTheme('dark')
await dismissCookieIfPresent()
await shot('walkthrough_pricing_dark_desktop.png')

await browser.close()
console.log('done')
