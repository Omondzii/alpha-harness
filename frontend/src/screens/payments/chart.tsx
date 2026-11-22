/** Daily base-payment chart, grouped like BRAIN's profile chart. */

import type { PaymentOverview } from './api'

export type DailyPayment = {
  date: string
  regular: number
  super: number
  total: number
}

const DAY_MS = 86_400_000
const REGULAR_COLOR = 'var(--color-status-running)'
const SUPER_COLOR = 'var(--color-pnl-positive)'

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`))

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )

export function dailyPayments(data: PaymentOverview): DailyPayment[] {
  const amounts = new Map<string, { regular: number; super: number }>()
  for (const record of data.base.records) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) continue
    amounts.set(record.date, {
      regular: record.regularAlpha ?? 0,
      super: record.superAlpha ?? 0,
    })
  }
  const dates = [...amounts.keys()].sort()
  if (dates.length === 0) return []

  const first = new Date(`${dates[0]}T00:00:00Z`).getTime()
  const last = new Date(`${dates[dates.length - 1]}T00:00:00Z`).getTime()
  const days = Math.round((last - first) / DAY_MS)
  return Array.from({ length: days + 1 }, (_, index) => {
    const date = new Date(first + index * DAY_MS).toISOString().slice(0, 10)
    const amount = amounts.get(date) ?? { regular: 0, super: 0 }
    return {
      date,
      ...amount,
      total: amount.regular + amount.super,
    }
  })
}

export function PaymentChart({ rows, currency }: { rows: DailyPayment[]; currency: string }) {
  const width = 1000
  const height = 300
  const margin = { top: 12, right: 68, bottom: 34, left: 58 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const max = Math.max(1, ...rows.map((row) => row.total))
  const tick = 10 ** Math.floor(Math.log10(max))
  const ceiling = Math.ceil(max / tick) * tick || 1
  const groupWidth = rows.length > 0 ? plotWidth / rows.length : plotWidth
  const barWidth = Math.max(0.5, Math.min(7, groupWidth * 0.78))
  const formatCompact = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const ticks = Array.from({ length: 5 }, (_, i) => (ceiling * i) / 4)
  const monthTicks = rows.filter(
    (row, i) => i === 0 || row.date.slice(0, 7) !== rows[i - 1]?.date.slice(0, 7),
  )
  const labelEvery = Math.max(1, Math.ceil(monthTicks.length / 8))

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Daily base payments for Regular and Super Alpha"
      className="h-80 w-full overflow-visible"
      preserveAspectRatio="xMidYMid meet"
    >
      {ticks.map((value) => {
        const y = margin.top + plotHeight * (1 - value / ceiling)
        return (
          <g key={value}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y}
              y2={y}
              stroke="var(--color-hairline)"
              strokeWidth="1"
            />
            <text
              x={margin.left - 8}
              y={y + 4}
              textAnchor="end"
              fill="var(--color-ink-subtle)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {formatCompact.format(value)}
            </text>
          </g>
        )
      })}
      {rows.map((row, index) => {
        const center = margin.left + (index + 0.5) * groupWidth
        const regularHeight = (row.regular / ceiling) * plotHeight
        const superHeight = (row.super / ceiling) * plotHeight
        const x = center - barWidth / 2
        const bottom = margin.top + plotHeight
        return (
          <g key={row.date}>
            <rect
              x={x}
              y={bottom - regularHeight}
              width={barWidth}
              height={regularHeight}
              fill={REGULAR_COLOR}
            >
              <title>
                {`${dateLabel(row.date)} · Regular Alpha: ${new Intl.NumberFormat('en', {
                  style: 'currency',
                  currency,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(row.regular)}`}
              </title>
            </rect>
            <rect
              x={x}
              y={bottom - regularHeight - superHeight}
              width={barWidth}
              height={superHeight}
              fill={SUPER_COLOR}
            >
              <title>
                {`${dateLabel(row.date)} · Super Alpha: ${new Intl.NumberFormat('en', {
                  style: 'currency',
                  currency,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(row.super)}`}
              </title>
            </rect>
          </g>
        )
      })}
      {monthTicks.map((row, index) =>
        index % labelEvery === 0 ? (
          <text
            key={row.date}
            x={margin.left + (rows.indexOf(row) + 0.5) * groupWidth}
            y={height - 8}
            textAnchor="middle"
            fill="var(--color-ink-subtle)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            {monthLabel(row.date)}
          </text>
        ) : null,
      )}
    </svg>
  )
}

export function PaymentLegend() {
  const series = [
    { label: 'Regular Alpha', color: REGULAR_COLOR },
    { label: 'Super Alpha', color: SUPER_COLOR },
  ]
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-body-compact text-ink-subtle">
      {series.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-xs" style={{ background: item.color }} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  )
}
