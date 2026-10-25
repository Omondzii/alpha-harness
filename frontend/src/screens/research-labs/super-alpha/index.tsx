/** Super Alpha Lab: SuperAlphas built from your own submitted Alphas, every pairing in one task. */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CheckIcon, CopyIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { components } from '@/api/generated'
import { http } from '@/api/http'
import { fmt } from '@/lib/format'
import { REGION_AGNOSTIC, useScope, useScopeOptions } from '@/lib/scope'
import { AddTaskButtons, useAddTask } from '@/screens/research-labs/add-task'
import { templateLab } from '@/screens/research-labs/template/api'
import { TemplateEditor } from '@/screens/research-labs/template/editor'
import {
  Button,
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
} from '@/ui/kit'
import { Select } from '@/ui/overlay'
import { ScopePicker } from '@/ui/scope-picker'

type Schemas = components['schemas']
type Activation = Schemas['SuperTask']['activation']

const ACTIVATIONS: { value: NonNullable<Activation>; label: string }[] = [
  { value: 'BOTH', label: 'IS and OS' },
  { value: 'IS', label: 'IS' },
  { value: 'OS', label: 'OS' },
]
/** BRAIN runs at most three SuperAlpha simulations per person at once. */
const CORES = [1, 2, 3].map((n) => ({ value: n, label: String(n) }))
const MIN_LIMIT = 10
const MAX_LIMIT = 200
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
  const [picked, setPicked] = useState('')
  const [limit, setLimit] = useState(30)
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

  // BRAIN's own list for the market; Subindustry first where it has one, as most Alphas use it.
  const neutralization = options.neutralizations.some((n) => n.value === picked)
    ? picked
    : (options.neutralizations.find((n) => n.value === 'SUBINDUSTRY')?.value ??
      options.neutralizations[0]?.value ??
      '')
  const agnostic = scope.region === REGION_AGNOSTIC
  const limitValid = Number.isInteger(limit) && limit >= MIN_LIMIT && limit <= MAX_LIMIT
  const body = {
    region: scope.region,
    delay: scope.delay,
    universe: scope.universe,
    neutralization,
    selectionLimit: limit,
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
  const submitted = useQuery({
    queryKey: ['super-lab', 'submitted-expressions'],
    queryFn: () =>
      http.get<Schemas['SubmittedExpressions']>('/api/super-lab/submitted-expressions'),
    enabled: false,
  })
  const templateOptions = useQuery({
    queryKey: ['template-lab', 'options'],
    queryFn: () => templateLab.options(),
    enabled: expressionTab === 'custom',
    staleTime: 5 * 60_000,
  })
  const add = useAddTask(() => http.post<Schemas['AddedTask']>('/api/super-lab/tasks', body))
  const selectionExpressions = submitted.data?.selections ?? []
  const comboExpressions = submitted.data?.combos ?? []
  const hasSelection = customSelections.length > 0
  const hasCombo = customCombos.length > 0
  const ready =
    !agnostic && limitValid && options.ready && neutralization !== '' && hasSelection && hasCombo

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
        <div className="flex flex-col gap-4">
          <ScopePicker scope={scope} onChange={setScope} />
          {agnostic && (
            <Notice
              tone="error"
              title="A SuperAlpha combines Alphas of one region. Pick a region other than All Regions."
            />
          )}
          <Field label="Neutralization" className="max-w-xs">
            <Select
              label="Neutralization"
              items={options.neutralizations}
              value={neutralization}
              onChange={setPicked}
            />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Expressions"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Segmented
              label="Expression source"
              items={EXPRESSION_TABS}
              value={expressionTab}
              onChange={setExpressionTab}
            />
            {expressionTab === 'submitted' && (
              <Button
                size="sm"
                variant="secondary"
                loading={submitted.isFetching}
                onClick={() => void submitted.refetch()}
              >
                {submitted.data ? 'Refresh expressions' : 'Load expressions'}
              </Button>
            )}
          </div>
        }
      >
        {expressionTab === 'submitted' ? (
          <>
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
          </>
        ) : (
          <section className="flex min-w-0 flex-col items-start gap-3">
            <Segmented
              label="Custom expression type"
              items={CUSTOM_EXPRESSION_TYPES}
              value={customExpressionType}
              onChange={setCustomExpressionType}
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
            <Button
              size="sm"
              variant="secondary"
              disabled={
                !(customExpressionType === 'selection' ? selectionCode : comboCode).trim() ||
                (customExpressionType === 'selection'
                  ? customSelections.length
                  : customCombos.length) >= MAX_CUSTOM_RECIPES
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
        )}
        {(!hasSelection || !hasCombo) && (
          <Notice
            tone="info"
            title="Add at least one selection expression and one combo expression to create a task."
          />
        )}
      </Panel>

      <Panel
        title="Settings"
        description="Selection Handling is Positive: an Alpha a selection scores zero is left out."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Fieldset
            legend="Selection Limit"
            hint={`Alphas kept from the top of each ranking, ${MIN_LIMIT} to ${MAX_LIMIT}.`}
            className="rounded-sm border border-hairline bg-surface-2 p-3"
          >
            <Input
              type="number"
              min={MIN_LIMIT}
              max={MAX_LIMIT}
              value={Number.isNaN(limit) ? '' : String(limit)}
              onChange={(e) => setLimit(e.target.valueAsNumber)}
              className="w-full num"
            />
          </Fieldset>
          <Fieldset
            legend="Component Activation"
            className="rounded-sm border border-hairline bg-surface-2 p-3"
          >
            <Segmented
              label="Component Activation"
              items={ACTIVATIONS}
              value={activation}
              onChange={setActivation}
            />
          </Fieldset>
          <Fieldset legend="Cores" className="rounded-sm border border-hairline bg-surface-2 p-3">
            <Segmented label="Cores" items={CORES} value={cores} onChange={setCores} />
          </Fieldset>
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
        title="What Runs"
        description="Every selected expression with every selected combo runs at two Decays to land Turnover between 2% and 40%. Each runs in Full mode, so BRAIN's own checks say which are submittable: those show green in Tasks and reach the Submission Planner."
      >
        {plan.isError && <ErrorNotice error={plan.error} title="Could not plan the task" />}
        {plan.data && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric boxed label="SuperAlpha Simulations" value={fmt.int(plan.data.simulations)} />
              <Metric
                boxed
                label="Decay"
                value={plan.data.decays.map((d) => String(d)).join(' and ')}
              />
              <Metric boxed label="Truncation" value={String(plan.data.truncation)} />
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
      <div className="flex max-h-[28rem] min-h-24 flex-col gap-2 overflow-y-auto pr-1">
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
                  <code className="num whitespace-pre-wrap break-words text-body-compact text-ink">
                    {recipe.code}
                  </code>
                  {source && (
                    <code className="num break-all text-caption text-ink-subtle">{source}</code>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Copy expression and Alpha ID"
                    title="Copy expression and Alpha ID"
                    onClick={() => void copy()}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
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
