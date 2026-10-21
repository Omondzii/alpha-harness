/** Tools: every tool, two by two, in the same cards as Research Labs so the two group
 *  screens read as one pattern. */

import { Link } from '@tanstack/react-router'
import { ListChecksIcon, type LucideIcon, SlidersHorizontalIcon, UnlinkIcon } from 'lucide-react'
import { useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { HUB_CARD, HubCardBody } from '@/screens/research-labs'
import { TOOL_TABS } from '@/shell/nav'
import { Checkbox, Empty, Page, PageHeader, Segmented } from '@/ui/kit'

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

const ICONS: Record<(typeof TOOL_TABS)[number]['tab'], LucideIcon> = {
  'settings-sampler': SlidersHorizontalIcon,
  'submission-planner': ListChecksIcon,
  'correlation-breaker': UnlinkIcon,
}

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
    <Page>
      <PageHeader
        title="Tools"
        actions={
          <Segmented
            label="Tool list"
            items={[
              { value: 'all', label: 'All Tools' },
              { value: 'favorites', label: `Favorites (${favorites.length})` },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />
      {tools.length === 0 ? (
        <Empty title="No favorite tools yet">Check Favorite on a tool to save it here.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => {
            const index = TOOL_TABS.findIndex((item) => item.tab === tool.tab)
            return (
              <div key={tool.tab} className="relative">
                <Link to={tool.to} search={SEARCH[tool.tab]} className={HUB_CARD}>
                  <HubCardBody
                    icon={ICONS[tool.tab]}
                    index={index}
                    label={tool.label}
                    about={ABOUT[tool.tab]}
                  />
                </Link>
                <Checkbox
                  label="Favorite"
                  checked={favorites.includes(tool.tab)}
                  onChange={(checked) => toggleFavorite(tool.tab, checked)}
                  aria-label={`Favorite ${tool.label}`}
                  className="absolute top-6 right-6 z-10 rounded-sm border border-hairline bg-surface-1 px-2 py-1"
                />
              </div>
            )
          })}
        </div>
      )}
    </Page>
  )
}
