import type { ReactNode } from 'react'

export type DocTocItem = { id: string; label: string }

export function DocTocMobile({
  items,
  heading = 'On this page',
}: {
  items: DocTocItem[]
  heading?: string
}): ReactNode {
  return (
    <div className="md:hidden mb-8">
      <label htmlFor="doc-toc-jump" className="block text-[13px] font-bold text-[var(--text-primary)] mb-2">
        {heading}
      </label>
      <select
        id="doc-toc-jump"
        className="w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--text-primary)] px-3 py-2.5 text-sm min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        defaultValue=""
        onChange={(e) => {
          const id = e.target.value
          if (!id) return
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          e.currentTarget.value = ''
        }}
      >
        <option value="" disabled>
          Jump to section…
        </option>
        {items.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function DocTocDesktop({
  items,
  heading = 'On this page',
}: {
  items: DocTocItem[]
  heading?: string
}): ReactNode {
  return (
    <aside className="hidden md:block sticky top-20 h-fit">
      <h5 className="text-[13px] font-bold text-[var(--text-primary)] mb-3">{heading}</h5>
      <ol className="space-y-1.5 list-decimal list-inside">
        {items.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="text-[13px] text-[var(--text-muted)] hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  )
}
