// Marketing Review Dashboard — internal, single-owner tool gated client-side by
// VITE_SUPERUSER_EMAIL (mirrors AdminDashboard.tsx; real enforcement is the
// server-side marketingOwnerMiddleware on every /api/marketing/* route).

import { useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Calendar, FileText, KeyRound, MessageSquare, Video } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import AppShellLayout from '../layouts/AppShellLayout'
import { Heading, Body } from '../ui/components'
import ContentQueueTab from '../components/marketing/ContentQueueTab'
import TokenHealthTab from '../components/marketing/TokenHealthTab'
import MentionsFeedTab from '../components/marketing/MentionsFeedTab'
import CalendarTab from '../components/marketing/CalendarTab'
import VideoLibraryTab from '../components/marketing/VideoLibraryTab'

const SUPERUSER_EMAIL = (import.meta.env.VITE_SUPERUSER_EMAIL as string | undefined) ?? ''

type MarketingTab = 'content' | 'tokens' | 'mentions' | 'calendar' | 'videos'

const TAB_CONFIG: Array<{ id: MarketingTab; label: string; icon: ReactNode }> = [
  { id: 'content', label: 'Content Queue', icon: <FileText size={16} aria-hidden="true" /> },
  { id: 'tokens', label: 'Token Health', icon: <KeyRound size={16} aria-hidden="true" /> },
  { id: 'mentions', label: 'Mentions Feed', icon: <MessageSquare size={16} aria-hidden="true" /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar size={16} aria-hidden="true" /> },
  { id: 'videos', label: 'Video Library', icon: <Video size={16} aria-hidden="true" /> },
]

export default function MarketingDashboard() {
  const auth = useAuth()
  const [activeTab, setActiveTab] = useState<MarketingTab>('content')

  if (auth.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-8 w-48 rounded-lg bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
      </div>
    )
  }

  if (auth.status === 'anonymous') return <Navigate to="/login" replace />
  if (auth.user.email !== SUPERUSER_EMAIL) return <Navigate to="/dashboard" replace />

  return (
    <AppShellLayout activeSection="home" onSectionChange={() => undefined} isSuperuser>
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 animate-page-enter space-y-6">
        <header>
          <Heading level="l">Marketing Review Dashboard</Heading>
          <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] mt-2">
            Content Engine, Mention Monitor, and Video Asset Library — review queue
          </Body>
        </header>

        <div
          role="tablist"
          aria-label="Marketing sections"
          className="flex flex-wrap gap-1 rounded-xl bg-pulse-100 dark:bg-[#0F1526] p-1 w-full sm:w-auto overflow-x-auto"
        >
          {TAB_CONFIG.map(({ id, label, icon }) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-controls={`tabpanel-${id}`}
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg min-h-[44px] transition-all duration-150 shrink-0',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
                activeTab === id
                  ? 'bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] shadow-sm'
                  : 'text-pulse-500 dark:text-[#8A96B0] hover:text-pulse-800 dark:hover:text-[#A8B3CC]',
              ].join(' ')}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'content' && (
          <div role="tabpanel" id="tabpanel-content" aria-labelledby="tab-content">
            <ContentQueueTab />
          </div>
        )}
        {activeTab === 'tokens' && (
          <div role="tabpanel" id="tabpanel-tokens" aria-labelledby="tab-tokens">
            <TokenHealthTab />
          </div>
        )}
        {activeTab === 'mentions' && (
          <div role="tabpanel" id="tabpanel-mentions" aria-labelledby="tab-mentions">
            <MentionsFeedTab />
          </div>
        )}
        {activeTab === 'calendar' && (
          <div role="tabpanel" id="tabpanel-calendar" aria-labelledby="tab-calendar">
            <CalendarTab />
          </div>
        )}
        {activeTab === 'videos' && (
          <div role="tabpanel" id="tabpanel-videos" aria-labelledby="tab-videos">
            <VideoLibraryTab />
          </div>
        )}
      </div>
    </AppShellLayout>
  )
}
