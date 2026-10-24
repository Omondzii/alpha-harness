/** Tools: a three-part guide to every tool. */

import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TOOL_TABS } from '@/shell/nav'
import { Checkbox, Empty, Page, Segmented } from '@/ui/kit'

type ToolTab = (typeof TOOL_TABS)[number]['tab']

const useFavoriteTools = create<{
  favorites: ToolTab[]
  toggle: (tool: ToolTab, favorite: boolean) => void
}>()(
  persist(
    (set) => ({
      favorites: [],
      toggle: (tool, favorite) =>
        set((state) => ({
          favorites: favorite
            ? [...new Set([...state.favorites, tool])]
            : state.favorites.filter((item) => item !== tool),
        })),
    }),
    { name: 'alpha-harness-favorite-tools' },
  ),
)

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
  const [view, setView] = useState<'all' | 'favorites'>('all')
  const favorites = useFavoriteTools((state) => state.favorites)
  const toggleFavorite = useFavoriteTools((state) => state.toggle)
  const tools =
    view === 'favorites' ? TOOL_TABS.filter((tool) => favorites.includes(tool.tab)) : TOOL_TABS

  return (
    <Page className="min-h-full">
      <section className="flex min-h-[calc(100dvh-7rem)] flex-col bg-canvas px-6 py-6 text-ink sm:px-10 sm:py-8 lg:px-14 lg:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-body-compact font-medium uppercase tracking-[0.18em] text-ink-subtle">
              Setup
            </p>
            <span className="mt-4 block h-px w-8 bg-hairline-strong" aria-hidden />
            <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-ink">
              Choose your tool
            </h1>
          </div>
          <Segmented
            label="Tool list"
            items={[
              { value: 'all', label: 'All Tools' },
              { value: 'favorites', label: `Favorites (${favorites.length})` },
            ]}
            value={view}
            onChange={setView}
          />
        </header>
        <div className="mt-6">
          {tools.length === 0 ? (
            <Empty title="No favorite tools yet">Check Favorite on a tool to save it here.</Empty>
          ) : (
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {tools.map((tool) => {
                const index = TOOL_TABS.findIndex((item) => item.tab === tool.tab)
                return (
                  <div key={tool.tab} className="relative">
                    <Link
                      to={tool.to}
                      search={SEARCH[tool.tab]}
                      className="group flex min-h-56 min-w-0 flex-col rounded-lg border border-hairline bg-surface-1 p-5 transition-colors hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                      <span
                        className={`text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-none tracking-[-0.08em] transition-colors ${
                          index === 1
                            ? 'text-primary'
                            : 'text-ink-tertiary group-hover:text-primary/70'
                        }`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h2 className="mt-auto pt-8 text-[clamp(1.125rem,1.5vw,1.375rem)] font-semibold leading-snug tracking-tight text-ink">
                        {tool.label}
                      </h2>
                      <p className="mt-2 text-body leading-snug text-ink-subtle">
                        {ABOUT[tool.tab]}
                      </p>
                    </Link>
                    <Checkbox
                      label="Favorite"
                      checked={favorites.includes(tool.tab)}
                      onChange={(checked) => toggleFavorite(tool.tab, checked)}
                      aria-label={`Favorite ${tool.label}`}
                      className="absolute top-4 right-4 z-10 rounded-sm border border-hairline bg-surface-1 px-2 py-1 text-ink-subtle"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </Page>
  )
}
