// Calendar — planned topics the Content Engine cron (Tue/Thu/Sat 06:00 UTC)
// picks up. One row = one platform (LinkedIn or YouTube).

import { useState } from 'react'
import { useCalendar, type CalendarItem, type ContentItemPlatform } from '../../hooks/useMarketingApi'
import { Heading, Body, Card, Button, TextInput, EmptyState, SkeletonCard } from '../../ui/components'

function StatusBadge({ status }: { status: CalendarItem['status'] }) {
  const styles: Record<CalendarItem['status'], string> = {
    planned: 'bg-pulse-100 text-pulse-600',
    generated: 'bg-blue-100 text-blue-700',
    skipped: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  )
}

function dateTimeLocalToMs(value: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

function msToDateTimeLocal(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function NewCalendarItemForm({ onCreate }: { onCreate: ReturnType<typeof useCalendar>['create'] }) {
  const [platform, setPlatform] = useState<ContentItemPlatform>('linkedin')
  const [topic, setTopic] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const ms = dateTimeLocalToMs(scheduledFor)
    if (!topic.trim() || !ms) {
      setErr('Topic and scheduled date/time are required')
      return
    }
    setSaving(true)
    setErr(null)
    const trimmedNotes = notes.trim()
    const res = await onCreate({
      platform,
      topic: topic.trim(),
      scheduled_for: ms,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    })
    setSaving(false)
    if (!res.ok) {
      setErr(res.error.message)
      return
    }
    setTopic('')
    setScheduledFor('')
    setNotes('')
  }

  return (
    <Card className="space-y-3">
      <Heading level="s">Add planned topic</Heading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as ContentItemPlatform)}
          className="text-body-s border border-pulse-300 dark:border-[var(--color-border-strong)] rounded-md px-3 py-2 bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)]"
          aria-label="Platform"
        >
          <option value="linkedin">LinkedIn</option>
          <option value="youtube">YouTube</option>
        </select>
        <input
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
          className="text-body-s border border-pulse-300 dark:border-[var(--color-border-strong)] rounded-md px-3 py-2 bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)]"
          aria-label="Scheduled for"
        />
      </div>
      <TextInput hintText="Topic" value={topic} onChange={setTopic} />
      <TextInput hintText="Notes (optional)" value={notes} onChange={setNotes} />
      {err && <Body size="s" className="text-signal-error">{err}</Body>}
      <Button size="sm" variant="primary" disabled={saving} onClick={submit}>
        {saving ? 'Adding…' : 'Add to calendar'}
      </Button>
    </Card>
  )
}

function CalendarItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: CalendarItem
  onUpdate: ReturnType<typeof useCalendar>['update']
  onRemove: ReturnType<typeof useCalendar>['remove']
}) {
  const [editing, setEditing] = useState(false)
  const [topic, setTopic] = useState(item.topic)
  const [scheduledFor, setScheduledFor] = useState(msToDateTimeLocal(item.scheduled_for))
  const [notes, setNotes] = useState(item.notes ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    const ms = dateTimeLocalToMs(scheduledFor)
    setBusy(true)
    await onUpdate(item.id, { topic, ...(ms ? { scheduled_for: ms } : {}), notes: notes || null })
    setBusy(false)
    setEditing(false)
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 capitalize">
            {item.platform}
          </span>
          <StatusBadge status={item.status} />
        </div>
        <span className="text-xs text-pulse-500 dark:text-[var(--text-muted)]">
          {new Date(item.scheduled_for).toLocaleString()}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <TextInput value={topic} onChange={setTopic} />
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full text-body-s border border-pulse-300 dark:border-[var(--color-border-strong)] rounded-md px-3 py-2 bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)]"
          />
          <TextInput value={notes} onChange={setNotes} hintText="Notes" />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={busy} onClick={save}>Save</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <Body size="s">{item.topic}</Body>
          {item.notes && <Body size="s" className="text-pulse-500 dark:text-[var(--text-muted)]">{item.notes}</Body>}
          {item.status === 'planned' && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await onRemove(item.id)
                  setBusy(false)
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default function CalendarTab() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { items, loading, error, create, update, remove } = useCalendar(statusFilter ? { status: statusFilter } : {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Calendar</Heading>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-body-s border border-pulse-300 dark:border-[var(--color-border-strong)] rounded-md px-3 py-1.5 bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)]"
          aria-label="Filter by status"
        >
          <option value="">All</option>
          <option value="planned">Planned</option>
          <option value="generated">Generated</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      <NewCalendarItemForm onCreate={create} />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="h-28" />
          ))}
        </div>
      ) : error ? (
        <Body className="text-signal-error">{error}</Body>
      ) : items.length === 0 ? (
        <EmptyState title="No calendar items" description="Add a planned topic above." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <CalendarItemRow key={item.id} item={item} onUpdate={update} onRemove={remove} />
          ))}
        </div>
      )}
    </div>
  )
}
