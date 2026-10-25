'use client'

import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import { Leaf } from 'lucide-react'
import { getLevel, issuesInScope, selectionForIssue, SEVERITIES } from '@/lib/issues/meta'
import type { Issue, IssueCategory, Selection, Severity } from '@/lib/issues/types'
import { MapBreadcrumbs } from './map-breadcrumbs'
import { MapSearch } from './map-search'
import { ScopeStats } from './scope-stats'
import { SeverityLegend } from './severity-legend'
import { SidePanel } from './side-panel'

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Loading map of India…
    </div>
  ),
})

const CATEGORIES: IssueCategory[] = [
  'Waste Dumping',
  'Water Pollution',
  'Air Pollution',
  'Sewage Overflow',
  'Tree Felling',
  'Plastic Pollution',
]

export function EcoDashboard({ issues }: { issues: Issue[] }) {
  const [selection, setSelection] = useState<Selection>({})
  const [severities, setSeverities] = useState<Set<Severity>>(() => new Set(SEVERITIES))
  const [category, setCategory] = useState<IssueCategory | 'all'>('all')

  const filtered = useMemo(
    () => issues.filter((i) => severities.has(i.severity) && (category === 'all' || i.category === category)),
    [issues, severities, category],
  )

  const scoped = useMemo(() => issuesInScope(filtered, selection), [filtered, selection])

  const severityCounts = useMemo(() => {
    const base = issuesInScope(
      issues.filter((i) => category === 'all' || i.category === category),
      selection,
    )
    return Object.fromEntries(SEVERITIES.map((s) => [s, base.filter((i) => i.severity === s).length])) as Record<
      Severity,
      number
    >
  }, [issues, category, selection])

  const toggleSeverity = useCallback((severity: Severity) => {
    setSeverities((prev) => {
      const next = new Set(prev)
      if (next.has(severity)) next.delete(severity)
      else next.add(severity)
      return next
    })
  }, [])

  const selectIssue = useCallback((issue: Issue) => setSelection(selectionForIssue(issue)), [])

  const level = getLevel(selection)
  const scopeLabel = selection.road ?? selection.locality ?? selection.city ?? selection.state ?? 'India'

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="font-serif text-lg font-semibold leading-none">EcoWatch India</h1>
            <p className="mt-1 text-xs text-muted-foreground">Environmental issue reporting map</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 md:max-w-md">
            <MapSearch issues={issues} onSelect={setSelection} />
          </div>
          <label className="sr-only" htmlFor="category-filter">
            Filter by category
          </label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value as IssueCategory | 'all')}
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <ScopeStats issues={scoped} scopeLabel={scopeLabel} />
          <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
            <MapView
              issues={filtered}
              allIssues={issues}
              selection={selection}
              onSelect={setSelection}
              onSelectIssue={selectIssue}
            />
            <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex">
              <div className="pointer-events-auto max-w-[calc(100%-56px)]">
                <MapBreadcrumbs selection={selection} onSelect={setSelection} />
              </div>
            </div>
            <div className="absolute bottom-6 left-3 z-[1000] w-40">
              <SeverityLegend active={severities} counts={severityCounts} onToggle={toggleSeverity} />
            </div>
          </div>
        </div>

        <aside
          aria-label={`Details for ${level === 'issue' ? 'selected issue' : scopeLabel}`}
          className="min-h-0 border-t border-border bg-background lg:w-[380px] lg:flex-none lg:overflow-y-auto lg:border-l lg:border-t-0"
        >
          <SidePanel issues={filtered} selection={selection} onSelect={setSelection} />
        </aside>
      </main>
    </div>
  )
}
