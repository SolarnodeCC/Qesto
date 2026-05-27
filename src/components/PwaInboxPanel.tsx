/**
 * PWA3-INBOX-01 — offline inbox placeholder for background-sync sprint slice.
 */
export function PwaInboxPanel() {
  return (
    <section className="rounded-lg border border-pulse-200 dark:border-pulse-700 p-4" aria-label="Inbox">
      <h2 className="text-sm font-semibold text-pulse-800 dark:text-[#F0F2F8]">Inbox</h2>
      <p className="mt-1 text-xs text-pulse-500">No pending offline actions. Background sync runs when online.</p>
    </section>
  )
}
