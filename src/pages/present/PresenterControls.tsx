import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Eye, EyeOff, Link2, Pause, Play, Shuffle, Sparkles, Subtitles, Timer } from 'lucide-react'
import type { SoftTimer } from './useSoftTimer'
import { CanvasThemePicker } from '../../components/CanvasThemePicker'
import { useT } from '../../i18n'
import type { CaptionLocale } from '../../components/CaptionsLocalePicker'

export interface PresenterControlsProps {
  id: string | undefined
  isLive: boolean
  isClosed: boolean
  closing: boolean
  closeError: string | null
  allDone: boolean
  questionIndex: number
  questionKind: string | undefined
  sessionCode: string | undefined
  hasSession: boolean
  localPaused: boolean
  hideTally: boolean
  hideSentiment: boolean
  baseOptionsLength: number
  minGate: number
  timerInput: string
  timer: SoftTimer
  copied: boolean
  onBack: () => void
  onAdvance: () => void
  onClose: () => void
  onTogglePause: () => void
  onToggleHideTally: () => void
  onToggleHideSentiment: () => void
  onShuffle: () => void
  onMinGateChange: (value: number) => void
  onTimerInputChange: (value: string) => void
  onStartTimer: () => void
  onCopyDisplayLink: () => void
  /** Captions — FE-CAPTIONS-OVERLAY-01 */
  captionsActive: boolean
  captionsPlanGated: boolean
  onToggleCaptions: () => void
  captionLocale: CaptionLocale
  onCaptionLocaleChange: (locale: CaptionLocale) => void
}

