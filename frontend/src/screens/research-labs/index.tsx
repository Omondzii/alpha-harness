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
  const superAlphaIndex = LAB_TABS.findIndex((lab) => lab.tab === 'super-alpha')
  const superAlphaLab = LAB_TABS[superAlphaIndex]

  return (
    <Page className="min-h-full">
      <section className="flex min-h-[calc(100dvh-7rem)] flex-col bg-canvas px-6 py-6 text-ink sm:px-10 sm:py-8 lg:px-14 lg:py-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-body-compact font-medium uppercase tracking-[0.18em] text-ink-subtle">
              Research Labs
            </p>
            <span className="mt-4 block h-px w-8 bg-hairline-strong" aria-hidden />
            <h1 className="mt-4 max-w-lg text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-ink">
              Choose your lab
            </h1>
          </div>
          {superAlphaLab && (
            <Link
              to={superAlphaLab.to}
              className="group flex min-h-40 w-full items-center gap-5 rounded-lg border border-hairline bg-surface-1 p-5 transition-colors hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary lg:w-[min(38rem,55%)]"
            >
              <span className="shrink-0 text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-none tracking-[-0.08em] text-ink-tertiary transition-colors group-hover:text-primary/70">
                {String(superAlphaIndex + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <h2 className="text-[clamp(1.125rem,1.5vw,1.375rem)] font-semibold leading-snug tracking-tight text-ink">
                  {superAlphaLab.label}
                </h2>
                <p className="mt-2 text-body leading-snug text-ink-subtle">
                  {ABOUT[superAlphaLab.tab]}
                </p>
              </span>
              <ArrowUpRightIcon
                className="size-5 shrink-0 text-ink-tertiary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                aria-hidden
              />
            </Link>
          )}
        </header>
        <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
          {LAB_TABS.map((lab, index) =>
            lab.tab === 'super-alpha' ? null : (
              <Link
                key={lab.tab}
                to={lab.to}
                className="group relative flex min-h-56 min-w-0 flex-col rounded-lg border border-hairline bg-surface-1 p-5 transition-colors hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                <ArrowUpRightIcon
                  className="absolute top-5 right-5 size-5 text-ink-tertiary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                  aria-hidden
                />
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
            ),
          )}
        </div>
        <Link
          to="/tools"
          className="group mt-6 flex min-h-24 w-full items-center justify-between gap-6 rounded-lg border border-hairline bg-surface-1 p-5 transition-colors hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:w-[65%]"
        >
          <span>
            <span className="block text-body-compact font-medium uppercase tracking-[0.14em] text-ink-subtle">
              Explore more
            </span>
            <span className="mt-1 block text-title font-semibold text-ink">Research Tools</span>
          </span>
          <ArrowUpRightIcon
            className="size-5 shrink-0 text-ink-tertiary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
            aria-hidden
          />
        </Link>
      </section>
    </Page>
  )
}
