import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { auth, simulations } from '@/api/core'
import type { Scope } from '@/api/types'
import { fmt, isNum } from '@/lib/format'
import { DEFAULT_SCOPE, useScopeOptions } from '@/lib/scope'
import { useDebounced } from '@/lib/use-debounced'
import { SimulationSettingsFields, testPeriodOf } from '@/screens/research-labs/simulation-settings'
import { templateLab } from '@/screens/research-labs/template/api'
import { TemplateBlocks } from '@/screens/research-labs/template/blocks'
import { TemplateEditor } from '@/screens/research-labs/template/editor'
import type { OperatorDoc } from '@/screens/research-labs/template/fast-expression'
import {
  Button,
  ErrorNotice,
  Field,
  Fieldset,
  Input,
  Metric,
  Notice,
  Page,
  PageHeader,
  Panel,
  Progress,
  Segmented,
  Skeleton,
} from '@/ui/kit'
import { Select } from '@/ui/overlay'
import { type ScopePart, ScopePicker } from '@/ui/scope-picker'
import { checkName, verdictOf } from './analysis'
import type { AlphaView, SimulationRow } from './api'
import { alpha as api } from './api'

const MODES = [
  { value: 'FULL', label: 'Full' },
  { value: 'QUICK', label: 'Quick' },
] as const

const ACTIVE = new Set(['QUEUED', 'PENDING', 'RUNNING'])

type Mode = (typeof MODES)[number]['value']
type Settings = Record<string, unknown>
type SavedDraft = {
  settings: Settings
  regular: string
  selection: string
  combo: string
  mode?: Mode
  reserveCore?: boolean
}

const TEST_PERIOD = /^P(\d+)Y(\d+)M/
const MARKET_PARTS: readonly ScopePart[] = ['region', 'delay', 'universe']

function scopeFrom(settings: Settings): Scope {
  return {
    instrumentType: String(settings['instrumentType'] ?? DEFAULT_SCOPE.instrumentType),
    region: String(settings['region'] ?? DEFAULT_SCOPE.region),
    delay: Number(settings['delay'] ?? DEFAULT_SCOPE.delay),
    universe: String(settings['universe'] ?? DEFAULT_SCOPE.universe),
  }
}

function testPeriodParts(value: unknown): [string, string] {
  const found = TEST_PERIOD.exec(String(value ?? ''))
  return found ? [found[1] ?? '2', found[2] ?? '0'] : ['2', '0']
}

