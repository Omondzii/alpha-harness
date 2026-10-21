/** One stored alpha: PnL, settings, submission checks, and correlations on request. */

import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CopyIcon, MaximizeIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { catalog } from '@/api/catalog'
import { ApiError, errorMessage } from '@/api/http'
import type { Scope } from '@/api/types'
import { fmt, isNum } from '@/lib/format'
import { alpha, notApplicable } from '@/screens/alpha/api'
import { PropertiesPanel } from '@/screens/alpha/properties'
import { type AlphaSettings, pool } from '@/screens/pool/api'
import { PnlChart } from '@/screens/pool/pnl-chart'
import {
  Badge,
  Button,
  checkTone,
  Empty,
  ErrorNotice,
  KV,
  Metric,
  Notice,
  Skeleton,
} from '@/ui/kit'
import { Sheet } from '@/ui/overlay'
import { AlphaActionsMenu, AstInspector, checkFigure, OpenInBrain, RecheckButton } from './shared'

type Kind = 'self' | 'prod'
const KIND_LABEL: Record<Kind, string> = {
  self: 'Self-Correlation',
  prod: 'Production Correlation',
}

export function DetailSheet({ alphaId, onClose }: { alphaId: string | null; onClose: () => void }) {
  const copyId = () => {
    if (alphaId) {
      navigator.clipboard.writeText(alphaId)
      toast.success(`Copied ${alphaId}`)
    }
  }

  return (
    <Sheet
      open={alphaId !== null}
      onOpenChange={(o) => !o && onClose()}
      title={
        <div className="flex items-center gap-2">
          <span className="num">{alphaId ?? 'Alpha'}</span>
          {alphaId && (
            <Button size="icon-sm" variant="ghost" onClick={copyId} aria-label={`Copy ${alphaId}`}>
              <CopyIcon className="size-3.5" />
            </Button>
          )}
        </div>
      }
    >
      {alphaId && <Body key={alphaId} alphaId={alphaId} />}
    </Sheet>
  )
}

