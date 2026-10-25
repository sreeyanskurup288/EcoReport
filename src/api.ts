import type { Report, User, ReportStatus } from './types'

// Local development should work even if Vite was started before .env was created.
// Deployments can still override this with VITE_API_BASE_URL.
const base = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '')
export const apiConfigured = Boolean(base)
export class ApiError extends Error { constructor(message: string, public status?: number) { super(message) } }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!base) throw new ApiError('Backend not connected yet. Set VITE_API_BASE_URL to your running Express API to enable accounts and report submission.')
  let response: Response
  try {
    response = await fetch(`${base}${path}`, { ...init, credentials: 'include', headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers } })
  } catch { throw new ApiError('Cannot reach the EcoReport server. Check that the backend is running and try again.') }
  const contentType = response.headers.get('content-type') || ''
  if (response.status !== 204 && !contentType.toLowerCase().includes('application/json')) {
    throw new ApiError('The API endpoint did not return JSON. Check that VITE_API_BASE_URL points to your Express backend.')
  }
  const data = response.status === 204 ? null : await response.json().catch(() => { throw new ApiError('The server returned invalid JSON.') })
  if (!response.ok) throw new ApiError(data?.message || data?.error || `Request failed (${response.status}).`, response.status)
  return data as T
}
export const api = {
  me: () => request<{ user: User }>('/api/auth/me'),
  signup: (input: { name: string; email: string; password: string }) => request<{ user: User }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) => request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  reports: () => request<{ reports: Report[] }>('/api/reports'),
  report: (id: string) => request<{ report: Report }>(`/api/reports/${encodeURIComponent(id)}`),
  createReport: (input: FormData) => request<{ report: Report }>('/api/reports', { method: 'POST', body: input }),
  updateStatus: (id: string, status: ReportStatus, note: string) => request<{ report: Report }>(`/api/reports/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  analytics: () => request<{ summary: Record<string, number> }>('/api/analytics/summary'),
}
