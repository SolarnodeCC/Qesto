/**
 * XrSpatialScene.tsx — XR-SPATIAL-01 / XR-AVATAR-01 stub renderer (ADR-0066).
 *
 * S98 builds a **stub renderer only**. Per ADR-0066 D2, `three` / `@babylonjs/*`
 * (or any WebGL engine) is explicitly deferred to S99, gated on the XR-00
 * kill-criterion surviving. This component proves the wire path — real
 * question data in, avatar poses in, pose frames out — using a lightweight
 * `<canvas>` 2D scene that is clearly a placeholder, never a polished 3D
 * engine. Do NOT add a WebGL/Three.js dependency here.
 *
 * Privacy (ADR-0066 D4): avatars are non-photorealistic markers carrying only
 * an ephemeral id (`a`) and pose (`p`/`q`). No participant name or any other
 * PII is ever read or rendered by this component.
 */
import { useEffect, useRef } from 'react'
import type { LiveQuestion } from '../hooks/useLiveSession'
import type { XrAvatarSync } from '../hooks/useLiveSession'
import { useT } from '../i18n'

export interface XrSpatialSceneProps {
  question: LiveQuestion | null
  /** Latest merged avatar batch from the DO (ADR-0066), or null before first sync. */
  avatars: XrAvatarSync['avatars']
  /** Mirrors `prefers-reduced-motion` — disables the idle rotation animation. */
  reducedMotion: boolean
}

const MAX_RENDERED_AVATARS = 50

/** Project a normalized [-1,1] x/z pose into 2D canvas placeholder coordinates. */
function projectToCanvas(p: [number, number, number], width: number, height: number): { x: number; y: number } {
  const x = ((p[0] + 1) / 2) * width
  const y = ((p[2] + 1) / 2) * height
  return { x, y }
}

export function XrSpatialScene({ question, avatars, reducedMotion }: XrSpatialSceneProps) {
  const t = useT('xr')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const angleRef = useRef(0)

  // Stub render loop: draws a centered placeholder "question object" and up to
  // MAX_RENDERED_AVATARS markers at their last-known pose. This is intentionally
  // not a real 3D scene — it proves the data path end-to-end without a WebGL
  // dependency. Capped at 50 avatars so a crowded room never causes layout
  // thrash (XR-AVATAR-01 AC).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = canvas.width
    const height = canvas.height

    function draw() {
      ctx!.clearRect(0, 0, width, height)

      // Backdrop: simple placeholder "floor grid" to signal a 3D-ish stub scene.
      ctx!.strokeStyle = 'rgba(20, 184, 166, 0.15)'
      ctx!.lineWidth = 1
      const gridStep = Math.max(24, Math.floor(width / 12))
      for (let gx = 0; gx <= width; gx += gridStep) {
        ctx!.beginPath()
        ctx!.moveTo(gx, 0)
        ctx!.lineTo(gx, height)
        ctx!.stroke()
      }
      for (let gy = 0; gy <= height; gy += gridStep) {
        ctx!.beginPath()
        ctx!.moveTo(0, gy)
        ctx!.lineTo(width, gy)
        ctx!.stroke()
      }

      // Centered "question object" — a simple rotating-ish rounded square,
      // standing in for a real 3D mesh. Rotation is skipped entirely when
      // prefers-reduced-motion is set (no forced motion).
      const cx = width / 2
      const cy = height / 2
      const size = Math.min(width, height) * 0.22
      if (!reducedMotion) angleRef.current += 0.004
      ctx!.save()
      ctx!.translate(cx, cy)
      ctx!.rotate(angleRef.current)
      ctx!.fillStyle = 'rgba(20, 184, 166, 0.18)'
      ctx!.strokeStyle = '#14b8a6'
      ctx!.lineWidth = 2
      ctx!.beginPath()
      const r = 12
      ctx!.moveTo(-size / 2 + r, -size / 2)
      ctx!.arcTo(size / 2, -size / 2, size / 2, size / 2, r)
      ctx!.arcTo(size / 2, size / 2, -size / 2, size / 2, r)
      ctx!.arcTo(-size / 2, size / 2, -size / 2, -size / 2, r)
      ctx!.arcTo(-size / 2, -size / 2, size / 2, -size / 2, r)
      ctx!.closePath()
      ctx!.fill()
      ctx!.stroke()
      ctx!.restore()

      // Avatar markers — non-photorealistic dots only, never a name/photo.
      const rendered = avatars.slice(0, MAX_RENDERED_AVATARS)
      for (const avatar of rendered) {
        const { x, y } = projectToCanvas(avatar.p, width, height)
        ctx!.beginPath()
        ctx!.fillStyle = 'rgba(124, 58, 237, 0.85)'
        ctx!.arc(x, y, 6, 0, Math.PI * 2)
        ctx!.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [avatars, reducedMotion])

  const renderedCount = Math.min(avatars.length, MAX_RENDERED_AVATARS)

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto rounded-xl overflow-hidden border border-teal-500/30 bg-[#070B16]">
      <canvas
        ref={canvasRef}
        width={360}
        height={360}
        role="img"
        aria-label={t('scene_placeholder_label')}
        className="w-full h-full"
      />
      {question && (
        <div
          role="region"
          aria-label={t('question_region_label')}
          className="absolute inset-x-0 top-0 px-4 py-2 bg-black/60 text-white text-sm font-medium text-center"
        >
          {question.prompt}
        </div>
      )}
      <p
        role="status"
        aria-live="polite"
        className="absolute inset-x-0 bottom-0 px-3 py-1.5 bg-black/50 text-[11px] text-center text-white/80"
      >
        {renderedCount === 1
          ? t('avatar_count_label', { count: renderedCount })
          : t('avatar_count_label_other', { count: renderedCount })}
      </p>
    </div>
  )
}

export default XrSpatialScene
