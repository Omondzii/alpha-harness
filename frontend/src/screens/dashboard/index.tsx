/**
 * Dashboard (spec §4.1): the day in one sentence, the Submittable Alphas counter, today's
 * allowance and queue, and the work in flight. The live matrix has its own screen.
 */

import { useQuery } from '@tanstack/react-query'
import { AwardIcon, CopyIcon, CpuIcon, LayersIcon, MaximizeIcon, SendIcon } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { BRAIN_ALPHA_URL } from '@/screens/pool/api'
import { today } from '@/api/core'
import type { components } from '@/api/generated'
import { errorMessage, http } from '@/api/http'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/format'

import { useNow } from '@/lib/now'
import { useRefetchOn } from '@/lib/ws'
import { alpha as alphaApi } from '@/screens/alpha/api'
import { AstInspector, checkFigure } from '@/screens/pool/shared'
import {
  Badge,
  Button,
  checkTone,
  Empty,
  ErrorNotice,
  KV,
  Metric,
  Page,
  Panel,
  Progress,
  Notice,
  Skeleton,
  TEXT_TONE,
  type Tone,
} from '@/ui/kit'
import { Sheet } from '@/ui/overlay'
import { GettingStarted } from './getting-started'
import { WorkInFlight } from './work'

type QuarterStanding = components['schemas']['QuarterStanding']

