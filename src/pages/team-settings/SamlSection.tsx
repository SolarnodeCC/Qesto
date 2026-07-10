import { inputHint } from '../../ui/input-hint'
import type { Feedback } from './types'

interface Props {
  samlEntityId: string
  setSamlEntityId: (v: string) => void
  samlSsoUrl: string
  setSamlSsoUrl: (v: string) => void
  samlSaving: boolean
  samlFeedback: Feedback | null
  samlConfigLabel: string
  onSave: (e: React.FormEvent) => void
}

export function SamlSection({
  samlEntityId,
  setSamlEntityId,
  samlSsoUrl,
  setSamlSsoUrl,
  samlSaving,
  samlFeedback,
  samlConfigLabel,
  onSave,
}: Props) {
  return (
    <section aria-labelledby="section-saml" className="space-y-4 rounded-xl border border-pulse-200 p-8">
      <h2 id="section-saml" className="text-lg font-semibold">{samlConfigLabel}</h2>
      <p className="text-sm text-pulse-500">
        Configure single sign-on via SAML 2.0. Contact your identity provider for these values.
      </p>
      <form onSubmit={(e) => void onSave(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="saml-entity-id" className="text-sm font-medium">
            Entity ID
          </label>
          <input
            id="saml-entity-id"
            type="text"
            value={samlEntityId}
            onChange={(e) => setSamlEntityId(e.target.value)}
            {...inputHint("https://your-idp.example.com/metadata")}
            maxLength={512}
            disabled={samlSaving}
            className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 font-mono text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="saml-sso-url" className="text-sm font-medium">
            IdP Metadata URL (SSO endpoint)
          </label>
          <input
            id="saml-sso-url"
            type="url"
            value={samlSsoUrl}
            onChange={(e) => setSamlSsoUrl(e.target.value)}
            {...inputHint("https://your-idp.example.com/sso")}
            maxLength={1024}
            disabled={samlSaving}
            className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 font-mono text-sm"
          />
        </div>
        {samlFeedback ? (
          <p
            role="alert"
            aria-live="polite"
            className={`text-sm ${samlFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
          >
            {samlFeedback.msg}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={samlSaving || !samlEntityId.trim() || !samlSsoUrl.trim()}
          className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          {samlSaving ? 'Saving…' : 'Save SAML configuration'}
        </button>
      </form>
    </section>
  )
}
