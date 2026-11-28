// Root error boundary. Without it any render error (or a lazy chunk that fails
// after the one-shot reload guard in main.tsx) unmounted the whole tree: a
// white screen with no way back and no report. Now the user gets a recoverable
// screen and the crash is reported (src/lib/report-client-error.ts).
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { reportClientError } from '../lib/report-client-error'
import { Button } from '../ui/components'

type Props = { children: ReactNode }
type State = { error: Error | null }

function isChunkError(err: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    `${err.name} ${err.message}`,
  )
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    reportClientError(isChunkError(error) ? 'chunk' : 'render', error)
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    const chunk = isChunkError(this.state.error)
    return (
      <main
        role="alert"
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'var(--color-bg)', color: 'var(--text-primary)' }}
      >
        <div className="max-w-md w-full rounded-xl p-8 text-center shadow-elevated" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <AlertTriangle aria-hidden="true" className="mx-auto mb-4 h-10 w-10" />
          <h1 className="text-xl font-semibold mb-2">
            {chunk ? 'A new version of Qesto is available' : 'Something went wrong'}
          </h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            {chunk
              ? 'Reload the page to continue.'
              : 'The problem has been reported. Reloading usually fixes it; your live session keeps running.'}
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCw aria-hidden="true" className="h-4 w-4" />
            Reload
          </Button>
        </div>
      </main>
    )
  }
}
