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

// Shared control button height — meets the 44px touch-target minimum (A11Y-TOUCH).
const CTRL = 'inline-flex items-center gap-1.5 rounded-lg px-3 min-h-[44px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40'

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
  const tp = useT('present')
  // Captions toggle is a disabled "coming soon" affordance until audio capture ships.
  void onToggleCaptions
  return (
    <div
      role="toolbar"
      aria-label={tp('ctrl.toolbar')}
      className="bg-pulse-900 border-t border-pulse-700 px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white shrink-0"
    >

      {/* Question navigation */}
      <div role="group" aria-label={tp('ctrl.group.navigation')} className="contents">
        <button
          type="button"
          onClick={() => onBack()}
          disabled={!isLive || allDone || questionIndex === 0}
          className={`${CTRL} bg-pulse-700 text-white hover:bg-pulse-600`}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {tp('ctrl.back')}
        </button>
        <button
          type="button"
          onClick={() => onAdvance()}
          disabled={!isLive || allDone}
          className={`${CTRL} bg-teal-600 text-white hover:bg-teal-700`}
        >
          <ChevronRight size={14} aria-hidden="true" />
          {tp('ctrl.next')}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={closing || isClosed}
          className={`${CTRL} bg-pulse-700 text-white hover:bg-red-700`}
        >
          {isClosed ? tp('ctrl.closed') : closing ? tp('ctrl.closing') : tp('ctrl.close')}
        </button>
        {closeError && <span className="text-xs text-red-400">{closeError}</span>}
        {id && isClosed && (
          <Link to={`/sessions/${id}/results`} className="text-xs text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg">
            {tp('ctrl.viewResults')}
          </Link>
        )}
      </div>

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Display options */}
      <div role="group" aria-label={tp('ctrl.group.display')} className="contents">
        <button
          type="button"
          onClick={onTogglePause}
          disabled={!isLive || allDone}
          aria-pressed={localPaused}
          className={`${CTRL} ${localPaused ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-pulse-700 text-white hover:bg-pulse-600'}`}
        >
          {localPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          {localPaused ? tp('ctrl.resume') : tp('ctrl.pause')}
        </button>

        <button
          type="button"
          onClick={onToggleHideTally}
          aria-pressed={hideTally}
          className={`${CTRL} ${hideTally ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-pulse-700 text-white hover:bg-pulse-600'}`}
        >
          {hideTally ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          {hideTally ? tp('ctrl.tallyHidden') : tp('ctrl.hideTally')}
        </button>

        {questionKind === 'open' && (
          <button
            type="button"
            onClick={onToggleHideSentiment}
            aria-pressed={!hideSentiment}
            className={`${CTRL} ${!hideSentiment ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-pulse-700 text-white hover:bg-pulse-600'}`}
            title={tp('ctrl.sentimentTitle')}
          >
            <Sparkles size={14} aria-hidden="true" />
            {!hideSentiment ? tp('ctrl.sentimentShown') : tp('ctrl.showSentiment')}
          </button>
        )}

        <button
          type="button"
          onClick={onShuffle}
          disabled={baseOptionsLength < 2 || allDone}
          className={`${CTRL} bg-pulse-700 text-white hover:bg-pulse-600`}
        >
          <Shuffle size={14} aria-hidden="true" />
          {tp('ctrl.shuffle')}
        </button>

        <label className="flex items-center gap-2 text-pulse-300">
          {tp('ctrl.minVotes')}
          <input
            type="number"
            min={0}
            max={999}
            value={minGate}
            onChange={(e) => onMinGateChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-16 rounded-lg border border-pulse-600 bg-pulse-800 text-white text-center px-1 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            aria-label={tp('ctrl.minVotesAria')}
          />
        </label>
      </div>

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Soft timer */}
      <div role="group" aria-label={tp('ctrl.group.timer')} className="flex items-center gap-2">
        <Timer size={14} className="text-pulse-400" aria-hidden="true" />
        <label className="text-pulse-300 flex items-center gap-1.5">
          {tp('ctrl.timer')}
          <input
            type="number"
            min={1}
            max={10}
            value={timerInput}
            onChange={(e) => onTimerInputChange(e.target.value)}
            disabled={timer.running}
            className="w-14 rounded-lg border border-pulse-600 bg-pulse-800 text-white text-center px-1 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-40"
            aria-label={tp('ctrl.timerAria')}
          />
          {tp('ctrl.min')}
        </label>
        {timer.running ? (
          <button
            type="button"
            onClick={timer.stop}
            className="rounded-lg px-2.5 text-xs font-medium min-h-[44px] bg-red-600 text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            {tp('ctrl.stop')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartTimer}
            disabled={isClosed}
            className="rounded-lg px-2.5 text-xs font-medium min-h-[44px] bg-pulse-700 text-white hover:bg-pulse-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40"
          >
            {tp('ctrl.start')}
          </button>
        )}
        {timer.running && (
          <span className="tabular-nums text-teal-400 font-mono text-sm">
            {Math.floor(timer.remaining / 60)}:{String(timer.remaining % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Share and export */}
      <div role="group" aria-label={tp('ctrl.group.export')} className="contents">
        {hasSession && (
          <button
            type="button"
            onClick={onCopyDisplayLink}
            disabled={!sessionCode}
            title={tp('ctrl.displayLinkTitle')}
            className={`${CTRL} bg-pulse-700 text-white hover:bg-pulse-600`}
          >
            <Link2 size={14} aria-hidden="true" />
            {copied ? tp('ctrl.copied') : tp('ctrl.displayLink')}
          </button>
        )}
        {id && (
          isClosed ? (
            <a
              href={`/api/sessions/${encodeURIComponent(id)}/export.csv`}
              download
              className={`${CTRL} bg-pulse-700 text-white hover:bg-pulse-600`}
            >
              <Download size={14} aria-hidden="true" />
              {tp('ctrl.exportCsv')}
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-3 min-h-[44px] font-medium bg-pulse-700 text-pulse-300 cursor-not-allowed text-sm"
              title={tp('ctrl.exportCsvDisabledTitle')}
            >
              <Download size={14} aria-hidden="true" />
              {tp('ctrl.exportCsv')}
            </span>
          )
        )}
      </div>

      <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

      {/* Captions and language */}
      <div role="group" aria-label={tp('ctrl.group.captions')} className="contents">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-3 min-h-[44px] font-medium bg-pulse-700 text-pulse-300 cursor-not-allowed text-sm"
          title={captionsPlanGated ? t('captions_plan_gate') : t('captions_coming_soon')}
        >
          <Subtitles size={14} aria-hidden="true" />
          {t('captions_inactive')}
          <span className="ml-1 text-xs text-amber-400">
            {captionsPlanGated ? '(Chorus)' : t('captions_coming_soon_badge')}
          </span>
        </span>

        {captionsActive && !captionsPlanGated && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-pulse-300 shrink-0">{t('locale_picker_label')}</span>
            <select
              value={captionLocale}
              onChange={(e) => onCaptionLocaleChange(e.target.value as CaptionLocale)}
              className="rounded-lg border border-pulse-600 bg-pulse-800 text-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[44px]"
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

        <CanvasThemePicker variant="bar" />
      </div>

      <span className="w-px h-5 bg-pulse-700 ml-auto" aria-hidden="true" />

      <Link
        to="/dashboard"
        className={`${CTRL} bg-pulse-700 text-white hover:bg-pulse-600`}
      >
        ← {tp('ctrl.dashboard')}
      </Link>
    </div>
  )
}