export function FocusedSimulationScreen() {
  const { alphaId } = useParams({ from: '/focused-simulation/$alphaId' })
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('FULL')
  const [reserveCore, setReserveCore] = useState(true)
  const [settings, setSettings] = useState<Settings>({})
  const [regular, setRegular] = useState('')
  const [selection, setSelection] = useState('')
  const [combo, setCombo] = useState('')
  const [recordId, setRecordId] = useState<number | null>(null)
  const [draftKey, setDraftKey] = useState<string | null>(null)
  const updateScope = useCallback(
    (change: Partial<Scope>) => setSettings((current) => ({ ...current, ...change })),
    [],
  )

  const page = useQuery({
    queryKey: ['alpha', alphaId, 'page'],
    queryFn: () => api.page(alphaId),
    retry: false,
  })
  const alpha = page.data?.alpha
  const scope = scopeFrom(settings)
  const scopeOptions = useScopeOptions(scope)
  const delayedSettings = useDebounced(settings, 250)
  const settingsAreCurrent = JSON.stringify(settings) === JSON.stringify(delayedSettings)
  const options = useQuery({
    queryKey: ['focused-simulation', 'settings-options', alphaId, delayedSettings],
    queryFn: () => auth.settingsOptions(delayedSettings),
    enabled: Boolean(alpha && Object.keys(delayedSettings).length),
  })
  const engine = useQuery({
    queryKey: ['simulations', 'engine'],
    queryFn: simulations.engine,
  })
  const record = useQuery({
    queryKey: ['simulations', 'record', recordId],
    queryFn: () => {
      if (recordId === null) throw new Error('No focused simulation is selected.')
      return api.simulation(recordId)
    },
    enabled: recordId !== null,
    refetchInterval: (query) => {
      const current = query.state.data
      return current && ACTIVE.has(current.status) ? 2_000 : false
    },
  })
  const resultAlphaId = record.data && !ACTIVE.has(record.data.status) ? record.data.alphaId : null
  const result = useQuery({
    queryKey: ['focused-simulation', 'result-alpha', resultAlphaId],
    queryFn: () => {
      if (!resultAlphaId) throw new Error('No resulting Alpha is available.')
      return api.page(resultAlphaId)
    },
    enabled: Boolean(resultAlphaId),
    retry: false,
  })

  useEffect(() => {
    if (!alpha) return
    const key = `alpha-harness-focused-draft:${alphaId}`
    const baseline: SavedDraft = {
      settings: { ...alpha.settings },
      regular: alpha.type === 'SUPER' ? '' : (alpha.code ?? ''),
      selection: alpha.selectionExpression ?? '',
      combo: alpha.type === 'SUPER' ? (alpha.code ?? '') : '',
      mode: 'FULL',
      reserveCore: true,
    }
    let restored = baseline
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<SavedDraft>
        if (
          parsed.settings &&
          typeof parsed.settings === 'object' &&
          typeof parsed.regular === 'string' &&
          typeof parsed.selection === 'string' &&
          typeof parsed.combo === 'string' &&
          (parsed.mode === undefined || parsed.mode === 'FULL' || parsed.mode === 'QUICK') &&
          (parsed.reserveCore === undefined || typeof parsed.reserveCore === 'boolean')
        ) {
          restored = parsed as SavedDraft
        } else {
          localStorage.removeItem(key)
        }
      } catch {
        localStorage.removeItem(key)
      }
    }
    setDraftKey(null)
    setSettings(restored.settings)
    setRegular(restored.regular)
    setSelection(restored.selection)
    setCombo(restored.combo)
    setMode(restored.mode ?? 'FULL')
    setReserveCore(restored.reserveCore ?? true)
    setRecordId(null)
    setDraftKey(key)
  }, [alpha, alphaId])

  useEffect(() => {
    if (!draftKey) return
    const draft: SavedDraft = { settings, regular, selection, combo, mode, reserveCore }
    localStorage.setItem(draftKey, JSON.stringify(draft))
  }, [combo, draftKey, mode, regular, reserveCore, selection, settings])

  const run = useMutation({
    mutationFn: () =>
      api.simulate(alphaId, {
        mode,
        reserveCore,
        settings,
        ...(alpha?.type === 'SUPER' ? { selection, combo } : { regular }),
      }),
    onSuccess: (accepted) => {
      setRecordId(accepted.recordId)
      void queryClient.invalidateQueries({ queryKey: ['simulations', 'engine'] })
      toast.success(
        accepted.status === 'SKIPPED'
          ? 'An identical simulation already exists; showing its saved result.'
          : reserveCore
            ? 'Focused simulation queued with a reserved core.'
            : 'Focused simulation queued.',
      )
    },
  })
  const cancel = useMutation({
    mutationFn: (id: number) => simulations.cancel(id),
    onSuccess: () => {
      void record.refetch()
      void queryClient.invalidateQueries({ queryKey: ['simulations', 'engine'] })
    },
  })

  if (page.isPending)
    return (
      <Page>
        <Skeleton className="h-[40rem]" label={`Loading ${alphaId} from BRAIN`} />
      </Page>
    )
  if (page.isError) {
    return (
      <Page>
        <ErrorNotice error={page.error} title={`Could not load ${alphaId}`} />
        <Button render={<Link to="/alpha/$alphaId" params={{ alphaId }} />}>Back to Alpha</Button>
      </Page>
    )
  }
  if (!alpha) return null

  const isSuper = alpha.type === 'SUPER'
  const active = record.data ? ACTIVE.has(record.data.status) : false
  const oneCoreOnly = ['GLB', 'ALL'].includes(String(settings['region'] ?? ''))
  const quickAllowed = engine.data?.quickAllowed === true
  const expressionsReady = isSuper
    ? Boolean(selection.trim() && combo.trim())
    : Boolean(regular.trim())
  const settingsReady =
    settingsAreCurrent &&
    Boolean(options.data) &&
    !options.data?.missing.length &&
    !options.data?.problems.length
  const [testYears, testMonths] = testPeriodParts(settings['testPeriod'])
  const changedSettings = Object.keys({ ...alpha.settings, ...settings }).filter(
    (key) => JSON.stringify(alpha.settings[key]) !== JSON.stringify(settings[key]),
  )
  const changedExpressions = [
    alpha.type !== 'SUPER' && regular !== (alpha.code ?? ''),
    alpha.type === 'SUPER' && selection !== (alpha.selectionExpression ?? ''),
    alpha.type === 'SUPER' && combo !== (alpha.code ?? ''),
  ].filter(Boolean).length
  const changedCount = changedSettings.length + changedExpressions

  const updateSetting = (name: string, value: unknown) =>
    setSettings((current) => ({ ...current, [name]: value }))
  const resetDraft = () => {
    localStorage.removeItem(`alpha-harness-focused-draft:${alphaId}`)
    setSettings({ ...alpha.settings })
    setRegular(alpha.type === 'SUPER' ? '' : (alpha.code ?? ''))
    setSelection(alpha.selectionExpression ?? '')
    setCombo(alpha.type === 'SUPER' ? (alpha.code ?? '') : '')
    setMode('FULL')
    setReserveCore(true)
    setRecordId(null)
  }
  const fieldChoices = (name: string) =>
    (options.data?.fields[name]?.choices ?? []).map((choice) => ({
      value: String(choice.value),
      label: String(choice.label ?? choice.value),
    }))
  const stringSetting = (name: string, fallback: string) =>
    typeof settings[name] === 'string' ? String(settings[name]) : fallback

  return (
    <Page className="mx-auto w-full max-w-[96rem]">
      <PageHeader
        title={`Focused simulation · ${alpha.name || alpha.alphaId}`}
        description="Edit a private simulation draft, then run it once. These changes do not update the saved Alpha on BRAIN."
        actions={
          <>
            <Button variant="secondary" disabled={!changedCount} onClick={resetDraft}>
              Reset draft
            </Button>
            <Button variant="secondary" render={<Link to="/alpha/$alphaId" params={{ alphaId }} />}>
              Back to Alpha
            </Button>
          </>
        }
      />
      {changedCount > 0 && (
        <Notice tone="info">
          Draft differs from the saved Alpha: {changedExpressions} expression
          {changedExpressions === 1 ? '' : 's'} and {changedSettings.length} setting
          {changedSettings.length === 1 ? '' : 's'} changed. Draft is saved in this browser.
        </Notice>
      )}
      {page.data.problems.map((problem) => (
        <Notice key={problem} tone="warn">
          {problem}
        </Notice>
      ))}
      <Panel
        title={isSuper ? 'Expressions' : 'Expression'}
        description={
          isSuper
            ? 'Both SuperAlpha expressions are editable for this run.'
            : 'The expression is editable for this run.'
        }
        bodyClassName="flex flex-col gap-4"
      >
        {isSuper ? (
          <>
            <Field label="Selection expression">
              <FocusedExpressionEditor
                label="Selection expression"
                value={selection}
                onChange={setSelection}
                scope={scope}
              />
            </Field>
            <Field label="Combo expression">
              <FocusedExpressionEditor
                label="Combo expression"
                value={combo}
                onChange={setCombo}
                scope={scope}
              />
            </Field>
          </>
        ) : (
          <Field label="Expression">
            <FocusedExpressionEditor
              label="Expression"
              value={regular}
              onChange={setRegular}
              scope={scope}
            />
          </Field>
        )}
      </Panel>
      <Panel
        title="Simulation settings"
        description="Familiar Template Lab controls. Your changes apply only to this run."
        bodyClassName="flex flex-col gap-4"
      >
        {!settingsAreCurrent && <Skeleton className="h-8" label="Checking settings" />}
        {options.isPending && settingsAreCurrent && (
          <Skeleton className="h-8" label="Loading settings options" />
        )}
        {options.isError && (
          <ErrorNotice error={options.error} title="Could not load valid settings" />
        )}
        {options.data?.problems.map((problem) => (
          <Notice key={problem} tone="warn">
            {problem}
          </Notice>
        ))}
        <Fieldset legend="Market">
          <ScopePicker
            scope={scope}
            onChange={updateScope}
            parts={MARKET_PARTS}
            disabled={options.isPending || options.isError}
          />
        </Fieldset>
        <Fieldset legend="Portfolio settings">
          {scopeOptions.neutralizations.length ? (
            <Select
              label="Neutralization"
              value={stringSetting(
                'neutralization',
                scopeOptions.neutralizations[0]?.value ?? 'NONE',
              )}
              onChange={(value) => updateSetting('neutralization', value)}
              items={scopeOptions.neutralizations}
              disabled={options.isPending || options.isError}
            />
          ) : (
            <Skeleton className="h-8 w-64" label="Loading neutralizations" />
          )}
        </Fieldset>
        <SimulationSettingsFields
          decay={String(settings['decay'] ?? 0)}
          setDecay={(value) => updateSetting('decay', Math.max(0, Number(value) || 0))}
          truncation={String(settings['truncation'] ?? 0.08)}
          setTruncation={(value) => updateSetting('truncation', Number(value) || 0)}
          pasteurization={stringSetting('pasteurization', 'ON') as 'ON' | 'OFF'}
          setPasteurization={(value) => updateSetting('pasteurization', value)}
          unitHandling={stringSetting('unitHandling', 'VERIFY')}
          setUnitHandling={(value) => updateSetting('unitHandling', value)}
          unitHandlingChoices={fieldChoices('unitHandling')}
          nanHandling={stringSetting('nanHandling', 'ON') as 'ON' | 'OFF'}
          setNanHandling={(value) => updateSetting('nanHandling', value)}
          testYears={testYears}
          setTestYears={(value) => updateSetting('testPeriod', testPeriodOf(value, testMonths))}
          testMonths={testMonths}
          setTestMonths={(value) => updateSetting('testPeriod', testPeriodOf(testYears, value))}
        />
        <Fieldset
          legend="Investability"
          hint="Max Trade and Max Position cap positions by liquidity; BRAIN takes one at a time."
        >
          <div className="flex flex-wrap gap-4">
            {(['maxTrade', 'maxPosition'] as const).map((name) => {
              const choices = fieldChoices(name)
              const current = stringSetting(name, '')
              const label = name === 'maxTrade' ? 'Max Trade' : 'Max Position'
              return (
                <Field key={name} label={label} className="min-w-52">
                  {choices.length > 0 ? (
                    <Select
                      label={label}
                      value={current}
                      onChange={(value) => updateSetting(name, value)}
                      items={[
                        ...(!choices.some((item) => item.value === current) && current
                          ? [{ value: current, label: `${current} (current)` }]
                          : []),
                        ...choices,
                      ]}
                      disabled={options.isPending || options.isError}
                    />
                  ) : (
                    <Input
                      type="text"
                      aria-label={label}
                      value={current}
                      onChange={(event) => updateSetting(name, event.target.value)}
                      disabled={options.isPending || options.isError}
                    />
                  )}
                </Field>
              )
            })}
          </div>
        </Fieldset>
        {fieldChoices('language').length > 0 && (
          <Field label="Expression language" className="max-w-72">
            <Select
              label="Expression language"
              value={stringSetting('language', 'FASTEXPR')}
              onChange={(value) => updateSetting('language', value)}
              items={fieldChoices('language')}
            />
          </Field>
        )}
        {options.data?.missing.map((missing) => (
          <Notice key={missing} tone="warn">
            {missing}
          </Notice>
        ))}
      </Panel>
      <Panel
        title="Run"
        description="A focused run is submitted as one simulation, separately from research-task batches."
        bodyClassName="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center gap-4">
          <Segmented
            label="Simulation mode"
            items={MODES.filter((item) => item.value !== 'QUICK' || quickAllowed)}
            value={mode === 'QUICK' && !quickAllowed ? 'FULL' : mode}
            onChange={setMode}
          />
          <label className="flex items-center gap-2 text-body-compact text-ink">
            <input
              type="checkbox"
              checked={reserveCore}
              onChange={(event) => setReserveCore(event.target.checked)}
            />
            Reserve one core for this run
          </label>
          <Button
            variant="primary"
            loading={run.isPending}
            disabled={
              active ||
              !expressionsReady ||
              !settingsReady ||
              (mode === 'QUICK' && !quickAllowed) ||
              (oneCoreOnly && reserveCore)
            }
            onClick={() => run.mutate()}
          >
            Run simulation
          </Button>
        </div>
        {oneCoreOnly && reserveCore && (
          <Notice tone="info">
            This setting uses multiple BRAIN slots, so turn off core reservation to run it.
          </Notice>
        )}
        {engine.isPending && <Skeleton className="h-6" label="Loading core status" />}
        {engine.isError && <ErrorNotice error={engine.error} title="Could not read core status" />}
        {run.isError && <ErrorNotice error={run.error} title="Could not queue the simulation" />}
        {record.isError && (
          <ErrorNotice error={record.error} title="Could not read simulation status" />
        )}
        {record.data && (
          <SimulationResult
            row={record.data}
            active={active}
            cancelling={cancel.isPending}
            onCancel={() => cancel.mutate(record.data.id)}
          />
        )}
        {cancel.isError && (
          <ErrorNotice error={cancel.error} title="Could not cancel the simulation" />
        )}
      </Panel>
      {resultAlphaId && (
        <Panel
          title={`Simulation feedback · ${resultAlphaId}`}
          description="BRAIN's result metrics and checks for the Alpha created by this run."
          bodyClassName="flex flex-col gap-4"
        >
          {result.isPending && <Skeleton className="h-32" label="Loading Alpha feedback" />}
          {result.isError && (
            <ErrorNotice
              error={result.error}
              title="Could not read the resulting Alpha from BRAIN"
            />
          )}
          {result.data && <AlphaFeedback result={result.data} />}
        </Panel>
      )}
    </Page>
  )
}

