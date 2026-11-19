/** Decay Sweep: isolate how an Alpha responds to its decay setting. */

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
  Segmented,
  Skeleton,
} from '@/ui/kit'
import { decaySweep } from './api'

export function DecaySweepScreen() {
  const search = useSearch({ from: '/tools/decay-sweep' })
  const navigate = useNavigate()
  const alphaId = search.alpha ?? ''
  const [draft, setDraft] = useState(alphaId)
  const [decayFrom, setDecayFrom] = useState('1')
  const [decayTo, setDecayTo] = useState('40')
  const [parity, setParity] = useState<'any' | 'even' | 'odd'>('any')
  const [chosenCores, setCores] = useState<number | null>(null)
  const wantedCores = useCores(chosenCores)

  useEffect(() => setDraft(alphaId), [alphaId])

  const query = useQuery({
    queryKey: ['decay-sweep', alphaId],
    queryFn: () => decaySweep.preview({ alphaId }),
    enabled: alphaId.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const plan = query.data
  const cores = Math.min(wantedCores, plan?.maxCores ?? wantedCores)
  const from = Number(decayFrom)
  const to = Number(decayTo)
  const validBounds =
    plan !== undefined &&
    decayFrom.trim() !== '' &&
    decayTo.trim() !== '' &&
    Number.isInteger(from) &&
    from >= 0 &&
    from <= plan.maxDecay &&
    Number.isInteger(to) &&
    to >= 0 &&
    to <= plan.maxDecay &&
    from <= to
  const decays = validBounds
    ? Array.from({ length: to - from + 1 }, (_, index) => from + index).filter(
        (value) => parity === 'any' || (parity === 'even' ? value % 2 === 0 : value % 2 === 1),
      )
    : []

  const analyse = (event: React.FormEvent) => {
    event.preventDefault()
    void navigate({
      to: '/tools/decay-sweep',
      search: { alpha: draft.trim() || undefined },
      replace: true,
    })
  }

  const add = useAddTask(() =>
    decaySweep.addTask({
      alphaId,
      decayFrom: from,
      decayTo: to,
      parity,
      cores,
    }),
  )

  return (
    <Page>
      <PageHeader
        title="Decay Sweep"
        description="Find how decay affects an Alpha without changing anything else"
        actions={<AddTaskButtons add={add} disabled={!plan || !validBounds || decays.length < 2} />}
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
            description="Every simulation keeps the source Alpha’s expression and settings; only decay changes."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Metric boxed size="sm" label="Region" value={plan.settings.region} />
              <Metric boxed size="sm" label="Delay" value={`D${plan.settings.delay}`} />
              <Metric boxed size="sm" label="Universe" value={plan.settings.universe} />
              <Metric boxed size="sm" label="Neutralization" value={plan.settings.neutralization} />
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
                label="Truncation"
                value={fmt.ratio(plan.settings.truncation)}
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
            title="Decay Values"
            description={`Choose an inclusive integer range from 0 to ${plan.maxDecay}, then optionally keep only even or odd values.`}
            actions={<CoresSetting value={cores} onChange={setCores} />}
          >
            <div className="flex flex-wrap items-end gap-4">
              <Field label="From" className="w-28">
                <Input
                  type="number"
                  min={0}
                  max={plan.maxDecay}
                  step={1}
                  value={decayFrom}
                  onChange={(event) => setDecayFrom(event.target.value)}
                  className="num"
                />
              </Field>
              <Field label="To" className="w-28">
                <Input
                  type="number"
                  min={0}
                  max={plan.maxDecay}
                  step={1}
                  value={decayTo}
                  onChange={(event) => setDecayTo(event.target.value)}
                  className="num"
                />
              </Field>
              <Segmented
                label="Parity"
                items={[
                  { value: 'any', label: 'Any' },
                  { value: 'even', label: 'Even' },
                  { value: 'odd', label: 'Odd' },
                ]}
                value={parity}
                onChange={setParity}
              />
            </div>
            <Notice
              tone={!validBounds || decays.length < 2 ? 'warn' : 'info'}
              title={
                !validBounds
                  ? `Enter whole-number bounds from 0 to ${plan.maxDecay}, with From no greater than To.`
                  : decays.length < 2
                    ? 'Select at least two decay values.'
                    : `${fmt.int(decays.length)} decay values · ${fmt.int(decays.length)} simulations`
              }
              className="mt-4"
            >
              The source decay is {plan.settings.decay ?? DASH}. This sweep uses only the selected
              range and parity; results are ranked by Sharpe and show each run’s decay.
            </Notice>
          </Panel>
        </>
      )}
    </Page>
  )
}
