export type Severity = 'low' | 'medium' | 'high' | 'critical'

export type IssueStatus = 'reported' | 'under_review' | 'in_progress' | 'resolved'

export type IssueCategory =
  | 'Waste Dumping'
  | 'Water Pollution'
  | 'Air Pollution'
  | 'Sewage Overflow'
  | 'Tree Felling'
  | 'Plastic Pollution'

export interface Issue {
  id: string
  title: string
  category: IssueCategory
  severity: Severity
  state: string
  city: string
  district: string
  locality: string
  roadName: string
  latitude: number
  longitude: number
  image: string
  description: string
  status: IssueStatus
  createdAt: string
}

export interface Selection {
  state?: string
  city?: string
  locality?: string
  road?: string
  issueId?: string
}

export type SelectionLevel = 'india' | 'state' | 'city' | 'locality' | 'road' | 'issue'
