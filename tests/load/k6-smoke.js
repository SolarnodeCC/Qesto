/**
 * LOAD-FRAMEWORK-71 — k6 smoke harness (S71).
 * Run: k6 run tests/load/k6-smoke.js -e BASE_URL=http://localhost:8787
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.BASE_URL || 'http://localhost:8787'

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<500'],
  },
}

export default function () {
  const health = http.get(`${baseUrl}/api/admin/health`)
  check(health, { 'health ok': (r) => r.status === 200 })

  const version = http.get(`${baseUrl}/api/platform/version`)
  check(version, { 'platform version': (r) => r.status === 200 })

  const scale = http.get(`${baseUrl}/api/platform/scale-proof`)
  check(scale, { 'scale proof': (r) => r.status === 200 })

  sleep(1)
}
