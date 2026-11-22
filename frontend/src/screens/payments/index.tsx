/** BRAIN's base and other payment history, including bonus and referral entries. */

import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'
import { useMemo } from 'react'
import { DASH, fmt, isNum } from '@/lib/format'
import { Button, Empty, ErrorNotice, Metric, Page, PageHeader, Panel, Skeleton } from '@/ui/kit'
import type { PaymentOverview } from './api'
import { payments } from './api'
import { dailyPayments, PaymentChart, PaymentLegend } from './chart'

const REFRESH_MS = 15 * 60 * 1000

const cash = (value: number | null | undefined, currency: string) =>
  isNum(value)
    ? new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    : DASH

type PaymentPeriodSummary = {
  start?: string | null
  end?: string | null
  value?: number | null
  regularAlpha?: number | null
  superAlpha?: number | null
}

function latestOtherPayments(records: PaymentOverview['other']['records']) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date))
}

export function PaymentsScreen() {
  const query = useQuery({
    queryKey: ['payments'],
    queryFn: payments.overview,
    staleTime: REFRESH_MS / 3,
    refetchInterval: REFRESH_MS,
    retry: false,
  })
  const data = query.data
  const rows = useMemo(() => (data ? dailyPayments(data) : []), [data])
  const currency = data?.base.currency || data?.other.currency || 'USD'
  const baseTotal = data?.base.periods['total']?.value
  const otherTotal = data?.other.total.value
  const allTime = isNum(baseTotal) && isNum(otherTotal) ? baseTotal + otherTotal : null
  const current = data?.base.periods['current']
  const entries = data ? latestOtherPayments(data.other.records) : []
  const firstDay = rows[0]
  const lastDay = rows.at(-1)
  const totalPeriod = data?.base.periods['total']
  const displayedPeriod =
    firstDay && lastDay && totalPeriod
      ? { ...totalPeriod, start: firstDay.date, end: lastDay.date }
      : totalPeriod
  const periods: { label: string; period: PaymentPeriodSummary }[] = data
    ? [
        { label: 'Displayed Period', period: displayedPeriod },
        { label: 'Yesterday', period: data.base.periods['yesterday'] },
        { label: 'Current Period', period: data.base.periods['current'] },
        { label: 'Previous Period', period: data.base.periods['previous'] },
        { label: 'Year to Date', period: data.base.periods['ytd'] },
        { label: 'Total', period: data.base.periods['total'] },
      ].filter(
        (entry): entry is { label: string; period: PaymentPeriodSummary } => entry.period != null,
      )
    : []

  return (
    <Page>
      <PageHeader
        title="Payments"
        description="Payment history fetched from your BRAIN account. Base and bonus/other amounts are shown as BRAIN reports them."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={!data || query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCwIcon aria-hidden className={query.isFetching ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        }
      />

      {query.isError && <ErrorNotice error={query.error} title="Could not load payment history" />}
      {query.isPending ? (
        <Skeleton className="h-32" label="Reading payments from BRAIN" />
      ) : (
        data && (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric boxed label="Total All Time" value={cash(allTime, currency)} />
              <Metric boxed label="Base Payment" value={cash(baseTotal, currency)} />
              <Metric boxed label="Bonus & Other Payments" value={cash(otherTotal, currency)} />
              <Metric boxed label="Current Period Base" value={cash(current?.value, currency)} />
            </div>

            <Panel
              title="Base Payment History"
              description="Daily base payments, split into Regular and Super Alpha. Hover a bar for its exact value."
            >
              {rows.length ? (
                <div className="flex flex-col gap-3">
                  <PaymentLegend />
                  <PaymentChart rows={rows} currency={currency} />
                  <div className="overflow-x-auto border-t border-hairline pt-3">
                    <table className="w-full min-w-120 text-body-compact">
                      <thead>
                        <tr className="border-b border-hairline text-left text-caption text-ink-subtle">
                          <th scope="col" className="px-3 py-2 font-medium">
                            Period
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            Dates
                          </th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">
                            Regular
                          </th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">
                            Super
                          </th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map(({ label, period }) => (
                          <tr key={label} className="border-b border-hairline-subtle">
                            <td className="px-3 py-2 text-ink">{label}</td>
                            <td className="num px-3 py-2 text-ink-muted">
                              {period?.start && period.end
                                ? `${fmt.date(period.start)} – ${fmt.date(period.end)}`
                                : DASH}
                            </td>
                            <td className="num px-3 py-2 text-right">
                              {cash(period?.regularAlpha, currency)}
                            </td>
                            <td className="num px-3 py-2 text-right">
                              {cash(period?.superAlpha, currency)}
                            </td>
                            <td className="num px-3 py-2 text-right font-medium">
                              {cash(period?.value, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <Empty title="No base payment records">
                  BRAIN returned no base payment history.
                </Empty>
              )}
            </Panel>

            <Panel
              title="Bonus & Other Payments"
              description="Entries from BRAIN's other-payment feed, such as quarterly payments and referrals."
            >
              {entries.length === 0 ? (
                <Empty title="No other payment entries">
                  BRAIN returned no other-payment records.
                </Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-120 text-body-compact">
                    <thead>
                      <tr className="border-b border-hairline text-left text-caption text-ink-subtle">
                        <th scope="col" className="px-3 py-2 font-medium">
                          Date
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Description
                        </th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, index) => (
                        <tr
                          key={`${entry.date}-${entry.description}-${index}`}
                          className="border-b border-hairline-subtle last:border-b-0"
                        >
                          <td className="num px-3 py-2 text-ink-muted">{fmt.date(entry.date)}</td>
                          <td className="px-3 py-2 text-ink">{entry.description}</td>
                          <td className="num px-3 py-2 text-right text-pnl-positive-text">
                            {cash(entry.value, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )
      )}
    </Page>
  )
}
