export type Role = 'user' | 'moderator' | 'admin'
export type ReportStatus = 'Pending' | 'In Progress' | 'Resolved'
export type Severity = 'Low' | 'Medium' | 'High'

export interface User { id: string; name: string; email: string; role: Role; created_at?: string }
export interface AdminUser extends User { report_count: number }
export interface StatusUpdate { id: string; report_id: string; changed_by: string; old_status: ReportStatus | null; new_status: ReportStatus; note?: string; created_at: string }
export interface Report {
  id: string; user_id: string; type: string; description: string; location: string; gmaps_url?: string; latitude: number | null; longitude: number | null;
  severity: Severity; status: ReportStatus; photo_url: string | null; created_at: string; updated_at: string; submitter?: string; updates?: StatusUpdate[]
}
