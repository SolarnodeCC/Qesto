/**
 * TOWNHALL-SCALE-PROOF-50K-01 — k6 smoke for townhall moderation path (Sprint 84).
 * Full 50k concurrent voter proof is a staging gate; run with dedicated infra:
 *   k6 run tests/load/townhall-moderation-smoke.js -e BASE_URL=https://staging.qesto.cc
 *
 * This smoke validates scale-proof metadata and health endpoints before the 50k gate.
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.BASE_URL || 'http://localhost:8787'

export const options = {
  vus: 20,
  duration: '45s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
}

export default function () {
  const health = http.get(`${baseUrl}/api/admin/health`)
  check(health, { 'health ok': (r) => r.status === 200 })

  const scale = http.get(`${baseUrl}/api/platform/scale-proof`)
  check(scale, {
    'scale proof ok': (r) => r.status === 200,
    '50k gate documented': (r) => {
      try {
        const body = JSON.parse(r.body)
        const milestones = body?.data?.milestones ?? []
        return milestones.some((m) => m.voters === 50_000)
      } catch {
        return false
      }
    },
  })

  sleep(0.5)
}