function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-hairline pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-title">{title}</h3>
          {description && <p className="text-body-compact text-ink-subtle">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

function Body({ alphaId }: { alphaId: string }) {
  const detail = useQuery({
    queryKey: ['pool', 'detail', alphaId],
    queryFn: () => pool.detail(alphaId),
    retry: false,
  })
  const page = useQuery({
    queryKey: ['alpha', alphaId, 'page'],
    queryFn: () => alpha.page(alphaId),
    retry: false,
    // Lazy load: only start fetching after detail is loaded
    enabled: detail.data !== undefined,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
  const [kinds, setKinds] = useState<Kind[]>([])

  if (detail.isPending) return <Skeleton className="h-60" />
  if (detail.isError) return <ErrorNotice error={detail.error} title="Could not load this Alpha" />
  const d = detail.data
  const alphaInfo = page.data?.alpha

  if (page.isError) {
    return (
      <div className="flex flex-col gap-4">
        <AstInspector expression={d.expression} />
        <ErrorNotice error={page.error} title="Could not load alpha properties" />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            render={<Link to="/alpha/$alphaId" params={{ alphaId: d.alphaId }} />}
          >
            <MaximizeIcon aria-hidden />
            Open Full Page
          </Button>
          <OpenInBrain url={d.brainUrl} />
          <RecheckButton alphaId={d.alphaId} />
          <AlphaActionsMenu alphaId={d.alphaId} />
        </div>
        <PnlSection alphaId={d.alphaId} />
        <Section title="Settings">
          <KV items={settingsItems(d.settings)} />
        </Section>
        <Section
          title="Submission Checks"
          description="As BRAIN last reported them. Pending checks resolve with Re-check on BRAIN."
        >
          {d.checks.length === 0 ? (
            <p className="text-body-compact text-ink-subtle">No checks stored.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline-subtle">
              {d.checks.map((c, i) => (
                <li
                  key={`${c.name}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 text-body"
                >
                  <Badge tone={checkTone(c.result ?? 'PENDING')}>{c.result ?? 'PENDING'}</Badge>
                  <span className="num text-ink">{c.name}</span>
                  {isNum(c.value) && (
                    <span className="num text-body-compact text-ink-subtle">
                      {checkFigure(c.name, c.value)}
                      {isNum(c.limit) && ` / ${checkFigure(c.name, c.limit)}`}
                    </span>
                  )}
                  {c.message && (
                    <span className="basis-full text-body-compact break-words text-ink-subtle">
                      {c.message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section
          title="Correlations"
          description="BRAIN rate-limits these checks hourly, so each one loads only when you ask."
          actions={(['self', 'prod'] as Kind[]).map((k) => (
            <Button
              key={k}
              size="sm"
              disabled={kinds.includes(k)}
              onClick={() => setKinds([...kinds, k])}
            >
              {KIND_LABEL[k]}
            </Button>
          ))}
        >
          {kinds.map((k) => (
            <CorrelationResult key={k} alphaId={alphaId} kind={k} />
          ))}
        </Section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <AstInspector expression={d.expression} />
      <AlphaDataFields
        fields={alphaInfo?.dataFields}
        settings={d.settings}
        loading={page.isPending}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          render={<Link to="/alpha/$alphaId" params={{ alphaId: d.alphaId }} />}
        >
          <MaximizeIcon aria-hidden />
          Open Full Page
        </Button>
        <OpenInBrain url={d.brainUrl} />
        <RecheckButton alphaId={d.alphaId} />
        <AlphaActionsMenu alphaId={d.alphaId} />
      </div>

      <PnlSection alphaId={d.alphaId} />

      <Section title="Settings">
        <KV items={settingsItems(d.settings)} />
      </Section>

      <Section
        title="Submission Checks"
        description="As BRAIN last reported them. Pending checks resolve with Re-check on BRAIN."
      >
        {d.checks.length === 0 ? (
          <p className="text-body-compact text-ink-subtle">No checks stored.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline-subtle">
            {d.checks.map((c, i) => (
              <li
                key={`${c.name}-${i}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 text-body"
              >
                <Badge tone={checkTone(c.result ?? 'PENDING')}>{c.result ?? 'PENDING'}</Badge>
                <span className="num text-ink">{c.name}</span>
                {isNum(c.value) && (
                  <span className="num text-body-compact text-ink-subtle">
                    {checkFigure(c.name, c.value)}
                    {isNum(c.limit) && ` / ${checkFigure(c.name, c.limit)}`}
                  </span>
                )}
                {c.message && (
                  <span className="basis-full text-body-compact break-words text-ink-subtle">
                    {c.message}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Correlations"
        description="BRAIN rate-limits these checks hourly, so each one loads only when you ask."
        actions={(['self', 'prod'] as Kind[]).map((k) => (
          <Button
            key={k}
            size="sm"
            disabled={kinds.includes(k)}
            onClick={() => setKinds([...kinds, k])}
          >
            {KIND_LABEL[k]}
          </Button>
        ))}
      >
        {kinds.map((k) => (
          <CorrelationResult key={k} alphaId={alphaId} kind={k} />
        ))}
      </Section>

      {page.isPending ? (
        <Skeleton className="h-80" label="Loading properties" />
      ) : (
        alphaInfo && <PropertiesPanel alpha={alphaInfo} />
      )}
    </div>
  )
}

function AlphaDataFields({
  fields,
  settings,
  loading,
}: {
  fields: string[] | null | undefined
  settings: AlphaSettings
  loading: boolean
}) {
  const scope: Scope | null =
    settings.region && settings.delay != null && settings.universe
      ? {
          instrumentType: 'EQUITY',
          region: settings.region,
          delay: settings.delay,
          universe: settings.universe,
        }
      : null
  const ids = [...new Set(fields ?? [])]
  const lookups = useQueries({
    queries: ids.map((fieldId) => ({
      queryKey: ['catalog', 'field', scope, fieldId],
      queryFn: () => {
        if (!scope) throw new Error('Alpha market settings are unavailable')
        return catalog.field(scope, fieldId)
      },
      enabled: scope !== null,
      retry: false,
    })),
  })
  const lookupError = lookups.find(
    (query) => query.isError && !(query.error instanceof ApiError && query.error.status === 404),
  )

  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-hairline bg-surface-1 p-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-body-compact font-medium text-ink">Data fields</h3>
        {!loading && fields != null && (
          <span className="num text-body-compact text-ink-subtle">
            {fmt.int(ids.length)} {ids.length === 1 ? 'field' : 'fields'}
          </span>
        )}
      </div>
      {loading ? (
        <p className="text-body-compact text-ink-subtle">Loading data fields…</p>
      ) : fields == null ? (
        <p className="text-body-compact text-ink-subtle">
          Data fields could not be determined from this expression.
        </p>
      ) : ids.length === 0 ? (
        <p className="text-body-compact text-ink-subtle">No data fields used.</p>
      ) : (
        <>
          {lookupError && (
            <ErrorNotice error={lookupError.error} title="Could not load field details" />
          )}
          <ul className="flex flex-col divide-y divide-hairline-subtle">
            {ids.map((fieldId, i) => {
              const lookup = lookups[i]
              const field = lookup?.data
              const notFound = lookup?.error instanceof ApiError && lookup.error.status === 404
              return (
                <li
                  key={fieldId}
                  className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1 text-body-compact"
                >
                  {field ? (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <code className="num break-all text-ink">{field.field_id}</code>
                      <span className="text-ink-subtle">
                        {[field.field_type, field.dataset_id, field.category_name]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {field.description && <p className="text-ink-subtle">{field.description}</p>}
                    </div>
                  ) : (
                    <>
                      <code className="num min-w-0 break-all text-ink">{fieldId}</code>
                      <span className="text-ink-subtle">
                        {notFound
                          ? 'Not in this market’s catalog'
                          : lookup?.isError
                            ? 'Could not load metadata'
                            : scope
                              ? 'Loading metadata…'
                              : 'Market settings unavailable'}
                      </span>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

/** Its own request: the first view of an Alpha downloads its daily PnL from BRAIN, and the
 * rest of the sheet, all stored locally, should not wait for that. */
function PnlSection({ alphaId }: { alphaId: string }) {
  const q = useQuery({
    queryKey: ['pool', 'pnl', alphaId],
    queryFn: () => pool.pnl(alphaId),
    retry: false,
  })
  const p = q.data
  return (
    <Section
      title="Cumulative PnL"
      description={p ? `${fmt.int(p.days)} trading days stored` : 'Reading the daily PnL…'}
    >
      {q.isPending ? (
        <Skeleton className="h-48" label="Downloading the daily PnL from BRAIN" />
      ) : q.isError ? (
        <ErrorNotice error={q.error} title="Could not load the daily PnL" />
      ) : (
        <>
          {q.data.problem && <Notice tone="warn">{q.data.problem}</Notice>}
          {q.data.pnl.length > 1 ? (
            <PnlChart
              values={q.data.pnl}
              dates={q.data.dates}
              label={`Cumulative PnL of ${alphaId}`}
            />
          ) : (
            !q.data.problem && (
              <Empty title="No daily PnL stored">BRAIN returned no daily PnL for this Alpha.</Empty>
            )
          )}
        </>
      )}
    </Section>
  )
}

const cellText = (v: unknown) =>
  isNum(v) ? (Number.isInteger(v) ? fmt.int(v) : fmt.ratio(v, 4)) : v == null ? '—' : String(v)

function CorrelationResult({ alphaId, kind }: { alphaId: string; kind: Kind }) {
  const q = useQuery({
    queryKey: ['pool', 'correlations', alphaId, kind],
    queryFn: () => alpha.correlation(alphaId, kind, 'run'),
    retry: false,
    staleTime: Infinity,
  })
  const label = KIND_LABEL[kind]

  if (q.isPending) return <Skeleton className="h-24" />
  if (q.isError) {
    const e = q.error
    if (notApplicable(e)) {
      return (
        <p className="text-body-compact text-ink-subtle">{label}: not applicable to this Alpha.</p>
      )
    }
    const limited = e instanceof ApiError && e.code === 'rate_limited'
    const retry = (
      <Button size="sm" variant="ghost" onClick={() => q.refetch()}>
        Try again
      </Button>
    )
    return limited ? (
      <Notice tone="warn" title={`${label}: BRAIN's hourly limit`} action={retry}>
        {errorMessage(e)}
        {isNum(e.body.retryAfter) && (
          <>
            {' '}
            Try again in <span className="num">{fmt.duration(e.body.retryAfter)}</span>.
          </>
        )}
      </Notice>
    ) : (
      <div className="flex flex-col gap-2">
        <ErrorNotice error={e} title={label} />
        <div>{retry}</div>
      </div>
    )
  }

  // A run always comes back kept; `cached: false` only answers a cached-only read.
  if (!q.data.cached) return null
  const props = q.data.schema?.properties ?? []
  const rows = q.data.records ?? []

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <h3 className="text-body font-medium text-balance text-ink">{label}</h3>
        {/* A kept answer: self-correlation moves as other Alphas are submitted. */}
        <span className="text-body-compact text-ink-subtle">{fmt.ago(q.data.fetchedAt)}</span>
        {isNum(q.data.min) && <Metric size="sm" label="Min" value={fmt.ratio(q.data.min, 4)} />}
        {isNum(q.data.max) && <Metric size="sm" label="Max" value={fmt.ratio(q.data.max, 4)} />}
      </div>
      {rows.length === 0 ? (
        <p className="text-body-compact text-ink-subtle">BRAIN returned no rows.</p>
      ) : (
        <div className="max-h-64 overflow-auto rounded-md border border-hairline">
          <table className="w-full text-body">
            <thead className="sticky top-0 bg-surface-1">
              <tr>
                {props.map((p) => (
                  <th
                    key={p.name}
                    className="border-b border-hairline px-3 py-1.5 text-left text-body-compact font-medium text-ink-subtle"
                  >
                    {p.title ?? p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((record, i) => (
                <tr key={i} className="border-b border-hairline-subtle last:border-b-0">
                  {props.map((p, j) => (
                    <td
                      key={p.name}
                      className={`num px-3 py-1 ${isNum(record[j]) ? 'text-right' : ''}`}
                    >
                      {cellText(record[j])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const settingsItems = (s: AlphaSettings): [string, string][] => [
  ['Region', s.region ?? '—'],
  ['Universe', s.universe ?? '—'],
  ['Delay', fmt.int(s.delay)],
  ['Neutralization', s.neutralization ?? '—'],
  ['Decay', fmt.int(s.decay)],
  ['Truncation', fmt.ratio(s.truncation)],
]