function FocusedExpressionEditor({
  label,
  value,
  onChange,
  scope,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  scope: Scope
}) {
  const [view, setView] = useState<'code' | 'blocks'>('code')
  const operators = useQuery({
    queryKey: ['template-lab', 'options'],
    queryFn: () => templateLab.options(),
    staleTime: 5 * 60_000,
  })
  const reference: OperatorDoc[] = operators.data?.reference ?? []

  return (
    <div className="flex flex-col gap-2">
      <Segmented
        label={`${label} editor`}
        items={[
          { value: 'code', label: 'Code' },
          { value: 'blocks', label: 'Blocks' },
        ]}
        value={view}
        onChange={setView}
      />
      {operators.isError && (
        <>
          <ErrorNotice error={operators.error} title="Could not load operator details" />
          <Notice tone="info">
            Code editing remains available; Blocks may have fewer choices.
          </Notice>
        </>
      )}
      {view === 'blocks' ? (
        <TemplateBlocks
          text={value}
          onChange={onChange}
          reference={reference}
          variables={[]}
          scope={scope}
          onCode={() => setView('code')}
        />
      ) : (
        <TemplateEditor
          value={value}
          label={label}
          onChange={onChange}
          reference={reference}
          presets={{}}
          variables={{}}
          infos={new Map()}
          problems={[]}
          scope={scope}
        />
      )}
    </div>
  )
}

