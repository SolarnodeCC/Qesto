#!/usr/bin/env node
/**
 * Capture Day 60 adoption walkthrough screenshots (join + login).
 * Usage: node scripts/capture-day60-walkthrough.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5173'
const OUT = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'dark',
})
const page = await context.newPage()

async function shot(name, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(400)
  const file = join(OUT, name)
  await page.screenshot({ path: file, fullPage: false })
  console.log('wrote', file)
}

await shot('day60_join_landing_dark.png', '/join')
await shot('day60_login_dark.png', '/login')

// Mobile join
await page.setViewportSize({ width: 390, height: 844 })
await shot('day60_join_landing_mobile.png', '/join')

await browser.close()
console.log('day60 walkthrough capture done')
