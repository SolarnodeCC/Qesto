interface TrendSparkProps {
  /** Weekly bucket counts, oldest → newest (typically 4 values) */
  data: number[]
  width?: number
  height?: number
  className?: string
}

export default function TrendSpark({ data, width = 56, height = 20, className = '' }: TrendSparkProps) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const segW = width / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * segW
    const y = height - Math.round((v / max) * (height - 2)) - 1
    return `${x},${y}`
  })

  const isUp = data[data.length - 1] > data[0]
  const isFlat = data.every((v) => v === data[0])
  const color = isFlat ? 'var(--pulse-400)' : isUp ? 'var(--teal-600)' : 'var(--signal-warning)'

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Terminal dot */}
      <circle
        cx={points[points.length - 1].split(',')[0]}
        cy={points[points.length - 1].split(',')[1]}
        r="2"
        fill={color}
      />
    </svg>
  )
}
