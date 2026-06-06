import type { Feedback } from './types'

interface Props {
  teamName: string
  setTeamName: (v: string) => void
  nameSaving: boolean
  nameFeedback: Feedback | null
  isOwner: boolean
  savedName: string
  onSave: (e: React.FormEvent) => void
}

export function GeneralSection({
  teamName,
  setTeamName,
  nameSaving,
  nameFeedback,
  isOwner,
  savedName,
  onSave,
}: Props) {
  return (
    <section aria-labelledby="section-general" className="space-y-4 rounded-xl border border-pulse-200 p-6">
      <h2 id="section-general" className="text-lg font-semibold">General</h2>
      <form onSubmit={(e) => void onSave(e)} className="flex flex-col gap-3">
        <label htmlFor="team-name" className="text-sm font-medium">
          Team name
        </label>
        <input
          id="team-name"
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={100}
          disabled={!isOwner || nameSaving}
          className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 disabled:text-pulse-500"
        />
        {nameFeedback ? (
          <p
            role="alert"
            className={`text-sm ${nameFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
          >
            {nameFeedback.msg}
          </p>
        ) : null}
        {isOwner && (
          <button
            type="submit"
            disabled={nameSaving || teamName.trim() === savedName || teamName.trim().length === 0}
            className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            {nameSaving ? 'Saving…' : 'Save name'}
          </button>
        )}
      </form>
    </section>
  )
}
