#!/usr/bin/env node
/**
 * measure-coverage.mjs
 * Reads vitest JSON coverage report and validates against category-specific thresholds.
 * Exits with code 1 if any threshold is violated.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const COVERAGE_FILE = path.join(PROJECT_ROOT, 'coverage/coverage-final.json')

// Category thresholds
const CATEGORY_THRESHOLDS = {
  'Auth': {
    pattern: /functions\/api\/routes\/auth\.ts$/,
    lines: 90,
    functions: 90,
    branches: 85,
    statements: 90,
  },
  'Billing': {
    pattern: /functions\/api\/routes\/billing\.ts$/,
    lines: 85,
    functions: 85,
    branches: 75,
    statements: 85,
  },
  'Sessions': {
    pattern: /functions\/api\/routes\/sessions\.ts$/,
    lines: 85,
    functions: 85,
    branches: 75,
    statements: 85,
  },
  'WebSocket/DO': {
    pattern: /SessionRoom\.ts$/,
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80,
  },
  'Integration': {
    pattern: /functions\/api\/middleware\/|functions\/api\/lib\//,
    lines: 85,
    functions: 85,
    branches: 75,
    statements: 85,
  },
}

// Overall fallback thresholds
const OVERALL_THRESHOLDS = {
  lines: 85,
  functions: 85,
  branches: 75,
  statements: 85,
}

/**
 * Calculate coverage percentage from count object
 */
function calculatePercent(item) {
  if (!item) return 0
  const total = item.total || (item.covered ?? 0) + (item.skipped ?? 0)
  return total === 0 ? 100 : Math.round((item.covered / total) * 100)
}

/**
 * Categorize a file path
 */
function categorizeFile(filePath) {
  for (const [category, config] of Object.entries(CATEGORY_THRESHOLDS)) {
    if (config.pattern.test(filePath)) {
      return category
    }
  }
  return 'Other'
}

/**
 * Check if coverage meets threshold
 */
function checkThreshold(actual, threshold, metric) {
  if (actual < threshold) {
    return {
      pass: false,
      actual,
      threshold,
      metric,
      gap: threshold - actual,
    }
  }
  return { pass: true }
}

/**
 * Main
 */
