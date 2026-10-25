import { AlertTriangle, CheckCircle2, Layers, Timer } from 'lucide-react'
import type { Issue } from '@/lib/issues/types'

export function ScopeStats({ issues, scopeLabel }: { issues: Issue[]; scopeLabel: string }) {
  const critical = issues.filter((i) => i.severity === 'critical').length
  const resolved = issues.filter((i) => i.status === 'resolved').length
  const active = issues.length - resolved

  const stats = [
    { label: 'Total issues', value: issues.length, icon: Layers, tone: 'text-primary' },
    { label: 'Critical', value: critical, icon: AlertTriangle, tone: 'text-sev-critical' },
    { label: 'Open / active', value: active, icon: Timer, tone: 'text-sev-high' },
    { label: 'Resolved', value: resolved, icon: CheckCircle2, tone: 'text-sev-low' },
  ]

  return (
    <section aria-label={`Statistics for ${scopeLabel}`} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
          <span className={`flex size-8 items-center justify-center rounded-md bg-muted ${tone}`}>
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
