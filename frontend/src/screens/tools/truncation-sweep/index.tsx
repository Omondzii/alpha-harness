/** Truncation Sweep: isolate how an Alpha responds to its truncation setting. */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DASH, fmt } from '@/lib/format'
import { useCores } from '@/lib/preferences'
import { AddTaskButtons, useAddTask } from '@/screens/research-labs/add-task'
import { CoresSetting } from '@/screens/research-labs/task-settings'
import {
  Button,
  ErrorNotice,
  Field,
  Input,
  Metric,
  Notice,
  Page,
  PageHeader,
  Panel,
  Skeleton,
} from '@/ui/kit'
import { truncationSweep } from './api'

const valuesBetween = (start: number, end: number, step: number) => {
  if (!(step > 0) || start > end) return []
  const values: number[] = []
  for (let value = start; value <= end; ) {
    values.push(Number(value.toFixed(12)))
    const next = Number((value + step).toFixed(12))
    if (next <= value) break
    value = next
  }
  return values
}

export function TruncationSweepScreen() {
  const search = useSearch({ from: '/tools/truncation-sweep' })
  const navigate = useNavigate()
  const alphaId = search.alpha ?? ''
  const [draft, setDraft] = useState(alphaId)
  const [truncationFrom, setTruncationFrom] = useState('0.01')
  const [truncationTo, setTruncationTo] = useState('0.08')
  const [step, setStep] = useState('0.01')
  const [chosenCores, setCores] = useState<number | null>(null)
  const wantedCores = useCores(chosenCores)

  useEffect(() => setDraft(alphaId), [alphaId])

  const query = useQuery({
    queryKey: ['truncation-sweep', alphaId],
    queryFn: () => truncationSweep.preview({ alphaId }),
    enabled: alphaId.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const plan = query.data
  const cores = Math.min(wantedCores, plan?.maxCores ?? wantedCores)
  const from = Number(truncationFrom)
  const to = Number(truncationTo)
  const increment = Number(step)
  const validBounds =
    plan !== undefined &&
    truncationFrom.trim() !== '' &&
    truncationTo.trim() !== '' &&
    step.trim() !== '' &&
    Number.isFinite(from) &&
    Number.isFinite(to) &&
    Number.isFinite(increment) &&
    from >= plan.minTruncation &&
    to <= plan.maxTruncation &&
    increment >= 0.001 &&
    from <= to
  const truncations = validBounds ? valuesBetween(from, to, increment) : []

  const analyse = (event: React.FormEvent) => {
    event.preventDefault()
    void navigate({
      to: '/tools/truncation-sweep',
      search: { alpha: draft.trim() || undefined },
      replace: true,
    })
  }

  const add = useAddTask(() =>
    truncationSweep.addTask({
      alphaId,
      truncationFrom: from,
      truncationTo: to,
      step: increment,
      cores,
    }),
  )

  return (
    <Page>
      <PageHeader
        title="Truncation Sweep"
        description="Find how truncation affects an Alpha without changing anything else"
        actions={
          <AddTaskButtons add={add} disabled={!plan || !validBounds || truncations.length < 2} />
        }
      />

      <Panel title="Alpha">
        <form onSubmit={analyse} className="flex flex-wrap items-end gap-3">
          <Field label="Alpha ID" className="min-w-48 flex-1">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
              className="num"
            />
          </Field>
          <Button type="submit" variant="primary" disabled={!draft.trim()}>
            Analyse
          </Button>
        </form>
        {query.isError && <ErrorNotice error={query.error} title="Could not read this Alpha" />}
      </Panel>

      {alphaId && query.isPending && <Skeleton className="h-64" label="Reading the Alpha" />}

      {plan && (
        <>
          <Panel
            title="Held Fixed"
            description="Every simulation keeps the source Alpha’s expression and settings; only truncation changes."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Metric boxed size="sm" label="Region" value={plan.settings.region} />
              <Metric boxed size="sm" label="Delay" value={`D${plan.settings.delay}`} />
              <Metric boxed size="sm" label="Universe" value={plan.settings.universe} />
              <Metric boxed size="sm" label="Neutralization" value={plan.settings.neutralization} />
              <Metric
                boxed
                size="sm"
                label="Decay"
                value={plan.settings.decay == null ? DASH : String(plan.settings.decay)}
              />
              <Metric
                boxed
                size="sm"
                label="Max Trade"
                value={plan.settings.maxTrade ?? 'Platform default'}
              />
              <Metric
                boxed
                size="sm"
                label="Max Position"
                value={plan.settings.maxPosition ?? 'Platform default'}
              />
              <Metric
                boxed
                size="sm"
                label="Test Period"
                value={plan.settings.testPeriod ?? 'Platform default'}
              />
              <Metric boxed size="sm" label="Pasteurization" value={plan.settings.pasteurization} />
              <Metric boxed size="sm" label="Unit Handling" value={plan.settings.unitHandling} />
              <Metric boxed size="sm" label="NaN Handling" value={plan.settings.nanHandling} />
              <Metric
                boxed
                size="sm"
                label="Simulation Mode"
                value={plan.settings.simulationMode ?? 'Platform default'}
              />
            </div>
            <pre className="num mt-4 overflow-x-auto rounded-sm border border-hairline bg-canvas p-3 text-body-compact whitespace-pre text-ink-muted">
              {plan.expression}
            </pre>
          </Panel>

          <Panel
            title="Truncation Values"
            description={`Choose an inclusive range from ${plan.minTruncation} to ${plan.maxTruncation} and a positive step.`}
            actions={<CoresSetting value={cores} onChange={setCores} />}
          >
            <div className="flex flex-wrap items-end gap-4">
              <Field label="From" className="w-28">
                <Input
                  type="number"
                  min={plan.minTruncation}
                  max={plan.maxTruncation}
                  step="any"
                  value={truncationFrom}
                  onChange={(event) => setTruncationFrom(event.target.value)}
                  className="num"
                />
              </Field>
              <Field label="To" className="w-28">
                <Input
                  type="number"
                  min={plan.minTruncation}
                  max={plan.maxTruncation}
                  step="any"
                  value={truncationTo}
                  onChange={(event) => setTruncationTo(event.target.value)}
                  className="num"
                />
              </Field>
              <Field label="Step" className="w-28">
                <Input
                  type="number"
                  min={0.001}
                  max={plan.maxTruncation}
                  step="any"
                  value={step}
                  onChange={(event) => setStep(event.target.value)}
                  className="num"
                />
              </Field>
            </div>
            <Notice
              tone={!validBounds || truncations.length < 2 ? 'warn' : 'info'}
              title={
                !validBounds
                  ? `Enter values from ${plan.minTruncation} to ${plan.maxTruncation}, with From no greater than To and a step of at least 0.001.`
                  : truncations.length < 2
                    ? 'Select at least two truncation values.'
                    : `${fmt.int(truncations.length)} values · ${fmt.int(truncations.length)} simulations`
              }
              className="mt-4"
            >
              The source truncation is {fmt.ratio(plan.settings.truncation)}. The sweep uses the
              selected range and step; results are ranked by Sharpe and show each run’s truncation.
            </Notice>
          </Panel>
        </>
      )}
    </Page>
  )
}
