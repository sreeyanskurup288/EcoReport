'use client'

import { SEVERITIES, SEVERITY_META } from '@/lib/issues/meta'
import type { Severity } from '@/lib/issues/types'
import { cn } from '@/lib/utils'

export function SeverityLegend({
  active,
  counts,
  onToggle,
}: {
  active: Set<Severity>
  counts: Record<Severity, number>
  onToggle: (severity: Severity) => void
}) {
  return (
    <fieldset className="rounded-lg border border-border bg-card/95 p-2.5 shadow-md backdrop-blur">
      <legend className="sr-only">Filter by severity</legend>
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" aria-hidden>
        Severity
      </p>
      <div className="flex flex-col gap-0.5">
        {SEVERITIES.map((severity) => {
          const on = active.has(severity)
          return (
            <button
              key={severity}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(severity)}
              className={cn(
                'flex items-center gap-2 rounded-md px-1.5 py-1 text-xs font-semibold transition-colors hover:bg-muted',
                !on && 'opacity-45',
              )}
            >
              <span
                className="size-3 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)]"
                style={{ background: SEVERITY_META[severity].color }}
                aria-hidden
              />
              <span className="flex-1 text-left">{SEVERITY_META[severity].label}</span>
              <span className="tabular-nums text-muted-foreground">{counts[severity]}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
