'use client'

import { ChevronRight } from 'lucide-react'
import type { Selection } from '@/lib/issues/types'
import { cn } from '@/lib/utils'

export function MapBreadcrumbs({
  selection,
  onSelect,
}: {
  selection: Selection
  onSelect: (selection: Selection) => void
}) {
  const crumbs: { label: string; target: Selection }[] = [{ label: 'India', target: {} }]
  if (selection.state) crumbs.push({ label: selection.state, target: { state: selection.state } })
  if (selection.city)
    crumbs.push({ label: selection.city, target: { state: selection.state, city: selection.city } })
  if (selection.locality)
    crumbs.push({
      label: selection.locality,
      target: { state: selection.state, city: selection.city, locality: selection.locality },
    })
  if (selection.road)
    crumbs.push({
      label: selection.road,
      target: { state: selection.state, city: selection.city, locality: selection.locality, road: selection.road },
    })
  if (selection.issueId) crumbs.push({ label: selection.issueId, target: selection })

  return (
    <nav aria-label="Map location" className="max-w-full">
      <ol className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card/95 px-1.5 py-1 text-xs shadow-md backdrop-blur">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
              <button
                type="button"
                onClick={() => onSelect(crumb.target)}
                aria-current={last ? 'location' : undefined}
                className={cn(
                  'max-w-40 truncate rounded px-1.5 py-0.5 font-semibold transition-colors',
                  last ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {crumb.label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
