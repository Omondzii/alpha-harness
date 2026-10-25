/** Super Alpha Lab: SuperAlphas built from your own submitted Alphas, every pairing in one task. */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SearchIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import type { components } from '@/api/generated'
import { http } from '@/api/http'
import { fmt } from '@/lib/format'
import { REGION_AGNOSTIC, useScope, useScopeOptions } from '@/lib/scope'
import { AddTaskButtons, useAddTask } from '@/screens/research-labs/add-task'
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
  Textarea,
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

export function SuperAlphaLabScreen() {
  const [scope, setScope] = useScope('/labs/super-alpha')
  const options = useScopeOptions(scope)
  const [picked, setPicked] = useState('')
  const [limit, setLimit] = useState(30)
  const [activation, setActivation] = useState<NonNullable<Activation>>('BOTH')
  const [cores, setCores] = useState(3)
  const [selectionName, setSelectionName] = useState('')
  const [selectionCode, setSelectionCode] = useState('')
  const [comboName, setComboName] = useState('')
  const [comboCode, setComboCode] = useState('')
  const [customSelections, setCustomSelections] = useState<Schemas['Recipe'][]>([])
  const [customCombos, setCustomCombos] = useState<Schemas['Recipe'][]>([])
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
  const add = useAddTask(() => http.post<Schemas['AddedTask']>('/api/super-lab/tasks', body))
  const ready = !agnostic && limitValid && options.ready && neutralization !== ''

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
        title="Submitted expressions"
        description="Load selection and combo expressions from your submitted SuperAlphas, then add either one independently to this simulation task."
        actions={
          <Button
            size="sm"
            variant="secondary"
            loading={submitted.isFetching}
            onClick={() => void submitted.refetch()}
          >
            {submitted.data ? 'Refresh expressions' : 'Load expressions'}
          </Button>
        }
      >
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
            <div className="grid gap-6 lg:grid-cols-2">
              <ExpressionCatalog
                title="Selection expressions"
                recipes={submitted.data.selections}
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
                recipes={submitted.data.combos}
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
            {(customSelections.length >= MAX_CUSTOM_RECIPES ||
              customCombos.length >= MAX_CUSTOM_RECIPES) && (
              <Notice
                tone="info"
                title={`Each list accepts up to ${MAX_CUSTOM_RECIPES} expressions. Remove one below to add another.`}
              />
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Custom Expressions"
        description="Add your own selection scores and combo weights."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col items-start gap-3">
            <h2 className="text-title">Custom selection</h2>
            <Field label="Name" className="w-full">
              <Input
                value={selectionName}
                maxLength={80}
                placeholder={`Custom selection ${customSelections.length + 1}`}
                onChange={(e) => setSelectionName(e.target.value)}
              />
            </Field>
            <Field
              label="Scoring expression"
              hint="Scores are clamped to zero or above; the operator-count cap is added automatically."
              className="w-full"
            >
              <Textarea
                rows={3}
                maxLength={2000}
                value={selectionCode}
                onChange={(e) => setSelectionCode(e.target.value)}
                placeholder="(1 - self_correlation) * (1 - prod_correlation)"
                className="num"
              />
            </Field>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectionCode.trim() || customSelections.length >= MAX_CUSTOM_RECIPES}
              onClick={() => {
                setCustomSelections((current) => [
                  ...current,
                  {
                    name: selectionName.trim() || `Custom selection ${current.length + 1}`,
                    code: selectionCode.trim(),
                  },
                ])
                setSelectionName('')
                setSelectionCode('')
              }}
            >
              Add selection
            </Button>
            {customSelections.length >= MAX_CUSTOM_RECIPES && (
              <span className="text-caption text-ink-subtle">
                Maximum {MAX_CUSTOM_RECIPES} custom selections.
              </span>
            )}
            <CustomRecipes
              label="Added selections"
              recipes={customSelections}
              onRemove={(index) =>
                setCustomSelections((current) => current.filter((_, i) => i !== index))
              }
            />
          </section>

          <section className="flex min-w-0 flex-col items-start gap-3">
            <h2 className="text-title">Custom combo</h2>
            <Field label="Name" className="w-full">
              <Input
                value={comboName}
                maxLength={80}
                placeholder={`Custom combo ${customCombos.length + 1}`}
                onChange={(e) => setComboName(e.target.value)}
              />
            </Field>
            <Field label="Weight expression" className="w-full">
              <Textarea
                rows={3}
                maxLength={2000}
                value={comboCode}
                onChange={(e) => setComboCode(e.target.value)}
                placeholder={
                  'stats = generate_stats(alpha);\n1 / (ts_std_dev(stats.returns, 120) + 0.0001)'
                }
                className="num"
              />
            </Field>
            <Button
              size="sm"
              variant="secondary"
              disabled={!comboCode.trim() || customCombos.length >= MAX_CUSTOM_RECIPES}
              onClick={() => {
                setCustomCombos((current) => [
                  ...current,
                  {
                    name: comboName.trim() || `Custom combo ${current.length + 1}`,
                    code: comboCode.trim(),
                  },
                ])
                setComboName('')
                setComboCode('')
              }}
            >
              Add combo
            </Button>
            {customCombos.length >= MAX_CUSTOM_RECIPES && (
              <span className="text-caption text-ink-subtle">
                Maximum {MAX_CUSTOM_RECIPES} custom combos.
              </span>
            )}
            <CustomRecipes
              label="Added combos"
              recipes={customCombos}
              onRemove={(index) =>
                setCustomCombos((current) => current.filter((_, i) => i !== index))
              }
            />
          </section>
        </div>
      </Panel>

      <Panel
        title="Settings"
        description="Selection Handling is Positive: an Alpha a selection scores zero is left out."
      >
        <div className="flex flex-wrap items-end gap-6">
          <Field
            label="Selection Limit"
            hint={`Alphas kept from the top of each ranking, ${MIN_LIMIT} to ${MAX_LIMIT}.`}
            className="w-48"
          >
            <Input
              type="number"
              min={MIN_LIMIT}
              max={MAX_LIMIT}
              value={Number.isNaN(limit) ? '' : String(limit)}
              onChange={(e) => setLimit(e.target.valueAsNumber)}
              className="num"
            />
          </Field>
          <Fieldset legend="Component Activation">
            <Segmented
              label="Component Activation"
              items={ACTIVATIONS}
              value={activation}
              onChange={setActivation}
            />
          </Fieldset>
          <Fieldset legend="Cores">
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
        description="Every selection with every combo, at two Decays to land Turnover between 2% and 40%. Each runs in Full mode, so BRAIN's own checks say which are submittable: those show green in Tasks and reach the Submission Planner."
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
            <Disclosure summary={`Selections (${plan.data.selections.length})`}>
              <Recipes recipes={plan.data.selections} />
            </Disclosure>
            <Disclosure summary={`Combos (${plan.data.combos.length})`}>
              <Recipes recipes={plan.data.combos} />
            </Disclosure>
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
    [recipe.name, recipe.code, ...recipe.sources].some((value) =>
      value.toLocaleLowerCase().includes(query),
    ),
  )
  const canAdd = added.length < MAX_CUSTOM_RECIPES

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
          <p className="py-3 text-body-compact text-ink-subtle">No expressions loaded.</p>
        ) : matching.length === 0 ? (
          <p className="py-3 text-body-compact text-ink-subtle">
            No expressions match this search.
          </p>
        ) : (
          matching.map((recipe) => {
            const isAdded = added.some((item) => item.code === recipe.code)
            return (
              <article
                key={recipe.code}
                className="flex min-w-0 flex-col gap-2 rounded-sm border border-hairline bg-surface-2 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <strong className="break-words text-body-compact font-medium text-ink">
                      {recipe.name}
                    </strong>
                    <span className="text-caption text-ink-subtle">
                      Used by {fmt.int(recipe.usedBy)} submitted SuperAlpha
                      {recipe.usedBy === 1 ? '' : 's'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isAdded || !canAdd}
                    onClick={() => onAdd(recipe)}
                  >
                    {isAdded ? 'Added' : 'Add'}
                  </Button>
                </div>
                <code className="num max-h-24 overflow-y-auto whitespace-pre-wrap break-all rounded-xs bg-surface-1 p-2 text-caption text-ink-muted">
                  {recipe.code}
                </code>
                {recipe.sources.length > 0 && (
                  <p className="text-caption text-ink-subtle">
                    Examples: {recipe.sources.join(' · ')}
                    {recipe.usedBy > recipe.sources.length ? ' · and others' : ''}
                  </p>
                )}
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
  label,
  recipes,
  onRemove,
}: {
  label: string
  recipes: Schemas['Recipe'][]
  onRemove: (index: number) => void
}) {
  if (recipes.length === 0) return null
  return (
    <section className="w-full border-t border-hairline pt-3">
      <h3 className="mb-2 text-caption font-medium text-ink-subtle">{label}</h3>
      <ul className="flex flex-col">
        {recipes.map((recipe, index) => (
          <li
            key={`${recipe.code}-${index}`}
            className="flex items-start justify-between gap-3 border-b border-hairline-subtle py-2 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-body-compact font-medium text-ink">{recipe.name}</span>
              <code className="num whitespace-pre-wrap break-all text-caption text-ink-muted">
                {recipe.code}
              </code>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${recipe.name}`}
              title={`Remove ${recipe.name}`}
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