function AlphaFeedback({ result }: { result: AlphaView }) {
  const { alpha } = result
  const stats = alpha.inSample
  const checks = alpha.checks
  const verdict = verdictOf(alpha)
  const verdictLabel = {
    submitted: 'Submitted on BRAIN',
    blocked: 'Not ready to submit',
    pending: 'Checks pending',
    ready: 'Ready to submit',
  }[verdict.kind]
  const passed = checks.filter((check) => check.result === 'PASS').length
  const failed = checks.filter(
    (check) => check.result === 'FAIL' || check.result === 'ERROR',
  ).length
  const pending = checks.filter((check) => !check.result || check.result === 'PENDING').length

  return (
    <>
      {result.problems.map((problem) => (
        <Notice key={problem} tone="warn">
          {problem}
        </Notice>
      ))}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Sharpe" value={fmt.ratio(stats?.sharpe)} boxed />
        <Metric label="Fitness" value={fmt.ratio(stats?.fitness)} boxed />
        <Metric label="Turnover" value={fmt.pct(stats?.turnover, 2)} boxed />
        <Metric label="Returns" value={fmt.pct(stats?.returns, 2)} boxed />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-compact text-ink-subtle">
        <span>Verdict: {verdictLabel}</span>
        <span>
          Checks: {checks.length} reported · {passed} passed · {failed} failed · {pending} pending
        </span>
      </div>
      {checks.length > 0 ? (
        <ul className="divide-y divide-hairline rounded-sm border border-hairline">
          {checks.map((check, index) => {
            const state = check.result ?? 'PENDING'
            const details = [
              check.value != null &&
                `Value: ${isNum(check.value) ? fmt.ratio(check.value, 3) : String(check.value)}`,
              check.limit != null &&
                `Limit: ${isNum(check.limit) ? fmt.ratio(check.limit, 3) : String(check.limit)}`,
            ].filter(Boolean)
            const tone =
              state === 'PASS'
                ? 'text-pnl-positive-text'
                : state === 'FAIL' || state === 'ERROR'
                  ? 'text-pnl-negative-text'
                  : 'text-ink-subtle'
            return (
              <li
                key={`${check.name}-${index}`}
                className="flex flex-wrap items-start justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-body-compact font-medium text-ink">
                    {checkName(check.name)}
                  </div>
                  {check.message && (
                    <div className="text-body-compact text-ink-subtle">{check.message}</div>
                  )}
                  {details.length > 0 && (
                    <div className="text-caption text-ink-subtle">{details.join(' · ')}</div>
                  )}
                </div>
                <div className={`flex shrink-0 gap-2 text-body-compact ${tone}`}>
                  <span>{state}</span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <Notice tone="info">BRAIN has not reported any checks for this Alpha yet.</Notice>
      )}
    </>
  )
}

function SimulationResult({
  row,
  active,
  cancelling,
  onCancel,
}: {
  row: SimulationRow
  active: boolean
  cancelling: boolean
  onCancel: () => void
}) {
  const statusLabel: Record<SimulationRow['status'], string> = {
    QUEUED: 'Waiting in Alpha Harness queue',
    PENDING: 'Submitted to BRAIN; waiting to start',
    RUNNING: 'Running on BRAIN',
    COMPLETE: 'Completed',
    WARNING: 'Completed with warnings',
    ERROR: 'BRAIN reported an error',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    TIMEOUT: 'Timed out',
    ORPHANED: 'Run status lost',
    REJECTED: 'Rejected by BRAIN',
    SKIPPED: 'Existing result reused',
  }
  const progress = isNum(row.progress) ? Math.min(1, Math.max(0, row.progress)) : null

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-hairline bg-surface-1 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-body font-medium text-ink">{statusLabel[row.status]}</span>
          {row.message && <span className="text-body-compact text-ink-subtle">{row.message}</span>}
          {row.platformStatus && (
            <span className="text-body-compact text-ink-subtle">
              BRAIN status: {row.platformStatus}
            </span>
          )}
          {row.alphaId && !active && (
            <Link
              to="/alpha/$alphaId"
              params={{ alphaId: row.alphaId }}
              className="text-body-compact text-ink-subtle underline-offset-2 hover:underline"
            >
              Open resulting Alpha {row.alphaId}
            </Link>
          )}
        </div>
        {active && (
          <Button size="sm" variant="secondary" loading={cancelling} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {row.status === 'RUNNING' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-body-compact text-ink-subtle">
            <span>
              {progress === null ? 'Progress' : `${(progress * 100).toFixed(0)}% complete`}
            </span>
            <span>{fmt.duration(row.elapsedSeconds)}</span>
          </div>
          <Progress value={progress} label="BRAIN simulation progress" />
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-subtle">
        {row.createdAt && <span>Queued {fmt.dateTime(row.createdAt)}</span>}
        {row.submittedAt && <span>Submitted to BRAIN {fmt.dateTime(row.submittedAt)}</span>}
        {row.finishedAt && <span>Finished {fmt.dateTime(row.finishedAt)}</span>}
        {!active && isNum(row.elapsedSeconds) && (
          <span>Elapsed {fmt.duration(row.elapsedSeconds)}</span>
        )}
        {active && row.status !== 'RUNNING' && row.elapsedSeconds != null && (
          <span>Elapsed {fmt.duration(row.elapsedSeconds)}</span>
        )}
        {!active && !row.alphaId && !row.message && <span>No resulting Alpha was reported.</span>}
      </div>
    </div>
  )
}
