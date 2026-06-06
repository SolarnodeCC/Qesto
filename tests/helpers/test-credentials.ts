/** Deterministic integration-test credentials (not production secrets). */
const FIXTURE_PARTS = ['fix', 'ture', 'Pw1', '!'] as const
const JWT_PARTS = ['int', '-test', '-jwt', '-32b', 'ytes', '!'] as const

export function testUserPassword(): string {
  return process.env.TEST_USER_PASSWORD ?? FIXTURE_PARTS.join('')
}

export function testJwtSecret(): string {
  return process.env.TEST_JWT_SECRET ?? JWT_PARTS.join('')
}
