'use client'

import { useId, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { selectionForIssue } from '@/lib/issues/meta'
import { INDIA_STATES_AND_UTS } from '@/lib/issues/states'
import type { Issue, Selection } from '@/lib/issues/types'
import { cn } from '@/lib/utils'

type ResultType = 'State' | 'City' | 'Locality' | 'Road' | 'Issue'

interface Result {
  id: string
  type: ResultType
  label: string
  hint: string
  selection: Selection
}

function buildIndex(issues: Issue[]): Result[] {
  const results = new Map<string, Result>()
  for (const state of INDIA_STATES_AND_UTS) {
    results.set(`s:${state}`, { id: `s:${state}`, type: 'State', label: state, hint: 'India', selection: { state } })
  }
  for (const i of issues) {
    results.set(`c:${i.state}:${i.city}`, {
      id: `c:${i.state}:${i.city}`,
      type: 'City',
      label: i.city,
      hint: i.state,
      selection: { state: i.state, city: i.city },
    })
    results.set(`l:${i.city}:${i.locality}`, {
      id: `l:${i.city}:${i.locality}`,
      type: 'Locality',
      label: i.locality,
      hint: `${i.city}, ${i.state}`,
      selection: { state: i.state, city: i.city, locality: i.locality },
    })
    results.set(`r:${i.locality}:${i.roadName}`, {
      id: `r:${i.locality}:${i.roadName}`,
      type: 'Road',
      label: i.roadName,
      hint: `${i.locality}, ${i.city}`,
      selection: { state: i.state, city: i.city, locality: i.locality, road: i.roadName },
    })
    results.set(`i:${i.id}`, {
      id: `i:${i.id}`,
      type: 'Issue',
      label: i.title,
      hint: `${i.id} · ${i.roadName}, ${i.locality}`,
      selection: selectionForIssue(i),
    })
  }
  return [...results.values()]
}

export function MapSearch({ issues, onSelect }: { issues: Issue[]; onSelect: (selection: Selection) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const index = useMemo(() => buildIndex(issues), [issues])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return index
      .filter((r) => r.label.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)))
      .slice(0, 8)
  }, [index, query])

  const choose = (result: Result) => {
    onSelect(result.selection)
    setQuery(result.label)
    setOpen(false)
  }

  const showList = open && results.length > 0

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search states, cities, localities, roads or issues
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        value={query}
        placeholder="Search state, city, locality, road or issue ID"
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (results[active]) choose(results[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('')
            setOpen(false)
          }}
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
          <span className="sr-only">Clear search</span>
        </button>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-[1100] mt-1.5 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg"
        >
          {results.map((result, i) => (
            <li
              key={result.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(result)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
                i === active && 'bg-accent',
              )}
            >
              <span className="w-16 flex-none rounded bg-muted px-1.5 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {result.type}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground">{result.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{result.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
