// Global Vitest setup.
//
// Most of this suite runs in the `node` environment, where React Testing
// Library and jest-dom cannot load. Everything here is therefore guarded on a
// real DOM being present, so the file is a no-op for the ~300 node-env test
// files and only arms the component lane (tests/component/**, which runs in
// jsdom via environmentMatchGlobs in vite.config.ts).
import { afterEach } from 'vitest'

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
  const { cleanup } = await import('@testing-library/react')
  // Without this, components from one test stay mounted into the next and
  // queries match stale nodes.
  afterEach(() => cleanup())
}
