import type { Issue, IssueStatus, Selection, SelectionLevel, Severity } from './types'

export const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical']

export const SEVERITY_META: Record<Severity, { label: string; color: string; rank: number }> = {
  low: { label: 'Low', color: '#16a34a', rank: 0 },
  medium: { label: 'Medium', color: '#eab308', rank: 1 },
  high: { label: 'High', color: '#f97316', rank: 2 },
  critical: { label: 'Critical', color: '#dc2626', rank: 3 },
}

export const STATUS_META: Record<IssueStatus, { label: string; className: string }> = {
  reported: { label: 'Reported', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  under_review: { label: 'Under review', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
  in_progress: { label: 'In progress', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  resolved: { label: 'Resolved', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
}

export function getLevel(selection: Selection): SelectionLevel {
  if (selection.issueId) return 'issue'
  if (selection.road) return 'road'
  if (selection.locality) return 'locality'
  if (selection.city) return 'city'
  if (selection.state) return 'state'
  return 'india'
}

export function issuesInScope(issues: Issue[], selection: Selection): Issue[] {
  return issues.filter(
    (issue) =>
      (!selection.state || issue.state === selection.state) &&
      (!selection.city || issue.city === selection.city) &&
      (!selection.locality || issue.locality === selection.locality) &&
      (!selection.road || issue.roadName === selection.road),
  )
}

export function selectionForIssue(issue: Issue): Selection {
  return {
    state: issue.state,
    city: issue.city,
    locality: issue.locality,
    road: issue.roadName,
    issueId: issue.id,
  }
}

export function countBy<T extends string>(items: Issue[], key: (issue: Issue) => T) {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

export function maxSeverity(items: Issue[]): Severity | undefined {
  let max: Severity | undefined
  for (const item of items) {
    if (!max || SEVERITY_META[item.severity].rank > SEVERITY_META[max].rank) max = item.severity
  }
  return max
}

export function centroid(items: Issue[]): [number, number] {
  const lat = items.reduce((sum, i) => sum + i.latitude, 0) / items.length
  const lng = items.reduce((sum, i) => sum + i.longitude, 0) / items.length
  return [lat, lng]
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  )
}

export function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`
}
