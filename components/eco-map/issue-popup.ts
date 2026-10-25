import { formatCoords, formatDate, SEVERITY_META, STATUS_META } from '@/lib/issues/meta'
import type { Issue } from '@/lib/issues/types'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function row(label: string, value: string) {
  return `<div style="display:flex;gap:8px;font-size:12px;line-height:1.45"><span style="width:64px;flex:none;color:#5b6863">${label}</span><span style="color:#14201b;font-weight:600">${escapeHtml(value)}</span></div>`
}

export function buildIssuePopup(issue: Issue) {
  const sev = SEVERITY_META[issue.severity]
  const status = STATUS_META[issue.status]
  return `
  <div>
    <img src="${escapeHtml(issue.image)}" alt="" style="display:block;width:100%;height:120px;object-fit:cover" />
    <div style="padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#5b6863">
        <span style="width:8px;height:8px;border-radius:9999px;background:${sev.color}"></span>
        ${sev.label} · ${escapeHtml(issue.category)}
      </div>
      <div style="font-size:14px;font-weight:700;line-height:1.3;color:#14201b">${escapeHtml(issue.title)}</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        ${row('Road', issue.roadName)}
        ${row('Locality', issue.locality)}
        ${row('City', `${issue.city}, ${issue.district}`)}
        ${row('State', issue.state)}
        ${row('GPS', formatCoords(issue.latitude, issue.longitude))}
        ${row('Reported', formatDate(issue.createdAt))}
        ${row('Status', status.label)}
      </div>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#3d4944">${escapeHtml(issue.description)}</p>
    </div>
  </div>`
}