export function PresenterControls({
  id,
  isLive,
  isClosed,
  closing,
  closeError,
  allDone,
  questionIndex,
  questionKind,
  sessionCode,
  hasSession,
  localPaused,
  hideTally,
  hideSentiment,
  baseOptionsLength,
  minGate,
  timerInput,
  timer,
  copied,
  onBack,
  onAdvance,
  onClose,
  onTogglePause,
  onToggleHideTally,
  onToggleHideSentiment,
  onShuffle,
  onMinGateChange,
  onTimerInputChange,
  onStartTimer,
  onCopyDisplayLink,
  captionsActive,
  captionsPlanGated,
  onToggleCaptions,
  captionLocale,
  onCaptionLocaleChange,
}: PresenterControlsProps) {
  const t = useT('captions')
  return (
    <div className="bg-pulse-900 border-t border-pulse-700 px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white shrink-0">

      {/* Back / Next question / Close session */}
      <button
        type="button"
        onClick={() => onBack()}
        disabled={!isLive || allDone || questionIndex === 0}
        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40 bg-pulse-700 text-white hover:bg-pulse-600"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Back
      </button>
      <button
        type="button"
        onClick={() => onAdvance()}
        disabled={!isLive || allDone}
        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40 bg-teal-600 text-white hover:bg-teal-700"
      >
        <ChevronRight size={14} aria-hidden="true" />
        Next question
      </button>
      <button
        type="button"
        onClick={onClose}
        disabled={closing || isClosed}
        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40 bg-pulse-700 text-white hover:bg-red-700"
      >
        {isClosed ? 'Session closed' : closing ? 'Closing…' : 'Close session'}
      </button>
      {closeError && <span className="text-xs text-red-400">{closeError}</span>}
      {id && isClosed && (
        <Link to={`/sessions/${id}/results`} className="text-xs text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded">
          View results →
        </Link>
      )}

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Pause / Resume */}
      <button
        type="button"
        onClick={onTogglePause}
        disabled={!isLive || allDone}
        aria-pressed={localPaused}
        className={[
          'inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40',
          localPaused ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-pulse-700 text-white hover:bg-pulse-600',
        ].join(' ')}
      >
        {localPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        {localPaused ? 'Resume' : 'Pause'}
      </button>

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Hide tally live */}
      <button
        type="button"
        onClick={onToggleHideTally}
        aria-pressed={hideTally}
        className={[
          'inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
          hideTally ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-pulse-700 text-white hover:bg-pulse-600',
        ].join(' ')}
      >
        {hideTally ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
        {hideTally ? 'Tally hidden' : 'Hide tally'}
      </button>

      {/* Show sentiment (default off) */}
      {questionKind === 'open' && (
        <button
          type="button"
          onClick={onToggleHideSentiment}
          aria-pressed={!hideSentiment}
          className={[
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
            !hideSentiment ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-pulse-700 text-white hover:bg-pulse-600',
          ].join(' ')}
          title="Show or hide AI sentiment analysis"
        >
          <Sparkles size={14} aria-hidden="true" />
          {!hideSentiment ? 'Sentiment shown' : 'Show sentiment'}
        </button>
      )}

      {/* Option shuffle */}
      <button
        type="button"
        onClick={onShuffle}
        disabled={baseOptionsLength < 2 || allDone}
        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] bg-pulse-700 text-white hover:bg-pulse-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40"
      >
        <Shuffle size={14} aria-hidden="true" />
        Shuffle options
      </button>

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Minimum tally gate */}
      <label className="flex items-center gap-2 text-pulse-300">
        Min. votes to show tally
        <input
          type="number"
          min={0}
          max={999}
          value={minGate}
          onChange={(e) => onMinGateChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
          className="w-14 rounded border border-pulse-600 bg-pulse-800 text-white text-center px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          aria-label="Minimum votes required before tally is shown"
        />
      </label>

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Soft timer */}
      <div className="flex items-center gap-2">
        <Timer size={14} className="text-pulse-400" aria-hidden="true" />
        <label className="text-pulse-300 flex items-center gap-1.5">
          Timer
          <input
            type="number"
            min={1}
            max={10}
            value={timerInput}
            onChange={(e) => onTimerInputChange(e.target.value)}
            disabled={timer.running}
            className="w-12 rounded border border-pulse-600 bg-pulse-800 text-white text-center px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-40"
            aria-label="Timer duration in minutes"
          />
          min
        </label>
        {timer.running ? (
          <button
            type="button"
            onClick={timer.stop}
            className="rounded px-2.5 py-1.5 text-xs font-medium min-h-[36px] bg-red-600 text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartTimer}
            disabled={isClosed}
            className="rounded px-2.5 py-1.5 text-xs font-medium min-h-[36px] bg-pulse-700 text-white hover:bg-pulse-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40"
          >
            Start
          </button>
        )}
        {timer.running && (
          <span className="tabular-nums text-teal-400 font-mono text-sm">
            {Math.floor(timer.remaining / 60)}:{String(timer.remaining % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* One-click export */}
      {hasSession && (
        <button
          type="button"
          onClick={onCopyDisplayLink}
          disabled={!sessionCode}
          title="Copy display URL to embed in PowerPoint"
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] bg-pulse-700 text-white hover:bg-pulse-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40"
        >
          <Link2 size={14} aria-hidden="true" />
          {copied ? 'Copied!' : 'Display link'}
        </button>
      )}
      {id && (
        <a
          href={`/api/sessions/${encodeURIComponent(id)}/export.csv`}
          download
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] bg-pulse-700 text-white hover:bg-pulse-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <Download size={14} aria-hidden="true" />
          Export CSV
        </a>
      )}

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Live captions toggle — FE-CAPTIONS-OVERLAY-01 */}
      {captionsPlanGated ? (
        <span
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] bg-pulse-700 text-pulse-400 cursor-not-allowed text-sm"
          title={t('captions_plan_gate')}
        >
          <Subtitles size={14} aria-hidden="true" />
          {t('captions_inactive')}
          <span className="ml-1 text-xs text-amber-400">(Chorus)</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={onToggleCaptions}
          disabled={!isLive || allDone}
          aria-pressed={captionsActive}
          title={captionsActive ? t('stop_captions') : t('start_captions')}
          className={[
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40',
            captionsActive
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-pulse-700 text-white hover:bg-pulse-600',
          ].join(' ')}
        >
          <Subtitles size={14} aria-hidden="true" />
          {captionsActive ? t('captions_active') : t('captions_inactive')}
        </button>
      )}

      {/* Caption locale picker — only shown when captions are active */}
      {captionsActive && !captionsPlanGated && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-pulse-300 shrink-0">{t('locale_picker_label')}</span>
          <select
            value={captionLocale}
            onChange={(e) => onCaptionLocaleChange(e.target.value as CaptionLocale)}
            className="rounded border border-pulse-600 bg-pulse-800 text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[36px]"
            aria-label={t('locale_picker_label')}
          >
            <option value="off">{t('locale_off')}</option>
            <option value="en">{t('locale_en')}</option>
            <option value="nl">{t('locale_nl')}</option>
            <option value="es">{t('locale_es')}</option>
            <option value="de">{t('locale_de')}</option>
            <option value="fr">{t('locale_fr')}</option>
          </select>
        </label>
      )}

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Canvas theme picker — CANVAS-THEME-01 */}
      <CanvasThemePicker variant="bar" />

      <span className="w-px h-5 bg-pulse-700 ml-auto" aria-hidden="true" />

      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] bg-pulse-700 text-white hover:bg-pulse-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        ← Dashboard
      </Link>
    </div>
  )
}
