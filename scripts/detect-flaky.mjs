#!/usr/bin/env node
/**
 * detect-flaky.mjs
 * Analyzes vitest JSON report for flaky tests (high variance or retry failures).
 * Generates Markdown report and exits with code 1 if flaky tests found.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const REPORT_FILE = '/tmp/vitest.json'

/**
 * Calculate runtime variance
 */
function analyzeRuntimes(timings) {
  if (timings.length < 2) return { variance: 0, median: timings[0] || 0, max: timings[0] || 0 }

  const sorted = [...timings].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length
  const stdDev = Math.sqrt(variance)
  const max = Math.max(...sorted)

  return { variance, stdDev, median, max, mean }
}

/**
 * Detect flaky tests from JSON report
 */
function detectFlaky(reportData) {
  const flaky = []

  // Parse test results
  if (!reportData.testResults || !Array.isArray(reportData.testResults)) {
    console.warn('⚠️  No testResults in report')
    return flaky
  }

  // Track test timings and results
  const testStats = new Map()

  for (const suite of reportData.testResults) {
    if (!suite.assertionResults) continue

    for (const test of suite.assertionResults) {
      const testName = `${suite.name}::${test.fullName}`
      const runtime = test.duration || 0

      if (!testStats.has(testName)) {
        testStats.set(testName, {
          name: testName,
          fullName: test.fullName,
          suiteName: suite.name,
          timings: [],
          results: [],
          failureMessages: test.failureMessages || [],
          status: test.status,
        })
      }

      const stat = testStats.get(testName)
      stat.timings.push(runtime)
      stat.results.push(test.status)
      if (test.failureMessages) {
        stat.failureMessages = test.failureMessages
      }
    }
  }

  // Analyze for flakiness
  for (const [, stat] of testStats) {
    const issues = []

    // Check for mixed pass/fail (classic flaky indicator)
    const hasPass = stat.results.some((r) => r === 'passed')
    const hasFail = stat.results.some((r) => r !== 'passed')
    if (hasPass && hasFail) {
      issues.push('mixed_results')
    }

    // Check for high variance in runtime (3x median)
    if (stat.timings.length >= 2) {
      const analysis = analyzeRuntimes(stat.timings)
      if (analysis.max > analysis.median * 3) {
        issues.push(`high_variance (max: ${analysis.max}ms, median: ${analysis.median}ms)`)
      }

      // Check for timeouts or long hangs
      if (analysis.max > 5000) {
        issues.push(`slow_execution (${analysis.max}ms)`)
      }
    }

    if (issues.length > 0) {
      flaky.push({
        ...stat,
        issues,
      })
    }
  }

  return flaky
}

/**
 * Load quarantine list
 */
function loadQuarantine() {
  const quarantineFile = path.join(PROJECT_ROOT, 'tests/flaky.quarantine.txt')
  if (!fs.existsSync(quarantineFile)) {
    return []
  }

  return fs
    .readFileSync(quarantineFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

/**
 * Check if test matches quarantine pattern
 */
function isQuarantined(testName, patterns) {
  return patterns.some((pattern) => {
    const regex = new RegExp(pattern)
    return regex.test(testName)
  })
}

/**
 * Generate Markdown report
 */
function generateReport(flaky, quarantined) {
  const lines = [
    '# Flaky Test Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ]

  if (flaky.length === 0) {
    lines.push('✅ No flaky tests detected!')
    return lines.join('\n')
  }

  const newFlaky = flaky.filter((t) => !quarantined.has(t.name))
  const expectedFlaky = flaky.filter((t) => quarantined.has(t.name))

  lines.push(`## Summary`)
  lines.push(`- Total flaky tests: **${flaky.length}**`)
  lines.push(`- New flaky tests: **${newFlaky.length}**`)
  lines.push(`- Quarantined (expected): **${expectedFlaky.length}**`)
  lines.push('')

  if (newFlaky.length > 0) {
    lines.push('## 🚨 New Flaky Tests')
    lines.push('')
    for (const test of newFlaky) {
      lines.push(`### ${test.fullName}`)
      lines.push(`- Suite: \`${test.suiteName}\``)
      lines.push(`- Issues: ${test.issues.join(', ')}`)
      if (test.failureMessages && test.failureMessages.length > 0) {
        lines.push(`- Last error: \`${test.failureMessages[0].split('\n')[0]}\``)
      }
      lines.push('')
    }
  }

  if (expectedFlaky.length > 0) {
    lines.push('## ⏳ Quarantined Tests (Expected)')
    lines.push('')
    for (const test of expectedFlaky) {
      lines.push(`- ${test.fullName} (${test.issues.join(', ')})`)
    }
    lines.push('')
  }

  lines.push('## Recommendations')
  lines.push('1. Add new flaky tests to `tests/flaky.quarantine.txt` (use regex patterns)')
  lines.push('2. Investigate high-variance tests for timing dependencies')
  lines.push('3. Add retry logic or wait conditions to unstable tests')
  lines.push('4. Check for test pollution (shared state between tests)')
  lines.push('')

  return lines.join('\n')
}

/**
 * Main
 */
async function main() {
  // Run tests with JSON reporter
  console.log('Running tests with JSON reporter...\n')
  try {
    execSync(`vitest run --reporter=json --outputFile=${REPORT_FILE}`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    })
  } catch (err) {
    // Tests may fail but report is still generated
    console.log('Tests completed (some may have failed)\n')
  }

  // Read report
  if (!fs.existsSync(REPORT_FILE)) {
    console.error(`❌ Report file not found: ${REPORT_FILE}`)
    process.exit(1)
  }

  let reportData
  try {
    const raw = fs.readFileSync(REPORT_FILE, 'utf8')
    reportData = JSON.parse(raw)
  } catch (err) {
    console.error(`❌ Failed to parse report: ${err.message}`)
    process.exit(1)
  }

  // Detect flaky tests
  const flaky = detectFlaky(reportData)
  const quarantine = loadQuarantine()
  const quarantinedSet = new Set(quarantine)

  // Generate report
  const report = generateReport(flaky, quarantinedSet)
  console.log('\n' + '='.repeat(70))
  console.log(report)
  console.log('='.repeat(70))

  // Count metrics
  const newFlaky = flaky.filter((t) => !quarantinedSet.has(t.name))
  const totalTests = reportData.testResults?.reduce((sum, r) => sum + (r.numTestsTotal || 0), 0) || 0
  const flakyPercent = totalTests > 0 ? ((flaky.length / totalTests) * 100).toFixed(1) : 0

  // Report to GitHub Actions (if running in CI)
  if (process.env.GITHUB_ACTIONS) {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY
    if (summaryFile) {
      fs.appendFileSync(
        summaryFile,
        `
## Flaky Test Detection

- **Flaky Tests**: ${flaky.length} / ${totalTests} (${flakyPercent}%)
- **New Issues**: ${newFlaky.length}
- **Quarantined**: ${flaky.length - newFlaky.length}

${report}
`
      )
    }
  }

  // Exit code
  if (newFlaky.length > 0) {
    console.log(`\n❌ FLAKY TEST CHECK FAILED: ${newFlaky.length} new flaky test(s) detected`)
    process.exit(1)
  } else if (flakyPercent >= 2) {
    console.log(`\n⚠️  FLAKY RATE HIGH: ${flakyPercent}% (limit: 2%)`)
    process.exit(0) // Warn but don't fail; quarantined tests are expected
  } else {
    console.log('\n✅ FLAKY TEST CHECK PASSED')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
