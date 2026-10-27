/** Super Alpha Lab: SuperAlphas built from your own submitted Alphas, every pairing in one task. */

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { CheckIcon, CopyIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { catalog } from '@/api/catalog'
import type { components } from '@/api/generated'
import { http } from '@/api/http'
import { fmt } from '@/lib/format'
import { type Choice, REGION_AGNOSTIC, useScope, useScopeOptions } from '@/lib/scope'
import { AddTaskButtons, useAddTask } from '@/screens/research-labs/add-task'
import { NeutralizationPicker } from '@/screens/research-labs/neutralization'
import { SimulationSettingsFields, testPeriodOf } from '@/screens/research-labs/simulation-settings'
import { CoresSetting } from '@/screens/research-labs/task-settings'
import { INVESTABILITY_LABELS, templateLab } from '@/screens/research-labs/template/api'
import { ExpressionCode, TemplateEditor } from '@/screens/research-labs/template/editor'
import {
  Button,
  Chips,
  Disclosure,
  ErrorNotice,
  Field,
  Fieldset,
  Input,
  Metric,
  Notice,
  Page,
  PageHeader,
  Panel,
  Segmented,
  Skeleton,
} from '@/ui/kit'
import { ScopePicker } from '@/ui/scope-picker'

type Schemas = components['schemas']
type Investability = NonNullable<Schemas['SuperTask']['investability']>[number]
type Activation = Schemas['SuperTask']['activation']

const ACTIVATIONS: { value: NonNullable<Activation>; label: string }[] = [
  { value: 'BOTH', label: 'IS and OS' },
  { value: 'IS', label: 'IS' },
  { value: 'OS', label: 'OS' },
]
const MIN_LIMIT = 10
const MAX_LIMIT = 200
const MAX_DECAY = 512
const MAX_TRUNCATION = 1
const DEFAULT_DECAY = 0
const DEFAULT_TRUNCATION = 0.08
const UNIT_HANDLING: Choice[] = [
  { value: 'VERIFY', label: 'Verify' },
  { value: 'WARNING', label: 'Warning' },
]
const DEFAULT_TEST_YEARS = '2'
const DEFAULT_TEST_MONTHS = '0'
const MAX_CUSTOM_RECIPES = 5
const EXPRESSION_TABS: { value: 'submitted' | 'custom'; label: string }[] = [
  { value: 'submitted', label: 'Submitted expressions' },
  { value: 'custom', label: 'Custom expressions' },
]
const CUSTOM_EXPRESSION_TYPES: { value: 'selection' | 'combo'; label: string }[] = [
  { value: 'selection', label: 'Selection' },
  { value: 'combo', label: 'Combo' },
]

export function SuperAlphaLabScreen() {
  const [scope, setScope] = useScope('/labs/super-alpha')
  const options = useScopeOptions(scope)
  const syncedScopes = useQuery({ queryKey: ['catalog', 'scopes'], queryFn: catalog.scopes })
  const [universes, setUniverses] = useState<string[]>([])
  const [neutralizations, setNeutralizations] = useState<string[]>([])
  const [limit, setLimit] = useState(30)
  const [decay, setDecay] = useState(String(DEFAULT_DECAY))
  const [truncation, setTruncation] = useState(String(DEFAULT_TRUNCATION))
  const [pasteurization, setPasteurization] = useState<'ON' | 'OFF'>('ON')
  const [unitHandling, setUnitHandling] = useState('VERIFY')
  const [nanHandling, setNanHandling] = useState<'ON' | 'OFF'>('ON')
  const [testYears, setTestYears] = useState(DEFAULT_TEST_YEARS)
  const [testMonths, setTestMonths] = useState(DEFAULT_TEST_MONTHS)
  const [investability, setInvestability] = useState<Investability[]>([])
  const [activation, setActivation] = useState<NonNullable<Activation>>('BOTH')
  const [cores, setCores] = useState(3)
  const [selectionCode, setSelectionCode] = useState('')
  const [comboCode, setComboCode] = useState('')
  const [customSelections, setCustomSelections] = useState<Schemas['Recipe'][]>([])
  const [customCombos, setCustomCombos] = useState<Schemas['Recipe'][]>([])
  const [expressionTab, setExpressionTab] = useState<'submitted' | 'custom'>('submitted')
  const [customExpressionType, setCustomExpressionType] = useState<'selection' | 'combo'>(
    'selection',
  )
  const [selectionSearch, setSelectionSearch] = useState('')
  const [comboSearch, setComboSearch] = useState('')

  const agnostic = scope.region === REGION_AGNOSTIC
  const limitValid = Number.isInteger(limit) && limit >= MIN_LIMIT && limit <= MAX_LIMIT
  const decayValue = Number(decay)
  const truncationValue = Number(truncation)
  const decayValid =
    decay.trim() !== '' &&
    Number.isInteger(decayValue) &&
    decayValue >= 0 &&
    decayValue <= MAX_DECAY
  const truncationValid =
    truncation.trim() !== '' &&
    Number.isFinite(truncationValue) &&
    truncationValue >= 0 &&
    truncationValue <= MAX_TRUNCATION
  const testYearsNumber = Number(testYears)
  const testMonthsNumber = Number(testMonths)
  const testPeriodValid =
    testYears.trim() !== '' &&
    Number.isInteger(testYearsNumber) &&
    testYearsNumber >= 0 &&
    testYearsNumber <= 6 &&
    testMonths.trim() !== '' &&
    Number.isInteger(testMonthsNumber) &&
    testMonthsNumber >= 0 &&
    testMonthsNumber <= 11
  const accountUnitHandling = options.settings['unitHandling'] ?? []
  const unitHandlingChoices = accountUnitHandling.length > 0 ? accountUnitHandling : UNIT_HANDLING
  const actualUnitHandling =
    unitHandlingChoices.find((choice) => choice.value === unitHandling)?.value ??
    unitHandlingChoices.find((choice) => choice.value === 'VERIFY')?.value ??
    unitHandlingChoices[0]?.value ??
    'VERIFY'
  const body = {
    region: scope.region,
    delay: scope.delay,
    universes,
    neutralizations,
    selectionLimit: limit,
    decay: decayValid ? decayValue : DEFAULT_DECAY,
    truncation: truncationValid ? truncationValue : DEFAULT_TRUNCATION,
    pasteurization,
    unitHandling: actualUnitHandling,
    nanHandling,
    testPeriod: testPeriodValid ? testPeriodOf(testYears, testMonths) : 'P2Y0M0D',
    investability,
    activation,
    cores,
    customSelections,
    customCombos,
  }

  const plan = useQuery({
    queryKey: ['super-lab', 'plan', body],
    queryFn: () =>
      http.post<Schemas['SuperPlan']>('/api/super-lab/plan', {
        ...body,
        selectionLimit: limitValid ? limit : MIN_LIMIT,
      }),
    placeholderData: keepPreviousData,
  })
  const availableUniverses = options.universes
    .filter((choice) =>
      (syncedScopes.data ?? []).some(
        (market) =>
          market.instrument_type === scope.instrumentType &&
          market.region === scope.region &&
          market.delay === scope.delay &&
          market.universe === choice.value,
      ),
    )
    .map((choice) => choice.value)
  const availableInvestability = plan.data?.investability ?? []
  const selectionRun = useMutation({
    mutationFn: (selection: string) =>
      http.post<Schemas['SelectionCount']>('/api/super-lab/selection', {
        region: scope.region,
        delay: scope.delay,
        selection,
        selectionLimit: limitValid ? limit : MIN_LIMIT,
      }),
  })
  const submitted = useQuery({
    queryKey: ['super-lab', 'submitted-expressions'],
    queryFn: () =>
      http.get<Schemas['SubmittedExpressions']>('/api/super-lab/submitted-expressions'),
    enabled: false,
  })
  const templateOptions = useQuery({
    queryKey: ['template-lab', 'options'],
    queryFn: () => templateLab.options(),
    staleTime: 5 * 60_000,
  })
  const selectedInvestability = plan.data?.selectedInvestability ?? []
  const selectedUniverses = availableUniverses.filter((value) => universes.includes(value))
  const selectedNeutralizations = options.neutralizations
    .filter((choice) => neutralizations.includes(choice.value))
    .map((choice) => choice.value)
  const add = useAddTask(() =>
    http.post<Schemas['AddedTask']>('/api/super-lab/tasks', {
      ...body,
      universes: selectedUniverses,
      neutralizations: selectedNeutralizations,
      investability: selectedInvestability,
    }),
  )
  const selectionExpressions = submitted.data?.selections ?? []
  const comboExpressions = submitted.data?.combos ?? []
  const hasSelection = customSelections.length > 0
  const hasCombo = customCombos.length > 0
  const ready =
    !agnostic &&
    limitValid &&
    decayValid &&
    truncationValid &&
    testPeriodValid &&
    options.ready &&
    !plan.isPlaceholderData &&
    !!plan.data &&
    plan.data.problems.length === 0 &&
    selectedInvestability.length > 0 &&
    selectedUniverses.length > 0 &&
    selectedNeutralizations.length > 0 &&
    hasSelection &&
    hasCombo

  return (
    <Page>
      <PageHeader
        title="Super Alpha Lab"
        description="Combines your submitted Alphas into SuperAlphas, ready to submit"
        actions={<AddTaskButtons add={add} disabled={!ready} />}
      />

      <Panel
        title="Market"
        description="Only your submitted ACTIVE Alphas of this region and delay can be selected."
      >
        <div className="flex flex-wrap items-end gap-4">
          <ScopePicker
            scope={scope}
            parts={['region', 'delay']}
            onChange={(next) => {
              selectionRun.reset()
              setScope(next)
            }}
          />
          {agnostic && (
            <Notice
              tone="error"
              title="A SuperAlpha combines Alphas of one region. Pick a region other than All Regions."
            />
          )}
          <Field label="Selection Limit" className="w-32">
            <Input
              type="number"
              min={MIN_LIMIT}
              max={MAX_LIMIT}
              value={Number.isNaN(limit) ? '' : String(limit)}
              onChange={(e) => {
                selectionRun.reset()
                setLimit(e.target.valueAsNumber)
              }}
              className="w-full num"
              aria-describedby="selection-limit-hint"
            />
          </Field>
        </div>
        {!limitValid && (
          <Notice
            tone="error"
            title={`Selection Limit must be a whole number from ${MIN_LIMIT} to ${MAX_LIMIT}.`}
            className="mt-3"
          />
        )}
      </Panel>

      <Panel
        title="Expressions"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {expressionTab === 'submitted' && (
              <Button
                size="sm"
                variant="primary"
                loading={submitted.isFetching}
                onClick={() => void submitted.refetch()}
              >
                {submitted.data ? 'Refresh expressions' : 'Load expressions'}
              </Button>
            )}
            <Segmented
              label="Expression source"
              items={EXPRESSION_TABS}
              value={expressionTab}
              onChange={setExpressionTab}
            />
          </div>
        }
      >
        <div className={expressionTab === 'submitted' ? 'contents' : 'hidden'}>
          {submitted.isError && (
            <ErrorNotice error={submitted.error} title="Could not load submitted expressions" />
          )}
          {submitted.data && (
            <div className="flex flex-col gap-4">
              {submitted.data.omitted > 0 && (
                <Notice
                  tone="info"
                  title={`${submitted.data.omitted} submitted expression${submitted.data.omitted === 1 ? '' : 's'} exceeded the 2,000-character limit and could not be imported.`}
                />
              )}
              {submitted.data.truncated && (
                <Notice
                  tone="info"
                  title="Only the newest submitted SuperAlphas were loaded because BRAIN limits how far this list can be paged."
                />
              )}
              {submitted.data.selections.length === 0 && submitted.data.combos.length === 0 && (
                <Notice
                  tone="info"
                  title="No submitted SuperAlpha selection or combo expressions were found."
                />
              )}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <ExpressionCatalog
              title="Selection expressions"
              recipes={selectionExpressions}
              search={selectionSearch}
              onSearch={setSelectionSearch}
              added={customSelections}
              onAdd={(recipe) =>
                setCustomSelections((current) =>
                  current.some((item) => item.code === recipe.code) ||
                  current.length >= MAX_CUSTOM_RECIPES
                    ? current
                    : [...current, { name: recipe.name, code: recipe.code }],
                )
              }
            />
            <ExpressionCatalog
              title="Combo expressions"
              recipes={comboExpressions}
              search={comboSearch}
              onSearch={setComboSearch}
              added={customCombos}
              onAdd={(recipe) =>
                setCustomCombos((current) =>
                  current.some((item) => item.code === recipe.code) ||
                  current.length >= MAX_CUSTOM_RECIPES
                    ? current
                    : [...current, { name: recipe.name, code: recipe.code }],
                )
              }
            />
          </div>
        </div>
        <div className={expressionTab === 'custom' ? 'contents' : 'hidden'}>
          <section className="flex min-w-0 flex-col items-start gap-3">
            <Segmented
              label="Custom expression type"
              items={CUSTOM_EXPRESSION_TYPES}
              value={customExpressionType}
              onChange={(value) => {
                selectionRun.reset()
                setCustomExpressionType(value)
              }}
            />
            {templateOptions.isError && (
              <ErrorNotice
                error={templateOptions.error}
                title="Could not load operators; operator names cannot be checked"
              />
            )}
            <div className="w-full">
              <TemplateEditor
                value={customExpressionType === 'selection' ? selectionCode : comboCode}
                label={`${customExpressionType === 'selection' ? 'Selection' : 'Combo'} expression`}
                maxLength={2000}
                onChange={(value) => {
                  if (customExpressionType === 'selection') {
                    selectionRun.reset()
                    setSelectionCode(value)
                  } else {
                    setComboCode(value)
                  }
                }}
                reference={templateOptions.data?.reference ?? []}
                presets={{}}
                variables={{}}
                infos={new Map()}
                problems={[]}
                scope={scope}
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Button
                size="md"
                variant="primary"
                disabled={
                  !(customExpressionType === 'selection' ? selectionCode : comboCode).trim() ||
                  (customExpressionType === 'selection' &&
                    customSelections.length >= MAX_CUSTOM_RECIPES) ||
                  (customExpressionType === 'combo' && customCombos.length >= MAX_CUSTOM_RECIPES)
                }
                onClick={() => {
                  if (customExpressionType === 'selection') {
                    setCustomSelections((current) => [
                      ...current,
                      {
                        name: `Selection ${current.length + 1}`,
                        code: selectionCode.trim(),
                      },
                    ])
                    selectionRun.reset()
                    setSelectionCode('')
                  } else {
                    setCustomCombos((current) => [
                      ...current,
                      {
                        name: `Combo ${current.length + 1}`,
                        code: comboCode.trim(),
                      },
                    ])
                    setComboCode('')
                  }
                }}
              >
                Add {customExpressionType}
              </Button>
              {customExpressionType === 'selection' && (
                <Button
                  size="md"
                  loading={selectionRun.isPending}
                  disabled={!selectionCode.trim() || !limitValid || agnostic}
                  onClick={() => selectionRun.mutate(selectionCode.trim())}
                >
                  Run Selection
                </Button>
              )}
            </div>
            {customExpressionType === 'selection' && (
              <>
                {selectionRun.isError && (
                  <ErrorNotice
                    error={selectionRun.error}
                    title="Could not run the selection expression"
                  />
                )}
                {selectionRun.data && !selectionRun.isPending && (
                  <Metric boxed label="Selected Alphas" value={fmt.int(selectionRun.data.count)} />
                )}
              </>
            )}
            {customExpressionType === 'selection' ? (
              <CustomRecipes
                recipes={customSelections}
                onRemove={(index) =>
                  setCustomSelections((current) => current.filter((_, i) => i !== index))
                }
              />
            ) : (
              <CustomRecipes
                recipes={customCombos}
                onRemove={(index) =>
                  setCustomCombos((current) => current.filter((_, i) => i !== index))
                }
              />
            )}
          </section>
        </div>
        {!hasSelection || !hasCombo ? (
          <Notice
            tone="error"
            title="Add at least one selection expression and one combo expression to create a task."
          />
        ) : null}
      </Panel>

      <Panel
        title="Simulation Settings"
        description="Universe, Neutralization and Investability are searched: tick one or several. The rest hold one value for every simulation."
      >
        <div className="flex flex-col gap-4">
          <Fieldset legend="Universe">
            {syncedScopes.isError ? (
              <ErrorNotice error={syncedScopes.error} title="Could not load synced Universes" />
            ) : options.ready && syncedScopes.data ? (
              availableUniverses.length ? (
                <Chips
                  label="Universe"
                  items={availableUniverses.map((value) => ({
                    value,
                    label: value,
                  }))}
                  value={selectedUniverses}
                  onChange={(next) =>
                    setUniverses([
                      ...universes.filter((value) => !availableUniverses.includes(value)),
                      ...next,
                    ])
                  }
                  disabled={agnostic}
                />
              ) : (
                <span className="text-body-compact text-ink-subtle">
                  No synced Universes for this region and delay.
                </span>
              )
            ) : (
              <Skeleton className="h-8 w-64" />
            )}
          </Fieldset>
          {options.neutralizations.length > 0 && (
            <NeutralizationPicker
              available={options.neutralizations}
              value={neutralizations}
              onChange={setNeutralizations}
              disabled={agnostic}
            />
          )}
          <Fieldset
            legend="Investability"
            hint="Max Trade and Max Position cap positions by liquidity; BRAIN runs them one at a time."
          >
            {plan.data ? (
              <Chips
                label="Investability"
                items={availableInvestability.map((value) => ({
                  value,
                  label: INVESTABILITY_LABELS[value],
                }))}
                value={investability.filter((value) => availableInvestability.includes(value))}
                onChange={(next) =>
                  setInvestability([
                    ...investability.filter((value) => !availableInvestability.includes(value)),
                    ...next,
                  ])
                }
                disabled={agnostic || plan.isPlaceholderData}
              />
            ) : (
              <Skeleton className="h-8 w-64" />
            )}
          </Fieldset>
          <SimulationSettingsFields
            decay={decay}
            setDecay={setDecay}
            truncation={truncation}
            setTruncation={setTruncation}
            pasteurization={pasteurization}
            setPasteurization={setPasteurization}
            unitHandling={actualUnitHandling}
            setUnitHandling={setUnitHandling}
            unitHandlingChoices={unitHandlingChoices}
            nanHandling={nanHandling}
            setNanHandling={setNanHandling}
            testYears={testYears}
            setTestYears={setTestYears}
            testMonths={testMonths}
            setTestMonths={setTestMonths}
          />
          <Fieldset legend="Component Activation">
            <Segmented
              label="Component Activation"
              items={ACTIVATIONS}
              value={activation}
              onChange={setActivation}
            />
          </Fieldset>
          {plan.isError && (
            <ErrorNotice error={plan.error} title="Could not plan simulation settings" />
          )}
          {plan.data?.problems.map((problem) => (
            <Notice key={problem} tone="error" title={problem} />
          ))}
        </div>
        {!decayValid && (
          <Notice
            tone="error"
            title={`Decay must be a whole number from 0 to ${MAX_DECAY}.`}
            className="mt-3"
          />
        )}
        {!truncationValid && (
          <Notice
            tone="error"
            title={`Truncation must be a number from 0 to ${MAX_TRUNCATION}.`}
            className="mt-3"
          />
        )}
        {!testPeriodValid && (
          <Notice
            tone="error"
            title="Test Period must be from 0 to 6 years and 0 to 11 months."
            className="mt-3"
          />
        )}
      </Panel>

      <Panel title="Cores">
        <CoresSetting value={cores} onChange={setCores} />
      </Panel>

      <Panel
        title="What Runs"
        description="Every selected expression with every selected combo runs at the settings shown. Each runs in Full mode, so BRAIN's own checks say which are submittable: those show green in Tasks and reach the Submission Planner."
      >
        {plan.isError && <ErrorNotice error={plan.error} title="Could not plan the task" />}
        {plan.data && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <Metric boxed label="SuperAlpha Simulations" value={fmt.int(plan.data.simulations)} />
              <Metric
                boxed
                label="Universes"
                value={selectedUniverses.join(', ') || 'None selected'}
              />
              <Metric
                boxed
                label="Neutralizations"
                value={selectedNeutralizations.join(', ') || 'None selected'}
              />
              <Metric boxed label="Decay" value={String(plan.data.decay)} />
              <Metric boxed label="Truncation" value={String(plan.data.truncation)} />
              <Metric boxed label="Pasteurization" value={plan.data.pasteurization} />
              <Metric boxed label="Unit Handling" value={plan.data.unitHandling} />
              <Metric boxed label="NaN Handling" value={plan.data.nanHandling} />
              <Metric boxed label="Test Period" value={plan.data.testPeriod} />
              <Metric
                boxed
                label="Investability"
                value={
                  selectedInvestability.map((value) => INVESTABILITY_LABELS[value]).join(', ') ||
                  'None selected'
                }
              />
              <Metric
                boxed
                label="Component Activation"
                value={plan.data.activation === 'BOTH' ? 'IS and OS' : plan.data.activation}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Disclosure summary={`Selections (${plan.data.selections.length})`}>
                <Recipes recipes={plan.data.selections} />
              </Disclosure>
              <Disclosure summary={`Combos (${plan.data.combos.length})`}>
                <Recipes recipes={plan.data.combos} />
              </Disclosure>
            </div>
            <Notice
              tone="info"
              title="Each selection caps an Alpha's operators at 8,000 divided by the Selection Limit, so the selected Alphas never pass BRAIN's 8,000-operator ceiling. Submitting stays on BRAIN, with a description of the selection and the combo."
            />
          </div>
        )}
      </Panel>
    </Page>
  )
}

function ExpressionCatalog({
  title,
  recipes,
  search,
  onSearch,
  added,
  onAdd,
}: {
  title: string
  recipes: Schemas['SubmittedExpression'][]
  search: string
  onSearch: (value: string) => void
  added: Schemas['Recipe'][]
  onAdd: (recipe: Schemas['SubmittedExpression']) => void
}) {
  const query = search.trim().toLocaleLowerCase()
  const matching = recipes.filter((recipe) =>
    [recipe.code, ...recipe.sources].some((value) => value.toLocaleLowerCase().includes(query)),
  )

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="text-title">{title}</h3>
      <div className="relative w-full">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={`Search ${title.toLocaleLowerCase()} or source Alpha`}
          aria-label={`Search ${title.toLocaleLowerCase()} or source Alpha`}
          className="w-full pl-9"
          disabled={recipes.length === 0}
        />
      </div>
      <div className="flex max-h-[15rem] min-h-24 flex-col gap-2 overflow-y-auto pr-1">
        {recipes.length === 0 ? (
          <p className="py-3 text-body-compact text-ink-subtle">No expressions available.</p>
        ) : matching.length === 0 ? (
          <p className="py-3 text-body-compact text-ink-subtle">
            No expressions match this search.
          </p>
        ) : (
          matching.map((recipe) => {
            const isAdded = added.some((item) => item.code === recipe.code)
            const canAdd = added.length < MAX_CUSTOM_RECIPES
            const source = recipe.sources[0]?.split(' · ').at(-1)
            const copy = async () => {
              const value = source ? `${recipe.code}\n// AlphaID: ${source}` : recipe.code
              try {
                await navigator.clipboard.writeText(value)
                toast.success(source ? 'Copied expression and Alpha ID' : 'Copied expression')
              } catch {
                toast.error('Could not copy to clipboard')
              }
            }
            return (
              <article
                key={recipe.code}
                className="flex min-w-0 items-center gap-3 rounded-md border border-hairline bg-surface-2/50 p-2.5 transition-colors hover:bg-surface-2"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <ExpressionCode value={recipe.code} />
                  {source && (
                    <code className="num break-all text-caption text-ink-subtle">{source}</code>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="bg-surface-3/70 text-ink-subtle transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-subtle hover:text-ink active:translate-y-0 active:scale-95"
                    aria-label="Copy expression and Alpha ID"
                    title="Copy expression and Alpha ID"
                    onClick={() => void copy()}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className={`bg-surface-3/70 transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-subtle hover:text-ink active:translate-y-0 active:scale-95 ${isAdded ? 'text-pnl-positive-text' : 'text-ink-subtle'}`}
                    disabled={!isAdded && !canAdd}
                    aria-label={isAdded ? 'Expression added' : 'Add expression'}
                    title={isAdded ? 'Expression added' : 'Add expression'}
                    onClick={() => onAdd(recipe)}
                  >
                    {isAdded ? <CheckIcon /> : <PlusIcon />}
                  </Button>
                </div>
              </article>
            )
          })
        )}
      </div>
      {recipes.length > 0 && (
        <span className="text-caption text-ink-subtle">
          {fmt.int(matching.length)} of {fmt.int(recipes.length)} unique expressions
        </span>
      )}
    </section>
  )
}

function CustomRecipes({
  recipes,
  onRemove,
}: {
  recipes: Schemas['Recipe'][]
  onRemove: (index: number) => void
}) {
  if (recipes.length === 0) return null
  return (
    <section className="w-full border-t border-hairline pt-3">
      <ul className="flex flex-col divide-y divide-hairline-subtle">
        {recipes.map((recipe, index) => (
          <li
            key={`${recipe.code}-${index}`}
            className="flex items-start justify-between gap-3 py-2"
          >
            <code className="num min-w-0 whitespace-pre-wrap break-all text-caption text-ink-muted">
              {recipe.code}
            </code>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove expression"
              title="Remove expression"
              onClick={() => onRemove(index)}
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Recipes({ recipes }: { recipes: Schemas['Recipe'][] }) {
  return (
    <ul className="flex flex-col gap-3">
      {recipes.map((r) => (
        <li key={r.name} className="flex flex-col gap-1">
          <span className="text-body-compact font-medium text-ink">{r.name}</span>
          <code className="num text-body-compact whitespace-pre-wrap break-all text-ink-muted">
            {r.code}
          </code>
        </li>
      ))}
    </ul>
  )
}
