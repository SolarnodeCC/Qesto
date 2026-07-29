import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const frontendPort = process.env.E2E_FRONTEND_PORT ?? '8788'

const services = [
  {
    name: 'api',
    command: resolve('node_modules/.bin/wrangler'),
    args: [
      'dev',
      '--port',
      '8787',
      '--local',
      '--var',
      'JWT_SECRET:dev-secret',
      '--var',
      'ENVIRONMENT:development',
      '--var',
      `APP_URL:http://localhost:${frontendPort}`,
      '--no-show-interactive-dev-session',
    ],
  },
  {
    name: 'frontend',
    command: resolve('node_modules/.bin/vite'),
    args: ['--host', '127.0.0.1', '--port', frontendPort, '--strictPort'],
  },
]

const children = new Map()
let shuttingDown = false
let requestedExitCode = 0

function shutdown(signal, exitCode) {
  requestedExitCode = Math.max(requestedExitCode, exitCode)
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children.values()) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal)
  }
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
  children.set(service.name, child)

  child.on('error', () => shutdown('SIGTERM', 1))
  child.on('exit', (code, signal) => {
    if (!shuttingDown) shutdown('SIGTERM', code ?? 1)
    if ([...children.values()].every((process) => process.exitCode !== null || process.signalCode !== null)) {
      process.exit(requestedExitCode)
    }
  })
}

process.on('SIGINT', () => shutdown('SIGINT', 0))
process.on('SIGTERM', () => shutdown('SIGTERM', 0))