export function DashboardScreen() {
  const [selectedAlphaId, setSelectedAlphaId] = useState<string | null>(null)
  const day = useQuery({ queryKey: ['today'], queryFn: () => today.get() })
  useRefetchOn('simulations', ['today'], 10_000)
  const sims = day.data?.simulations
  const submissions = useQuery({
    queryKey: ['submissions', 'today'],
    queryFn: today.submissions,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const submittedAlphas = submissions.data?.alphas
  // The quarter BRAIN judges on: submitted Alphas and the pyramids they formed. It moves
  // only when something is submitted, which is rare, so it is not worth polling hard.
  const quarter = useQuery({
    queryKey: ['quarter'],
    queryFn: () => http.get<QuarterStanding>('/api/quarter'),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <Page>
      {sims ? (
        <Hero name={day.data?.you.fullName} text={sims.headline} />
      ) : (
        !day.isError && (
          <Skeleton className="mx-1 mt-2 h-18 w-2/3" label="Loading today's figures" />
        )
      )}
      <GettingStarted today={day.data} />
      {day.isError && <ErrorNotice error={day.error} title="Today's figures could not load" />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<AwardIcon />}
          label="Submitted Today"
          loading={submissions.isPending}
          value={
            submissions.isError ? (
              '—'
            ) : (
              <span className="flex flex-col gap-1">
                <span className="text-body font-medium">
                  Regular{' '}
                  <span className="num" style={{ color: 'var(--color-status-running)' }}>
                    {fmt.int(submissions.data?.regular)}/{fmt.int(submissions.data?.regularLimit)}
                  </span>
                </span>
                <span className="text-body font-medium">
                  SuperAlpha{' '}
                  <span className="num" style={{ color: 'var(--color-pnl-positive)' }}>
                    {fmt.int(submissions.data?.superAlpha)}/
                    {fmt.int(submissions.data?.superAlphaLimit)}
                  </span>
                </span>
              </span>
            )
          }
          hint={
            submissions.isError ? (
              'Submission counts could not load.'
            ) : (
              <>
                US Eastern day · resets in{' '}
                <ResetCountdown
                  seconds={submissions.data?.resetsInSeconds ?? 0}
                  since={submissions.dataUpdatedAt}
                />
              </>
            )
          }
        />
        <StatTile
          icon={<CpuIcon />}
          label="Simulations Left Today"
          loading={!sims}
          value={
            sims && (
              <>
                {sims.exact ? '' : '~'}
                {fmt.int(sims.remaining)}
                <span className="text-body text-ink-subtle"> / {fmt.int(sims.limit)}</span>
              </>
            )
          }
          extra={
            sims && (
              <Progress
                value={sims.limit ? sims.used / sims.limit : 0}
                label="Simulation quota depletion"
              />
            )
          }
          hint={
            sims && (
              <>
                Resets in{' '}
                <ResetCountdown seconds={sims.resetsInSeconds} since={day.dataUpdatedAt} />
                {sims.exact ? '' : ' · estimate until the first result today'}
              </>
            )
          }
        />
        <StatTile
          icon={<SendIcon />}
          label="Sent Today"
          loading={!sims}
          value={sims && fmt.int(sims.used)}
          hint={
            sims && (
              <>
                <span className="num">
                  {fmt.pct(sims.limit ? sims.used / sims.limit : null, 0)}
                </span>{' '}
                of the allowance
              </>
            )
          }
        />
        <StatTile
          icon={<LayersIcon />}
          label="Pyramids Completed"
          loading={quarter.isPending}
          value={quarter.isError ? '—' : fmt.int(quarter.data?.pyramidsFormulated)}
          hint={
            quarter.isError ? (
              'The count could not load.'
            ) : (
              <>
                <span className="num">{fmt.int(quarter.data?.alphasPerPyramid)}</span> submitted
                Alphas complete one
                {quarter.data?.pyramidsStarted ? (
                  <>
                    {' · '}
                    <span className="num">{fmt.int(quarter.data.pyramidsStarted)}</span> started
                  </>
                ) : null}
              </>
            )
          }
        />
      </div>

      <WorkInFlight />
      <Panel
        title="Alphas Submitted Today"
        description="Submitted on BRAIN today, including Alphas submitted outside Alpha Harness."
        actions={
          submissions.data && (
            <span className="num text-body-compact text-ink-subtle">
              {fmt.int(submissions.data.total)}
            </span>
          )
        }
        bodyClassName="flex flex-col gap-3"
      >
        {submissions.isPending ? (
          <Skeleton className="h-20 w-full" label="Loading today's submitted Alphas" />
        ) : submissions.isError ? (
          <ErrorNotice error={submissions.error} title="Today's submissions could not load" />
        ) : !Array.isArray(submittedAlphas) ? (
          <Notice tone="warn" title="Submitted Alpha list is unavailable">
            The running backend returned the counts but not the Alpha list. Restart Alpha Harness
            after updating it to load the list.
          </Notice>
        ) : submittedAlphas.length === 0 ? (
          <Empty title="No Alphas submitted today" />
        ) : (
          <>
            <ul className="divide-y divide-hairline">
              {submittedAlphas.map((alpha) => (
                <li
                  key={alpha.alphaId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-w-0 justify-start truncate px-1 font-medium text-link hover:underline"
                      onClick={() => setSelectedAlphaId(alpha.alphaId)}
                    >
                      {alpha.name || alpha.alphaId}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy Alpha ID ${alpha.alphaId}`}
                      title={`Copy ${alpha.alphaId}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        void navigator.clipboard.writeText(alpha.alphaId).then(
                          () => toast.success(`Copied ${alpha.alphaId}`),
                          (error: unknown) =>
                            toast.error(`Could not copy ${alpha.alphaId}`, {
                              description: errorMessage(error),
                            }),
                        )
                      }}
                    >
                      <CopyIcon aria-hidden />
                    </Button>
                  </div>
                  {alpha.type && (
                    <Badge tone={alpha.type === 'SUPER' ? 'profit' : 'muted'}>{alpha.type}</Badge>
                  )}
                  {alpha.status && <Badge tone="outline">{alpha.status}</Badge>}
                  {alpha.dateSubmitted && (
                    <span className="num text-body-compact text-ink-subtle">
                      {fmt.dateTime(alpha.dateSubmitted)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {submissions.data.truncated && (
              <p className="text-body-compact text-ink-subtle">
                Showing the latest {fmt.int(submittedAlphas.length)} of{' '}
                {fmt.int(submissions.data.total)} submitted Alphas.
              </p>
            )}
          </>
        )}
      </Panel>
      <SubmittedAlphaSheet
        alphaId={selectedAlphaId}
        onClose={() => setSelectedAlphaId(null)}
      />
    </Page>
  )
}

function SubmittedAlphaSheet({
  alphaId,
  onClose,
}: {
  alphaId: string | null
  onClose: () => void
}) {
  const query = useQuery({
    queryKey: ['alpha', alphaId, 'preview'],
    queryFn: () => {
      if (!alphaId) throw new Error('Choose an Alpha to preview.')
      return alphaApi.preview(alphaId)
    },
    enabled: alphaId !== null,
    retry: false,
  })
  const alpha = query.data
  const settings = alpha?.settings
  const settingItems = settings
    ? Object.entries(settings)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value)] as [string, string])
    : []

  return (
    <Sheet
      open={alphaId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={
        <div className="flex items-center gap-2">
          <span className="num">{alphaId ?? 'Alpha'}</span>
          {alphaId && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Copy ${alphaId}`}
              onClick={() =>
                void navigator.clipboard.writeText(alphaId).then(
                  () => toast.success(`Copied ${alphaId}`),
                  (error: unknown) =>
                    toast.error(`Could not copy ${alphaId}`, {
                      description: errorMessage(error),
                    }),
                )
              }
            >
              <CopyIcon aria-hidden />
            </Button>
          )}
        </div>
      }
      footer={
        alphaId && (
          <Button
            size="sm"
            variant="secondary"
            render={
              <a
                href={alpha?.brainUrl ?? BRAIN_ALPHA_URL(alphaId)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Open in BRAIN
          </Button>
        )
      }
    >
      {query.isPending ? (
        <Skeleton className="h-60 w-full" label="Loading Alpha preview" />
      ) : query.isError ? (
        <ErrorNotice error={query.error} title="Could not load this Alpha" />
      ) : alpha ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {alpha.type && <Badge tone={alpha.type === 'SUPER' ? 'profit' : 'muted'}>{alpha.type}</Badge>}
            <Badge tone="outline">{alpha.status ?? 'UNKNOWN'}</Badge>
            {alpha.stage && <Badge tone="muted">{alpha.stage}</Badge>}
            {alpha.dateSubmitted && (
              <span className="num text-body-compact text-ink-subtle">
                Submitted {fmt.dateTime(alpha.dateSubmitted)}
              </span>
            )}
          </div>
          {alpha.inSample && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Sharpe" value={fmt.ratio(alpha.inSample.sharpe)} />
              <Metric label="Fitness" value={fmt.ratio(alpha.inSample.fitness)} />
              <Metric label="Turnover" value={fmt.pct(alpha.inSample.turnover)} />
              <Metric label="Returns" value={fmt.pct(alpha.inSample.returns)} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              render={<Link to="/alpha/$alphaId" params={{ alphaId: alpha.alphaId }} />}
            >
              <MaximizeIcon aria-hidden />
              Open Full Page
            </Button>
            <Button
              size="sm"
              variant="secondary"
              render={
                <a
                  href={alpha.brainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              Open in BRAIN
            </Button>
          </div>
          {alpha.type === 'SUPER' ? (
            <section className="flex flex-col gap-3 border-t border-hairline pt-4">
              <div className="flex flex-col gap-2">
                <h3 className="text-title">Selection Expression</h3>
                <AstInspector expression={alpha.selectionExpression} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-title">Combo Expression</h3>
                <AstInspector expression={alpha.code} />
              </div>
            </section>
          ) : (
            <section className="flex flex-col gap-2 border-t border-hairline pt-4">
              <h3 className="text-title">Expression</h3>
              <AstInspector expression={alpha.code} />
            </section>
          )}
          {settingItems.length > 0 && (
            <section className="flex flex-col gap-2 border-t border-hairline pt-4">
              <h3 className="text-title">Settings</h3>
              <KV items={settingItems} />
            </section>
          )}
          {alpha.dataFields && (
            <section className="flex flex-col gap-2 border-t border-hairline pt-4">
              <h3 className="text-title">Data fields</h3>
              {alpha.dataFields.length > 0 ? (
                <ul className="flex flex-col divide-y divide-hairline-subtle">
                  {alpha.dataFields.map((field) => (
                    <li key={field} className="py-1.5 text-body">
                      <code className="num break-all text-ink">{field}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-compact text-ink-subtle">No data fields used.</p>
              )}
            </section>
          )}
          {alpha.checks.length > 0 && (
            <section className="flex flex-col gap-2 border-t border-hairline pt-4">
              <h3 className="text-title">Submission Checks</h3>
              <ul className="flex flex-col divide-y divide-hairline-subtle">
                {alpha.checks.map((check, index) => {
                  const result = typeof check.result === 'string' ? check.result : 'PENDING'
                  return (
                    <li
                      key={`${check.name}-${index}`}
                      className="flex flex-wrap items-center gap-2 py-1.5 text-body"
                    >
                      <Badge tone={checkTone(result)}>{result}</Badge>
                      <span className="num text-ink">{check.name}</span>
                      {typeof check.value === 'number' && (
                        <span className="num text-body-compact text-ink-subtle">
                          {checkFigure(check.name, check.value)}
                          {typeof check.limit === 'number' &&
                            ` / ${checkFigure(check.name, check.limit)}`}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </Sheet>
  )
}

/**
 * The day in one sentence, as the page's heading, greeted by the account's name from
 * `/api/today` (BRAIN profile, falling back to the email). Figures keep tabular digits.
 */
function Hero({ name, text }: { name?: string | null | undefined; text: string }) {
  const parts = text.split(/(~?\d[\d,.]*%?)/)
  return (
    <header className="flex flex-col px-1 pt-2 pb-1">
      {name && <p className="text-display text-ink">Welcome, {name}</p>}
      {/* text-wrap beats the base h1 balance rule, which splits this into an extra short line. */}
      <h1 className="text-display text-wrap text-ink-muted">
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <span key={i} className="num text-display text-primary">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </h1>
    </header>
  )
}

/** One layout for every tile: icon + label on top, the figure, then a hint. */
function StatTile({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
  loading,
  extra,
}: {
  icon?: ReactNode
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  loading: boolean
  extra?: ReactNode
}) {
  return (
    <Panel bodyClassName="flex h-full flex-col justify-between gap-3">
      <div className="flex min-h-5 items-center gap-2">
        {icon && <span className="text-ink-subtle [&_svg]:size-3.5">{icon}</span>}
        <span className="text-caption font-medium uppercase tracking-wide text-ink-subtle">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className={cn('num text-headline font-semibold leading-none', TEXT_TONE[tone])}>
            {value}
          </span>
          {extra}
          {hint && <span className="text-body-compact text-ink-subtle">{hint}</span>}
        </div>
      )}
    </Panel>
  )
}

/** Ticks locally between refetches, in its own component so the page does not re-render. */
function ResetCountdown({ seconds, since }: { seconds: number; since: number }) {
  const now = useNow(1000)
  return <span className="num">{fmt.countdown(seconds - Math.max(0, (now - since) / 1000))}</span>
}
