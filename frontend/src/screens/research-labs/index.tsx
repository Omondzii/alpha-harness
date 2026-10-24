/** Research Labs: a five-part guide to every lab. */

import { Link } from '@tanstack/react-router'
import { ArrowUpRightIcon, type LucideIcon } from 'lucide-react'
import { LAB_TABS } from '@/shell/nav'
import { Page } from '@/ui/kit'

/** What each one searches, since a name alone does not say which to start with. */
const ABOUT: Record<(typeof LAB_TABS)[number]['tab'], string> = {
  search: 'Writes one- and two-operator Alphas from the datasets you pick, steering to Sharpe.',
  template: 'Searches a template you type, with $variables for fields, values and operators.',
  evolution: 'Breeds new Alphas from seeds you pick, holding the last two years back as a test.',
  'power-pool': 'An LLM writes Power Pool Alphas for the datasets you pick.',
  'super-alpha': "Combines your submitted Alphas into SuperAlphas that pass BRAIN's checks.",
}

/** The card a hub screen links each of its entries with; the `Link` carries it. */
export const HUB_CARD =
  'panel-highlight group flex min-h-56 flex-col justify-between rounded-lg border border-hairline bg-surface-1 p-6 transition-colors hover:border-hairline-strong hover:bg-surface-2'

export function HubCardBody({
  icon: Icon,
  index,
  label,
  about,
}: {
  icon: LucideIcon
  index: number
  label: string
  about?: string
}) {
  return (
    <>
      <div className="flex items-start justify-between">
        <span className="flex size-12 items-center justify-center rounded-md border border-hairline-strong bg-surface-2 text-ink-muted transition-colors group-hover:border-primary group-hover:text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <ArrowUpRightIcon
          className="size-5 text-ink-tertiary transition-colors group-hover:text-ink"
          aria-hidden
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="num text-body-compact text-ink-subtle">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="text-headline font-semibold text-balance text-ink">{label}</h2>
        {about && <p className="max-w-prose text-body text-pretty text-ink-subtle">{about}</p>}
      </div>
    </>
  )
}

export function ResearchLabsScreen() {
  return (
    <Page className="min-h-full">
      <section className="flex min-h-[calc(100dvh-7rem)] flex-col bg-canvas px-6 py-6 text-ink sm:px-10 sm:py-8 lg:px-14 lg:py-10">
        <header>
          <p className="text-body-compact font-medium uppercase tracking-[0.18em] text-ink-subtle">
            Research Labs
          </p>
          <span className="mt-4 block h-px w-8 bg-hairline-strong" aria-hidden />
          <h1 className="mt-4 max-w-lg text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-ink">
            Choose your lab
          </h1>
        </header>
        <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-5">
          {LAB_TABS.map((lab, index) => (
            <Link
              key={lab.tab}
              to={lab.to}
              className="group flex min-h-56 min-w-0 flex-col rounded-lg border border-hairline bg-surface-1 p-5 transition-colors hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <span
                className={`text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-none tracking-[-0.08em] transition-colors ${
                  index === 1 ? 'text-primary' : 'text-ink-tertiary group-hover:text-primary/70'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="mt-auto pt-8 text-[clamp(1.125rem,1.5vw,1.375rem)] font-semibold leading-snug tracking-tight text-ink">
                {lab.label}
              </h2>
              <p className="mt-2 text-body leading-snug text-ink-subtle">{ABOUT[lab.tab]}</p>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  )
}