async function main() {
  // Check if coverage file exists
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error(`\n❌ Coverage report not found at ${COVERAGE_FILE}`)
    console.error('   Run: npm run test:coverage first')
    process.exit(1)
  }

  // Read coverage data
  let coverageData
  try {
    const raw = fs.readFileSync(COVERAGE_FILE, 'utf8')
    coverageData = JSON.parse(raw)
  } catch (err) {
    console.error(`\n❌ Failed to parse coverage report: ${err.message}`)
    process.exit(1)
  }

  console.log('\n' + '='.repeat(70))
  console.log('COVERAGE REPORT BY CATEGORY')
  console.log('='.repeat(70))

  const categorized = {}
  let hasFailures = false

  // Organize by category
  for (const [filePath, fileCoverage] of Object.entries(coverageData)) {
    const category = categorizeFile(filePath)
    if (!categorized[category]) {
      categorized[category] = []
    }
    categorized[category].push({ filePath, ...fileCoverage })
  }

  // Report by category
  for (const [category, config] of Object.entries(CATEGORY_THRESHOLDS)) {
    const files = categorized[category] || []
    if (files.length === 0) continue

    console.log(`\n📊 ${category}`)
    console.log('-'.repeat(70))

    let categoryLines = { covered: 0, total: 0 }
    let categoryFunctions = { covered: 0, total: 0 }
    let categoryBranches = { covered: 0, total: 0 }
    let categoryStatements = { covered: 0, total: 0 }

    for (const file of files) {
      // Accumulate totals
      if (file.lines) {
        categoryLines.covered += file.lines.covered
        categoryLines.total += file.lines.covered + (file.lines.skipped || 0)
      }
      if (file.functions) {
        categoryFunctions.covered += file.functions.covered
        categoryFunctions.total += file.functions.covered + (file.functions.skipped || 0)
      }
      if (file.branches) {
        categoryBranches.covered += file.branches.covered
        categoryBranches.total += file.branches.covered + (file.branches.skipped || 0)
      }
      if (file.statements) {
        categoryStatements.covered += file.statements.covered
        categoryStatements.total += file.statements.covered + (file.statements.skipped || 0)
      }
    }

    // Calculate percentages
    const linesPct = categoryLines.total === 0 ? 100 : Math.round((categoryLines.covered / categoryLines.total) * 100)
    const functionsPct = categoryFunctions.total === 0 ? 100 : Math.round((categoryFunctions.covered / categoryFunctions.total) * 100)
    const branchesPct = categoryBranches.total === 0 ? 100 : Math.round((categoryBranches.covered / categoryBranches.total) * 100)
    const statementsPct = categoryStatements.total === 0 ? 100 : Math.round((categoryStatements.covered / categoryStatements.total) * 100)

    // Check thresholds
    const linesFail = checkThreshold(linesPct, config.lines, 'lines')
    const functionsFail = checkThreshold(functionsPct, config.functions, 'functions')
    const branchesFail = checkThreshold(branchesPct, config.branches, 'branches')
    const statementsFail = checkThreshold(statementsPct, config.statements, 'statements')

    const categoryFailed = !linesFail.pass || !functionsFail.pass || !branchesFail.pass || !statementsFail.pass

    console.log(
      `  Lines:      ${linesPct}% ${linesFail.pass ? '✓' : `❌ (target ${config.lines}%)`}`
    )
    console.log(
      `  Functions:  ${functionsPct}% ${functionsFail.pass ? '✓' : `❌ (target ${config.functions}%)`}`
    )
    console.log(
      `  Branches:   ${branchesPct}% ${branchesFail.pass ? '✓' : `❌ (target ${config.branches}%)`}`
    )
    console.log(
      `  Statements: ${statementsPct}% ${statementsFail.pass ? '✓' : `❌ (target ${config.statements}%)`}`
    )

    if (categoryFailed) {
      hasFailures = true
    }

    // Show failing files
    if (categoryFailed) {
      console.log('\n  Files below threshold:')
      for (const file of files) {
        const filePath = file.filePath.replace(PROJECT_ROOT, '.')
        const linePct = file.lines?.total === 0 ? 100 : Math.round((file.lines?.covered / (file.lines?.total || 1)) * 100)
        const funcPct = file.functions?.total === 0 ? 100 : Math.round((file.functions?.covered / (file.functions?.total || 1)) * 100)

        if (linePct < config.lines || funcPct < config.functions) {
          console.log(`    ${filePath}: ${linePct}% lines, ${funcPct}% functions`)
        }
      }
    }
  }

  // Overall summary
  console.log('\n' + '='.repeat(70))
  console.log('OVERALL SUMMARY')
  console.log('='.repeat(70))

  let totalLines = { covered: 0, total: 0 }
  let totalFunctions = { covered: 0, total: 0 }
  let totalBranches = { covered: 0, total: 0 }
  let totalStatements = { covered: 0, total: 0 }

  for (const fileCoverage of Object.values(coverageData)) {
    if (fileCoverage.lines) {
      totalLines.covered += fileCoverage.lines.covered
      totalLines.total += fileCoverage.lines.covered + (fileCoverage.lines.skipped || 0)
    }
    if (fileCoverage.functions) {
      totalFunctions.covered += fileCoverage.functions.covered
      totalFunctions.total += fileCoverage.functions.covered + (fileCoverage.functions.skipped || 0)
    }
    if (fileCoverage.branches) {
      totalBranches.covered += fileCoverage.branches.covered
      totalBranches.total += fileCoverage.branches.covered + (fileCoverage.branches.skipped || 0)
    }
    if (fileCoverage.statements) {
      totalStatements.covered += fileCoverage.statements.covered
      totalStatements.total += fileCoverage.statements.covered + (fileCoverage.statements.skipped || 0)
    }
  }

  const totalLinesPct = totalLines.total === 0 ? 100 : Math.round((totalLines.covered / totalLines.total) * 100)
  const totalFunctionsPct = totalFunctions.total === 0 ? 100 : Math.round((totalFunctions.covered / totalFunctions.total) * 100)
  const totalBranchesPct = totalBranches.total === 0 ? 100 : Math.round((totalBranches.covered / totalBranches.total) * 100)
  const totalStatementsPct = totalStatements.total === 0 ? 100 : Math.round((totalStatements.covered / totalStatements.total) * 100)

  const overallLinesFail = checkThreshold(totalLinesPct, OVERALL_THRESHOLDS.lines, 'lines')
  const overallFunctionsFail = checkThreshold(totalFunctionsPct, OVERALL_THRESHOLDS.functions, 'functions')
  const overallBranchesFail = checkThreshold(totalBranchesPct, OVERALL_THRESHOLDS.branches, 'branches')
  const overallStatementsFail = checkThreshold(totalStatementsPct, OVERALL_THRESHOLDS.statements, 'statements')

  const overallFailed = !overallLinesFail.pass || !overallFunctionsFail.pass || !overallBranchesFail.pass || !overallStatementsFail.pass

  console.log(
    `Lines:       ${totalLinesPct}% ${overallLinesFail.pass ? '✓' : `❌ (target ${OVERALL_THRESHOLDS.lines}%)`}`
  )
  console.log(
    `Functions:   ${totalFunctionsPct}% ${overallFunctionsFail.pass ? '✓' : `❌ (target ${OVERALL_THRESHOLDS.functions}%)`}`
  )
  console.log(
    `Branches:    ${totalBranchesPct}% ${overallBranchesFail.pass ? '✓' : `❌ (target ${OVERALL_THRESHOLDS.branches}%)`}`
  )
  console.log(
    `Statements:  ${totalStatementsPct}% ${overallStatementsFail.pass ? '✓' : `❌ (target ${OVERALL_THRESHOLDS.statements}%)`}`
  )

  console.log('='.repeat(70) + '\n')

  if (hasFailures || overallFailed) {
    console.log('❌ COVERAGE GATE FAILED')
    console.log('\nTo view detailed coverage report: open tests/artifacts/coverage/index.html')
    process.exit(1)
  } else {
    console.log('✅ COVERAGE GATE PASSED')
    console.log('\nDetailed report: coverage/index.html')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
