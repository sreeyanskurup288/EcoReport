'use client'

import Image from 'next/image'
import { ArrowLeft, Calendar, ChevronRight, MapPin, Navigation } from 'lucide-react'
import {
  countBy,
  formatCoords,
  formatDate,
  getLevel,
  issuesInScope,
  maxSeverity,
  selectionForIssue,
  SEVERITY_META,
  STATUS_META,
} from '@/lib/issues/meta'
import type { Issue, Selection, Severity } from '@/lib/issues/types'
import { cn } from '@/lib/utils'

const LEVEL_LABEL = {
  india: 'Country',
  state: 'State / UT',
  city: 'City',
  locality: 'Locality',
  road: 'Road',
  issue: 'Issue report',
} as const

function parentOf(selection: Selection): Selection {
  if (selection.issueId) return { ...selection, issueId: undefined }
  if (selection.road) return { state: selection.state, city: selection.city, locality: selection.locality }
  if (selection.locality) return { state: selection.state, city: selection.city }
  if (selection.city) return { state: selection.state }
  return {}
}

function SeverityDot({ severity, className }: { severity?: Severity; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2.5 flex-none rounded-full', className)}
      style={{ background: severity ? SEVERITY_META[severity].color : '#cbd5e1' }}
      aria-hidden
    />
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</h3>
}

function PlaceRows({
  issues,
  groupBy,
  onPick,
  emptyLabel,
}: {
  issues: Issue[]
  groupBy: (issue: Issue) => string
  onPick: (name: string) => void
  emptyLabel: string
}) {
  const groups = countBy(issues, groupBy)
  if (groups.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {groups.map(([name, count]) => (
        <li key={name}>
          <button
            type="button"
            onClick={() => onPick(name)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
          >
            <SeverityDot severity={maxSeverity(issues.filter((i) => groupBy(i) === name))} />
            <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
            <span className="tabular-nums text-xs text-muted-foreground">{count}</span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

function IssueRows({ issues, onPick }: { issues: Issue[]; onPick: (issue: Issue) => void }) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No issues match the current filters.</p>
  const sorted = [...issues].sort(
    (a, b) => SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank || b.createdAt.localeCompare(a.createdAt),
  )
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((issue) => (
        <li key={issue.id}>
          <button
            type="button"
            onClick={() => onPick(issue)}
            className="flex w-full gap-3 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/60"
          >
            <SeverityDot severity={issue.severity} className="mt-1.5" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-semibold leading-snug">{issue.title}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {issue.roadName} · {issue.locality} · {formatDate(issue.createdAt)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function SeverityBreakdown({ issues }: { issues: Issue[] }) {
  const total = issues.length || 1
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => {
          const n = issues.filter((i) => i.severity === s).length
          return n ? <span key={s} style={{ width: `${(n / total) * 100}%`, background: SEVERITY_META[s].color }} /> : null
        })}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => (
          <div key={s}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {SEVERITY_META[s].label}
            </dt>
            <dd className="text-sm font-bold tabular-nums">{issues.filter((i) => i.severity === s).length}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function IssueDetail({ issue }: { issue: Issue }) {
  const sev = SEVERITY_META[issue.severity]
  const status = STATUS_META[issue.status]
  const fields: [string, string][] = [
    ['Category', issue.category],
    ['Road', issue.roadName],
    ['Locality', issue.locality],
    ['City', issue.city],
    ['District', issue.district],
    ['State', issue.state],
  ]
  return (
    <article className="flex flex-col gap-4">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border bg-muted">
        <Image src={issue.image} alt={`Photo of reported issue: ${issue.title}`} fill sizes="380px" className="object-cover" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white"
          style={{ background: sev.color }}
        >
          {sev.label} severity
        </span>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', status.className)}>
          {status.label}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{issue.id}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground/85">{issue.description}</p>
      <dl className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="flex gap-3 px-3 py-2">
            <dt className="w-20 flex-none text-muted-foreground">{label}</dt>
            <dd className="min-w-0 font-semibold">{value}</dd>
          </div>
        ))}
        <div className="flex gap-3 px-3 py-2">
          <dt className="flex w-20 flex-none items-center gap-1 text-muted-foreground">
            <Navigation className="size-3.5" aria-hidden />
            GPS
          </dt>
          <dd className="font-mono text-xs font-semibold leading-5">
            {formatCoords(issue.latitude, issue.longitude)}
          </dd>
        </div>
        <div className="flex gap-3 px-3 py-2">
          <dt className="flex w-20 flex-none items-center gap-1 text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden />
            Reported
          </dt>
          <dd className="font-semibold">{formatDate(issue.createdAt)}</dd>
        </div>
      </dl>
      <a
        href={`https://www.openstreetmap.org/?mlat=${issue.latitude}&mlon=${issue.longitude}#map=18/${issue.latitude}/${issue.longitude}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
      >
        <MapPin className="size-4" aria-hidden />
        Open location in OpenStreetMap
      </a>
    </article>
  )
}

export function SidePanel({
  issues,
  selection,
  onSelect,
}: {
  issues: Issue[]
  selection: Selection
  onSelect: (selection: Selection) => void
}) {
  const level = getLevel(selection)
  const scoped = issuesInScope(issues, selection)
  const pickIssue = (issue: Issue) => onSelect(selectionForIssue(issue))
  const issue = selection.issueId ? issues.find((i) => i.id === selection.issueId) : undefined

  const title =
    level === 'issue'
      ? (issue?.title ?? selection.issueId)
      : level === 'road'
        ? selection.road
        : level === 'locality'
          ? selection.locality
          : level === 'city'
            ? selection.city
            : level === 'state'
              ? selection.state
              : 'India'

  const subtitle =
    level === 'india'
      ? 'Click a state or union territory to drill down.'
      : level === 'issue'
        ? `${issue?.roadName ?? ''}, ${issue?.locality ?? ''}`
        : `${scoped.length} ${scoped.length === 1 ? 'issue' : 'issues'} reported`

  return (
    <div className="flex flex-col gap-5 p-4">
      <header className="flex flex-col gap-2">
        {level !== 'india' && (
          <button
            type="button"
            onClick={() => onSelect(parentOf(selection))}
            className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-1 -ml-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back
          </button>
        )}
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{LEVEL_LABEL[level]}</p>
        <h2 className="text-pretty font-serif text-2xl font-semibold leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>

      {level === 'issue' && issue && <IssueDetail issue={issue} />}
      {level === 'issue' && !issue && (
        <p className="text-sm text-muted-foreground">This issue is hidden by the current filters.</p>
      )}

      {level !== 'issue' && (
        <>
          <section>
            <SectionTitle>Severity breakdown</SectionTitle>
            <SeverityBreakdown issues={scoped} />
          </section>

          {level === 'india' && (
            <section>
              <SectionTitle>States with reports</SectionTitle>
              <PlaceRows
                issues={scoped}
                groupBy={(i) => i.state}
                onPick={(state) => onSelect({ state })}
                emptyLabel="No reports yet."
              />
            </section>
          )}
          {level === 'state' && (
            <section>
              <SectionTitle>Cities</SectionTitle>
              <PlaceRows
                issues={scoped}
                groupBy={(i) => i.city}
                onPick={(city) => onSelect({ state: selection.state, city })}
                emptyLabel="No issues reported in this state yet. Hover the map to explore its districts."
              />
            </section>
          )}
          {level === 'city' && (
            <section>
              <SectionTitle>Localities</SectionTitle>
              <PlaceRows
                issues={scoped}
                groupBy={(i) => i.locality}
                onPick={(locality) => onSelect({ state: selection.state, city: selection.city, locality })}
                emptyLabel="No localities with reports."
              />
            </section>
          )}
          {level === 'locality' && (
            <section>
              <SectionTitle>Roads</SectionTitle>
              <PlaceRows
                issues={scoped}
                groupBy={(i) => i.roadName}
                onPick={(road) =>
                  onSelect({ state: selection.state, city: selection.city, locality: selection.locality, road })
                }
                emptyLabel="No roads with reports."
              />
            </section>
          )}

          <section>
            <SectionTitle>{level === 'india' || level === 'state' ? 'Recent issues' : 'Issues'}</SectionTitle>
            <IssueRows
              issues={level === 'india' || level === 'state' ? [...scoped].slice(0, 30) : scoped}
              onPick={pickIssue}
            />
          </section>
        </>
      )}
    </div>
  )
}
