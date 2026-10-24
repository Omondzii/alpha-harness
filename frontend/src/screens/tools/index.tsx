/** Tools: a three-part guide to every tool. */

import { Link } from '@tanstack/react-router'
import { TOOL_TABS } from '@/shell/nav'
import { Page } from '@/ui/kit'

/** What each one is for, since a name alone does not say when to reach for it. */
const ABOUT: Record<(typeof TOOL_TABS)[number]['tab'], string> = {
  'settings-sampler': 'Sweep one Alpha across Simulation Settings to find where it works best.',
  'submission-planner': 'Pick which Alphas to submit, and in what order.',
  'correlation-breaker': 'Re-shape an Alpha that is already in the Production Pool.',
}

/** Each tool's own search params. Both take one and default it to nothing, and a `Link`
 *  cannot infer that through the union of routes. */
const SEARCH = {
  'settings-sampler': { alpha: undefined },
  'submission-planner': { task: undefined },
  'correlation-breaker': { alpha: undefined },
} as const

export function ToolsScreen() {
  return (
    <Page className="min-h-full">
      <section className="flex min-h-[calc(100dvh-7rem)] flex-col bg-canvas px-6 py-6 text-ink sm:px-10 sm:py-8 lg:px-14 lg:py-10">
        <header>
          <p className="text-body-compact font-medium uppercase tracking-[0.18em] text-ink-subtle">
            Setup
          </p>
          <span className="mt-4 block h-px w-8 bg-hairline-strong" aria-hidden />
          <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-ink">
            Choose your tool
          </h1>
        </header>
        <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {TOOL_TABS.map((tool, index) => (
            <Link
              key={tool.tab}
              to={tool.to}
              search={SEARCH[tool.tab]}
              className="group flex min-h-56 min-w-0 flex-col rounded-lg border border-hairline bg-surface-1 p-5 transition-colors hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <span
                className={`text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-none tracking-[-0.08em] transition-colors ${
                  index === 0 ? 'text-primary' : 'text-ink-tertiary group-hover:text-primary/70'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="mt-auto pt-8 text-[clamp(1.125rem,1.5vw,1.375rem)] font-semibold leading-snug tracking-tight text-ink">
                {tool.label}
              </h2>
              <p className="mt-2 text-body leading-snug text-ink-subtle">{ABOUT[tool.tab]}</p>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  )
}
