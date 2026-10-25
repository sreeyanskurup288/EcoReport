import { useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import type { GeoJsonObject } from 'geojson'
import indiaGeoJson from './data/indian-states.json'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import 'leaflet/dist/leaflet.css'
import './map.css'
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, Clock3, CloudSun, FileText, Filter, Globe2, Leaf, LogIn, LogOut, MapPin, Menu, Plus,
  Search, ShieldCheck, SlidersHorizontal, Sparkles, Trees, Upload, X, ExternalLink, type LucideIcon,
} from 'lucide-react'
import { api, apiConfigured, ApiError } from './api'
import type { Report, ReportStatus, User } from './types'

type View = 'Home' | 'Dashboard' | 'Report an Issue' | 'Map' | 'Reports' | 'Analytics' | 'SDG Goals'

const nav: { name: View; icon: LucideIcon }[] = [
  { name: 'Home', icon: Leaf },
  { name: 'Dashboard', icon: Activity },
  { name: 'Report an Issue', icon: Plus },
  { name: 'Map', icon: MapPin },
  { name: 'Reports', icon: FileText },
  { name: 'Analytics', icon: BarChart3 },
  { name: 'SDG Goals', icon: Globe2 },
]

const sampleReports: Report[] = [
  { id: 'ER-1042', user_id: 'u1', type: 'Waste', description: 'Overflowing bins near the park entrance need attention.', location: 'Carter Road, Bandra West', latitude: 19.0596, longitude: 72.8295, severity: 'High', status: 'In Progress', photo_url: null, created_at: '2026-10-18T09:30:00Z', updated_at: '2026-10-19T08:00:00Z', submitter: 'Aarav S.', updates: [{ id: 'up1', report_id: 'ER-1042', changed_by: 'EcoWatch', old_status: null, new_status: 'Pending', note: 'Report received and shared with the local team.', created_at: '2026-10-18T09:30:00Z' }, { id: 'up2', report_id: 'ER-1042', changed_by: 'EcoWatch team', old_status: 'Pending', new_status: 'In Progress', note: 'Cleanup has been scheduled.', created_at: '2026-10-19T08:00:00Z' }] },
  { id: 'ER-1041', user_id: 'u2', type: 'Water', description: 'A leaking public tap is leaving water pooled on the footpath.', location: 'Lake Road, Powai', latitude: 19.1176, longitude: 72.9060, severity: 'Medium', status: 'Pending', photo_url: null, created_at: '2026-10-17T12:10:00Z', updated_at: '2026-10-17T12:10:00Z', submitter: 'Mira P.' },
  { id: 'ER-1040', user_id: 'u3', type: 'Trees', description: 'Several young trees have been damaged beside the road.', location: 'Hiranandani Gardens, Powai', latitude: 19.1197, longitude: 72.9050, severity: 'Low', status: 'Resolved', photo_url: null, created_at: '2026-10-16T07:20:00Z', updated_at: '2026-10-18T15:00:00Z', submitter: 'Dev N.' },
  { id: 'ER-1039', user_id: 'u4', type: 'Air', description: 'Heavy smoke and dust are affecting nearby homes in the evening.', location: 'Andheri East', latitude: 19.1136, longitude: 72.8697, severity: 'High', status: 'In Progress', photo_url: null, created_at: '2026-10-15T15:40:00Z', updated_at: '2026-10-16T09:00:00Z', submitter: 'Sana R.' },
  { id: 'ER-1038', user_id: 'u5', type: 'Noise', description: 'Repeated late-night construction noise is disturbing residents.', location: 'Vashi, Navi Mumbai', latitude: 19.0771, longitude: 72.9980, severity: 'Medium', status: 'Pending', photo_url: null, created_at: '2026-10-14T18:15:00Z', updated_at: '2026-10-14T18:15:00Z', submitter: 'Kabir M.' },
]

const issueTypes = ['Waste', 'Water', 'Air', 'Noise', 'Trees', 'Drainage', 'Other']
const statusClass: Record<ReportStatus, string> = { Pending: 'pending', 'In Progress': 'progress', Resolved: 'resolved' }
const typeIcon: Record<string, string> = { Waste: '♻', Water: '◉', Air: '〰', Noise: '⌁', Trees: '♧', Drainage: '⌁', Other: '✳' }
const readableDate = (date: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
const STATUS_COLORS: Record<ReportStatus, string> = { Pending: '#d4a017', 'In Progress': '#3d8ea8', Resolved: '#1f7a54' }
const CHART_COLORS = ['#1f7a54', '#3d8ea8', '#d4a017', '#6f9b72', '#8f6bb3']

type NationalIssue = {
  state: string
  code: string
  lat: number
  lng: number
  issue: string
  category: string
  summary: string
  source: string
  sourceUrl: string
}

type IssueSeverity = 'low' | 'medium' | 'high' | 'critical'
type StateIssueData = {
  stateName: string
  totalReports: number
  resolvedReports: number
  pendingReports: number
  severity: IssueSeverity
  issueType: string
  coordinates: [number, number]
}

type EnvironmentalIssue = {
  id: string
  title: string
  category: 'Garbage' | 'Air Pollution' | 'Water Pollution' | 'Illegal Dumping' | 'Tree Cutting' | 'Noise Pollution'
  state: string
  city: string
  locality: string
  roadName: string
  latitude: number
  longitude: number
  imageUrl: string
  description: string
  status: ReportStatus
  createdAt: string
}

type CityPoint = { state: string; city: string; district: string; latitude: number; longitude: number; reportCount: number }

const severityForCategory = (category: string): IssueSeverity => {
  const severity = ({ Air: 'critical', Pollution: 'critical', Water: 'high', Climate: 'high', Land: 'medium', Coast: 'medium' } as Record<string, IssueSeverity>)[category]
  return severity || 'low'
}
const stateNameAliases: Record<string, string> = {
  'Andaman and Nicobar': 'Andaman & Nicobar Islands', 'Dadra and Nagar Haveli': 'Dadra & Nagar Haveli and Daman & Diu', 'Daman and Diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'Jammu and Kashmir': 'Jammu & Kashmir', Orissa: 'Odisha', Uttaranchal: 'Uttarakhand',
}

const issueMarkerType = (issue: NationalIssue) => issue.category === 'Air' ? 'Air Pollution' : issue.category === 'Water' ? 'Water Pollution' : issue.category === 'Land' ? 'Illegal Dumping' : issue.category === 'Coast' ? 'Garbage' : issue.category === 'Pollution' ? 'Noise Pollution' : 'Tree Cutting'

// Public issue areas sourced from official Indian government portals. These are issue
// watch-points, not fabricated incident counts or EcoReport community submissions.
const nationalIssues: NationalIssue[] = [
  { state: 'Andhra Pradesh', code: 'AP', lat: 15.9129, lng: 79.7400, issue: 'Coastal erosion & cyclones', category: 'Climate', summary: 'Cyclone exposure and coastal erosion remain recurring risks along the Bay of Bengal coast.', source: 'NDMA · Cyclones', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Cyclone' },
  { state: 'Arunachal Pradesh', code: 'AR', lat: 28.2180, lng: 94.7278, issue: 'Landslides & flash floods', category: 'Climate', summary: 'Mountain terrain and intense monsoon rainfall create recurring landslide and flood risks.', source: 'NDMA · Landslides', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Landslide' },
  { state: 'Assam', code: 'AS', lat: 26.2006, lng: 92.9376, issue: 'River floods & erosion', category: 'Water', summary: 'Brahmaputra and Barak basin flooding and bank erosion affect communities each monsoon.', source: 'CWC · Flood Forecasting', sourceUrl: 'https://ffs.india-water.gov.in/' },
  { state: 'Bihar', code: 'BR', lat: 25.0961, lng: 85.3131, issue: 'Flooding & groundwater stress', category: 'Water', summary: 'Flood-prone river systems coexist with local groundwater quality and availability concerns.', source: 'CWC · Flood Forecasting', sourceUrl: 'https://ffs.india-water.gov.in/' },
  { state: 'Chhattisgarh', code: 'CG', lat: 21.2787, lng: 81.8661, issue: 'Mining & forest pressure', category: 'Land', summary: 'Mining activity and land-use change put pressure on forest and local water systems.', source: 'MoEFCC · Forest reports', sourceUrl: 'https://moef.gov.in/' },
  { state: 'Goa', code: 'GA', lat: 15.2993, lng: 74.1240, issue: 'Coastal waste & erosion', category: 'Coast', summary: 'Tourism pressure, shoreline erosion and marine litter are persistent coastal concerns.', source: 'MoEFCC · Coastal regulation', sourceUrl: 'https://moef.gov.in/' },
  { state: 'Gujarat', code: 'GJ', lat: 22.2587, lng: 71.1924, issue: 'Industrial air & water pollution', category: 'Pollution', summary: 'Industrial clusters and dense coastal development require continuing pollution monitoring.', source: 'CPCB · Pollution control', sourceUrl: 'https://cpcb.nic.in/' },
  { state: 'Haryana', code: 'HR', lat: 29.0588, lng: 76.0856, issue: 'Winter air pollution', category: 'Air', summary: 'NCR-adjacent districts face recurring winter particulate pollution and crop-residue smoke episodes.', source: 'CPCB · AQI', sourceUrl: 'https://airquality.cpcb.gov.in/AQI_India/' },
  { state: 'Himachal Pradesh', code: 'HP', lat: 31.1048, lng: 77.1734, issue: 'Landslides & cloudbursts', category: 'Climate', summary: 'Steep slopes and extreme rainfall make landslides and flash floods recurring hazards.', source: 'NDMA · Landslides', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Landslide' },
  { state: 'Jharkhand', code: 'JH', lat: 23.6102, lng: 85.2799, issue: 'Mining & groundwater quality', category: 'Land', summary: 'Coal and mineral extraction create ongoing land, air and water management challenges.', source: 'CPCB · Pollution control', sourceUrl: 'https://cpcb.nic.in/' },
  { state: 'Karnataka', code: 'KA', lat: 15.3173, lng: 75.7139, issue: 'Urban water stress', category: 'Water', summary: 'Rapid urban growth and variable rainfall intensify water-supply and lake-management pressure.', source: 'CGWB · Ground water', sourceUrl: 'https://cgwb.gov.in/' },
  { state: 'Kerala', code: 'KL', lat: 10.8505, lng: 76.2711, issue: 'Floods & landslides', category: 'Climate', summary: 'Monsoon flooding, landslides and coastal vulnerability remain recurring public-safety issues.', source: 'NDMA · Floods', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Floods' },
  { state: 'Madhya Pradesh', code: 'MP', lat: 22.9734, lng: 78.6569, issue: 'Forest & river pollution', category: 'Land', summary: 'Forest conservation and pollution in urban and river corridors remain active priorities.', source: 'MoEFCC · Environment', sourceUrl: 'https://moef.gov.in/' },
  { state: 'Maharashtra', code: 'MH', lat: 19.7515, lng: 75.7139, issue: 'Urban air & waste', category: 'Pollution', summary: 'Mumbai–Pune urban corridors face recurring air-quality, solid-waste and flood-management pressure.', source: 'CPCB · AQI', sourceUrl: 'https://airquality.cpcb.gov.in/AQI_India/' },
  { state: 'Manipur', code: 'MN', lat: 24.6637, lng: 93.9063, issue: 'Floods & wetland pressure', category: 'Water', summary: 'Flooding and pressure on wetlands and water bodies are recurring environmental concerns.', source: 'NDMA · Floods', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Floods' },
  { state: 'Meghalaya', code: 'ML', lat: 25.4670, lng: 91.3662, issue: 'Mining & water quality', category: 'Water', summary: 'Mining and intense rainfall create continuing water-quality and erosion concerns.', source: 'CPCB · Pollution control', sourceUrl: 'https://cpcb.nic.in/' },
  { state: 'Mizoram', code: 'MZ', lat: 23.1645, lng: 92.9376, issue: 'Landslides & erosion', category: 'Climate', summary: 'Hilly terrain and heavy rainfall make landslides and soil erosion recurring risks.', source: 'NDMA · Landslides', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Landslide' },
  { state: 'Nagaland', code: 'NL', lat: 26.1584, lng: 94.5624, issue: 'Landslides & waste', category: 'Land', summary: 'Hilly settlements face slope instability alongside growing solid-waste management needs.', source: 'NDMA · Landslides', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Landslide' },
  { state: 'Odisha', code: 'OD', lat: 20.9517, lng: 85.0985, issue: 'Cyclones & coastal flooding', category: 'Climate', summary: 'Low-lying coastal districts remain exposed to cyclones, storm surge and flooding.', source: 'NDMA · Cyclones', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Cyclone' },
  { state: 'Punjab', code: 'PB', lat: 31.1471, lng: 75.3412, issue: 'Crop-residue smoke', category: 'Air', summary: 'Seasonal crop-residue burning contributes to recurring particulate pollution episodes.', source: 'CPCB · AQI', sourceUrl: 'https://airquality.cpcb.gov.in/AQI_India/' },
  { state: 'Rajasthan', code: 'RJ', lat: 27.0238, lng: 74.2179, issue: 'Water scarcity & heat', category: 'Water', summary: 'Arid districts face persistent groundwater stress, drought exposure and extreme heat.', source: 'CGWB · Ground water', sourceUrl: 'https://cgwb.gov.in/' },
  { state: 'Sikkim', code: 'SK', lat: 27.5330, lng: 88.5122, issue: 'Glacial floods & landslides', category: 'Climate', summary: 'Mountain hazards, including landslides and glacial-lake outburst risk, need continued monitoring.', source: 'NDMA · Landslides', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Landslide' },
  { state: 'Tamil Nadu', code: 'TN', lat: 11.1271, lng: 78.6569, issue: 'Urban floods & water stress', category: 'Water', summary: 'Cities alternate between heavy-rain flooding and water stress, with coastal pollution also a concern.', source: 'NDMA · Floods', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Floods' },
  { state: 'Telangana', code: 'TS', lat: 18.1124, lng: 79.0193, issue: 'Urban air & water stress', category: 'Pollution', summary: 'Urban expansion increases pressure on air quality, lakes, drainage and water supply.', source: 'CPCB · Pollution control', sourceUrl: 'https://cpcb.nic.in/' },
  { state: 'Tripura', code: 'TR', lat: 23.9408, lng: 91.9882, issue: 'Floods & forest pressure', category: 'Climate', summary: 'Monsoon flooding and pressure on forest and wetland systems remain recurring concerns.', source: 'NDMA · Floods', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Floods' },
  { state: 'Uttar Pradesh', code: 'UP', lat: 26.8467, lng: 80.9462, issue: 'Air pollution & river health', category: 'Air', summary: 'Large urban and industrial belts face recurring particulate pollution and river-restoration challenges.', source: 'CPCB · AQI', sourceUrl: 'https://airquality.cpcb.gov.in/AQI_India/' },
  { state: 'Uttarakhand', code: 'UK', lat: 30.0668, lng: 79.0193, issue: 'Landslides & flash floods', category: 'Climate', summary: 'Himalayan terrain and extreme rainfall create recurring landslide and flash-flood risks.', source: 'NDMA · Landslides', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Landslide' },
  { state: 'West Bengal', code: 'WB', lat: 22.9868, lng: 87.8550, issue: 'Cyclones & urban flooding', category: 'Climate', summary: 'Coastal cyclones, river flooding and drainage stress affect both rural and urban areas.', source: 'NDMA · Cyclones', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Cyclone' },
  { state: 'Andaman & Nicobar Islands', code: 'AN', lat: 11.7401, lng: 92.6586, issue: 'Coastal erosion & coral pressure', category: 'Coast', summary: 'Island ecosystems face coastal hazards, marine litter and pressure on coral and mangrove habitats.', source: 'MoEFCC · Environment', sourceUrl: 'https://moef.gov.in/' },
  { state: 'Chandigarh', code: 'CH', lat: 30.7333, lng: 76.7794, issue: 'Urban air & waste', category: 'Pollution', summary: 'A dense urban area with recurring air-quality, traffic and solid-waste management concerns.', source: 'CPCB · AQI', sourceUrl: 'https://airquality.cpcb.gov.in/AQI_India/' },
  { state: 'Dadra & Nagar Haveli and Daman & Diu', code: 'DN', lat: 20.1809, lng: 73.0169, issue: 'Industrial & coastal pollution', category: 'Pollution', summary: 'Industrial growth and coastal development require ongoing air, water and waste monitoring.', source: 'CPCB · Pollution control', sourceUrl: 'https://cpcb.nic.in/' },
  { state: 'Delhi', code: 'DL', lat: 28.7041, lng: 77.1025, issue: 'Severe winter air pollution', category: 'Air', summary: 'Particulate pollution is a recurring public-health issue, especially during winter inversion episodes.', source: 'CPCB · AQI', sourceUrl: 'https://airquality.cpcb.gov.in/AQI_India/' },
  { state: 'Jammu & Kashmir', code: 'JK', lat: 33.7782, lng: 76.5762, issue: 'Landslides & floods', category: 'Climate', summary: 'Mountain hazards, flash floods and slope instability remain recurring risks.', source: 'NDMA · Landslides', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Landslide' },
  { state: 'Ladakh', code: 'LA', lat: 34.1526, lng: 77.5771, issue: 'Water scarcity & fragile ecology', category: 'Water', summary: 'A cold-arid landscape faces water scarcity, climate sensitivity and waste-management pressure.', source: 'CGWB · Ground water', sourceUrl: 'https://cgwb.gov.in/' },
  { state: 'Lakshadweep', code: 'LD', lat: 10.5667, lng: 72.6417, issue: 'Coastal erosion & marine waste', category: 'Coast', summary: 'Low-lying islands are vulnerable to coastal erosion, marine litter and climate impacts.', source: 'MoEFCC · Coastal regulation', sourceUrl: 'https://moef.gov.in/' },
  { state: 'Puducherry', code: 'PY', lat: 11.9416, lng: 79.8083, issue: 'Coastal erosion & flooding', category: 'Coast', summary: 'Coastal erosion, storm impacts and urban drainage are recurring local risks.', source: 'NDMA · Cyclones', sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Cyclone' },
]

const stateIssueData: StateIssueData[] = nationalIssues.map(issue => ({
  stateName: issue.state,
  totalReports: 0,
  resolvedReports: 0,
  pendingReports: 0,
  severity: severityForCategory(issue.category),
  issueType: issueMarkerType(issue),
  coordinates: [issue.lat, issue.lng],
}))

const cityPoints: CityPoint[] = nationalIssues.map(issue => ({ state: issue.state, city: issue.state === 'Maharashtra' ? 'Mumbai' : issue.state === 'Delhi' ? 'New Delhi' : issue.state.replace(' & ', ' ').split(' ')[0] + ' City', district: issue.state, latitude: issue.lat, longitude: issue.lng, reportCount: issue.state === 'Maharashtra' ? 5 : 0 }))
cityPoints.push({ state: 'Maharashtra', city: 'Pune', district: 'Pune', latitude: 18.5204, longitude: 73.8567, reportCount: 0 })
cityPoints.push({ state: 'Maharashtra', city: 'Nashik', district: 'Nashik', latitude: 20.0059, longitude: 73.7910, reportCount: 0 })

const environmentalIssues: EnvironmentalIssue[] = [
  { id: 'ER-1042', title: 'Overflowing bins near park entrance', category: 'Garbage', state: 'Maharashtra', city: 'Mumbai', locality: 'Bandra West', roadName: 'Carter Road', latitude: 19.0596, longitude: 72.8295, imageUrl: '', description: 'Overflowing bins near the park entrance need attention.', status: 'In Progress', createdAt: '2026-10-18T09:30:00Z' },
  { id: 'ER-1041', title: 'Leaking public water tap', category: 'Water Pollution', state: 'Maharashtra', city: 'Mumbai', locality: 'Powai', roadName: 'Lake Road', latitude: 19.1176, longitude: 72.9060, imageUrl: '', description: 'A leaking public tap is leaving water pooled on the footpath.', status: 'Pending', createdAt: '2026-10-17T12:10:00Z' },
  { id: 'ER-1040', title: 'Damaged roadside trees', category: 'Tree Cutting', state: 'Maharashtra', city: 'Mumbai', locality: 'Powai', roadName: 'Hiranandani Gardens', latitude: 19.1197, longitude: 72.9050, imageUrl: '', description: 'Several young trees have been damaged beside the road.', status: 'Resolved', createdAt: '2026-10-16T07:20:00Z' },
  { id: 'ER-1039', title: 'Smoke and dust affecting homes', category: 'Air Pollution', state: 'Maharashtra', city: 'Mumbai', locality: 'Andheri East', roadName: 'Andheri-Kurla Road', latitude: 19.1136, longitude: 72.8697, imageUrl: '', description: 'Heavy smoke and dust are affecting nearby homes in the evening.', status: 'In Progress', createdAt: '2026-10-15T15:40:00Z' },
  { id: 'ER-1038', title: 'Late-night construction noise', category: 'Noise Pollution', state: 'Maharashtra', city: 'Mumbai', locality: 'Vashi', roadName: 'Palm Beach Road', latitude: 19.0771, longitude: 72.9980, imageUrl: '', description: 'Repeated late-night construction noise is disturbing residents.', status: 'Pending', createdAt: '2026-10-14T18:15:00Z' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

export default function App() {
  const [view, setView] = useState<View>('Home')
  const [reports, setReports] = useState(sampleReports)
  const [preview, setPreview] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [detail, setDetail] = useState<Report | null>(null)
  const [toast, setToast] = useState('')
  const [apiNotice, setApiNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterType, setFilterType] = useState('All issues')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!apiConfigured) { setPreview(true); return }
    api.me().then(({ user: current }) => { setUser(current); setPreview(false) }).catch((err: ApiError) => {
      if (err.status === 401) setPreview(false)
      else setApiNotice(err.message)
    })
    api.reports().then(({ reports: data }) => { setReports(data); setPreview(false); setApiNotice('') }).catch((err: ApiError) => {
      setPreview(true); setApiNotice(err.message)
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(r => r.status === 'Pending').length,
    progress: reports.filter(r => r.status === 'In Progress').length,
    resolved: reports.filter(r => r.status === 'Resolved').length,
  }), [reports])

  const filtered = useMemo(() => reports.filter(r =>
    (filterStatus === 'All' || r.status === filterStatus) &&
    (filterType === 'All issues' || r.type === filterType) &&
    `${r.type} ${r.location} ${r.id} ${r.submitter || ''}`.toLowerCase().includes(search.toLowerCase())
  ), [reports, filterStatus, filterType, search])

  function go(next: View) {
    setView(next)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function openAuth(mode: 'login' | 'signup' = 'login') {
    setAuthMode(mode)
    setAuthError('')
    setAuthOpen(true)
  }
  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    const values = new FormData(event.currentTarget)
    try {
      const result = authMode === 'signup'
        ? await api.signup({ name: String(values.get('name')).trim(), email: String(values.get('email')).trim(), password: String(values.get('password')) })
        : await api.login({ email: String(values.get('email')).trim(), password: String(values.get('password')) })
      setUser(result.user)
      setAuthOpen(false)
      setPreview(false)
      setToast(authMode === 'signup' ? 'Your account is ready.' : `Welcome back, ${result.user.name}.`)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Could not sign in. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }
  async function logout() {
    try { await api.logout(); setUser(null); setToast('You are logged out.') }
    catch (e) { setToast(e instanceof Error ? e.message : 'Could not log out.') }
  }
  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) { openAuth('login'); setToast('Sign in to submit a report.'); return }
    setLoading(true)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const photo = form.get('photo') as File
    if (!photo?.size) form.delete('photo')
    try {
      const { report } = await api.createReport(form)
      setReports(current => [report, ...current])
      formElement.reset()
      setPreview(false)
      setApiNotice('')
      setToast('Your report has been submitted.')
      go('Reports')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not submit report. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  async function setStatus(report: Report, status: ReportStatus) {
    if (!user || !['moderator', 'admin'].includes(user.role)) return
    try {
      const { report: updated } = await api.updateStatus(report.id, status, 'Status updated by EcoWatch team.')
      setReports(rs => rs.map(r => r.id === updated.id ? updated : r))
      setDetail(updated)
      setToast('Report status updated.')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not update status.')
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden>
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
      </div>

      <header className="topbar">
        <button className="brand" onClick={() => go('Home')} aria-label="EcoReport home">
          <span className="brand-mark"><Leaf size={20} /></span>
          <span>eco<span className="brand-light">report</span><small>TEAM ECOWATCH</small></span>
        </button>
        <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">
          {mobileNav ? <X /> : <Menu />}
        </button>
        <nav className={`topnav ${mobileNav ? 'open' : ''}`} aria-label="Main navigation">
          {nav.map(({ name }) => (
            <button key={name} className={view === name ? 'nav-active' : ''} onClick={() => go(name)}>
              {name === 'Report an Issue' ? 'Report issue' : name}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          {user ? (
            <>
              <button className="user-chip" title={`${user.name} · ${user.role}`}>
                <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="user-name">{user.name.split(' ')[0]}</span>
                <ChevronDown size={14} />
              </button>
              <button className="icon-button" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={18} /></button>
            </>
          ) : (
            <>
              <button className="text-button" onClick={() => openAuth('login')}>Log in</button>
              <button className="button button-dark button-small" onClick={() => openAuth('signup')}>
                Join the community <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
      </header>

      {preview && (
        <div className="preview-banner">
          <Sparkles size={14} /> Preview mode
          <span>Showing sample community reports. Connect the Express API to use live data.</span>
        </div>
      )}

      <div className="layout">
        <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
          <div className="side-label">YOUR SPACE</div>
          {nav.map(({ name, icon: Icon }) => (
            <button key={name} className={`side-link ${view === name ? 'selected' : ''}`} onClick={() => go(name)}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{name}</span>
              {name === 'Report an Issue' && <span className="side-plus"><Plus size={14} /></span>}
            </button>
          ))}
          <div className="side-bottom">
            <div className="side-help">
              <span className="help-icon"><CircleHelp size={17} /></span>
              <b>Small actions matter.</b>
              <p>One report can help your neighborhood get noticed.</p>
              <button onClick={() => go('SDG Goals')}>About the project <ArrowRight size={14} /></button>
            </div>
            <div className="side-foot"><ShieldCheck size={14} /> Community powered · SDG 11 & 13</div>
          </div>
        </aside>

        <main className="main-content">
          {apiNotice && !preview && <div className="notice"><CloudSun size={17} /> {apiNotice}</div>}
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              {view === 'Home' && <Home reports={reports} stats={stats} onNavigate={go} onOpenReport={setDetail} />}
              {view === 'Dashboard' && (user?.role === 'admin'
                ? <AdminDashboard reports={reports} stats={stats} onNavigate={go} onOpenReport={setDetail} onStatus={setStatus} />
                : <Dashboard reports={reports} stats={stats} onNavigate={go} onOpenReport={setDetail} />)}
              {view === 'Report an Issue' && <ReportForm user={user} onSubmit={submitReport} onLogin={() => openAuth('login')} busy={loading} />}
              {view === 'Reports' && <ReportsView reports={filtered} search={search} setSearch={setSearch} status={filterStatus} setStatus={setFilterStatus} issueType={filterType} setIssueType={setFilterType} onOpen={setDetail} onCreate={() => go('Report an Issue')} />}
              {view === 'Map' && <MapView reports={filtered} issueType={filterType} setIssueType={setFilterType} status={filterStatus} setStatus={setFilterStatus} onOpen={setDetail} />}
              {view === 'Analytics' && <Analytics reports={reports} stats={stats} />}
              {view === 'SDG Goals' && <SdgPage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <footer className="site-footer">
        <span><span className="footer-leaf">✳</span> EcoReport <span className="muted">by Team EcoWatch</span></span>
        <span>Local voices. Greener neighborhoods. <span className="footer-dot">●</span></span>
        <span>Built for SDG 11 & 13</span>
      </footer>

      <AnimatePresence>
        {authOpen && (
          <AuthModal
            mode={authMode}
            setMode={m => { setAuthMode(m); setAuthError('') }}
            busy={authBusy}
            error={authError}
            apiReady={apiConfigured}
            onClose={() => setAuthOpen(false)}
            onSubmit={submitAuth}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detail && (
          <ReportModal
            report={detail}
            canModerate={!!user && ['moderator', 'admin'].includes(user.role)}
            onClose={() => setDetail(null)}
            onStatus={s => setStatus(detail, s)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div className="toast" role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <CheckCircle2 size={18} />{toast}
            <button onClick={() => setToast('')} aria-label="Dismiss"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PageTitle({ eyebrow, title, text, action }: { eyebrow?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <motion.div className="page-heading" variants={fadeUp} initial="hidden" animate="show">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </motion.div>
  )
}

function Home({ reports, stats, onNavigate, onOpenReport }: {
  reports: Report[]
  stats: { total: number; pending: number; progress: number; resolved: number }
  onNavigate: (v: View) => void
  onOpenReport: (r: Report) => void
}) {
  return (
    <>
      <section className="hero-section">
        <motion.div className="hero-copy" variants={stagger} initial="hidden" animate="show">
          <motion.div className="eyebrow" variants={fadeUp}><span className="pulse" /> A cleaner neighborhood starts here</motion.div>
          <motion.h1 variants={fadeUp}>Your neighborhood.<br /><em>Your voice.</em></motion.h1>
          <motion.p variants={fadeUp}>See an environmental issue? Share it with your community and help make local change visible.</motion.p>
          <motion.div className="hero-buttons" variants={fadeUp}>
            <button className="button button-dark" onClick={() => onNavigate('Report an Issue')}>Report an issue <ArrowRight size={17} /></button>
            <button className="button button-plain" onClick={() => onNavigate('Map')}><MapPin size={16} /> Explore the map</button>
          </motion.div>
          <motion.div className="hero-proof" variants={fadeUp}>
            <span className="avatar-stack"><i>R</i><i>A</i><i>M</i><i>+</i></span>
            <span><b>Your community is paying attention</b><small>Reports help build a clearer picture of local needs.</small></span>
          </motion.div>
        </motion.div>
        <motion.div className="hero-art" aria-label="Illustration of a greener city" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <div className="sun-disc" />
          <div className="cloud cloud-one" />
          <div className="cloud cloud-two" />
          <div className="hill hill-back" />
          <div className="hill hill-front" />
          <div className="city">
            <div className="building b1"><i /><i /><i /><i /></div>
            <div className="building b2"><i /><i /><i /><i /><i /><i /></div>
            <div className="building b3"><i /><i /><i /><i /></div>
            <div className="building b4"><i /><i /><i /></div>
          </div>
          <div className="tree tree-a"><i /><b /></div>
          <div className="tree tree-b"><i /><b /></div>
          <div className="tree tree-c"><i /><b /></div>
          <div className="hero-label"><span className="tiny-pulse" /> LIVE COMMUNITY VIEW <b>MUMBAI, MH</b></div>
          <div className="floating-pin pin-a"><MapPin size={16} /><span>Air quality</span></div>
          <div className="floating-pin pin-b"><MapPin size={16} /><span>Waste pickup</span></div>
          <div className="hero-art-caption">
            <span className="caption-icon"><Leaf size={16} /></span>
            <span><b>A little better, together.</b><small>Every report helps tell the local story.</small></span>
            <ArrowUpRight size={16} />
          </div>
        </motion.div>
      </section>

      <motion.section className="home-stats" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
        <motion.div className="stat-label" variants={fadeUp}>
          <span className="eyebrow">COMMUNITY AT A GLANCE</span>
          <b>When neighbors speak up,<br />change can take root.</b>
        </motion.div>
        <StatTile label="Reports shared" value={stats.total} icon={FileText} tone="green" />
        <StatTile label="Being addressed" value={stats.progress} icon={Activity} tone="blue" />
        <StatTile label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="gold" />
      </motion.section>

      <section className="home-lower">
        <div className="home-recent">
          <div className="section-head">
            <div>
              <div className="eyebrow">FROM AROUND THE COMMUNITY</div>
              <h2>Recent reports</h2>
            </div>
            <button className="link-button" onClick={() => onNavigate('Reports')}>View all reports <ArrowRight size={15} /></button>
          </div>
          <div className="recent-list">
            {reports.slice(0, 3).map(r => <ReportRow key={r.id} report={r} onClick={() => onOpenReport(r)} />)}
          </div>
        </div>
        <motion.div className="home-cta" whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
          <div className="cta-stamp"><Trees size={23} /></div>
          <span className="eyebrow">YOUR EYES MATTER</span>
          <h3>Notice something?<br /><em>Let’s make it visible.</em></h3>
          <p>Take a moment to share what you see. Your report helps the community understand what needs attention.</p>
          <button className="button button-dark" onClick={() => onNavigate('Report an Issue')}>Share a report <ArrowRight size={16} /></button>
          <div className="cta-decoration">✳</div>
        </motion.div>
      </section>

      <section className="how-section">
        <div className="section-head">
          <div>
            <div className="eyebrow">HOW IT WORKS</div>
            <h2>From noticing to action</h2>
          </div>
          <p>Good change starts with a simple observation.</p>
        </div>
        <motion.div className="how-steps" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <Step number="01" icon={Search} title="Notice" text="Spot a local environmental issue in your everyday surroundings." />
          <Step number="02" icon={FileText} title="Report" text="Share the location and a few details with the community." />
          <Step number="03" icon={Activity} title="Follow" text="Check in as the report moves toward a resolution." />
        </motion.div>
      </section>
    </>
  )
}

function StatTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string }) {
  return (
    <motion.div className="stat-tile" variants={fadeUp} whileHover={{ y: -6 }}>
      <span className={`stat-icon ${tone}`}><Icon size={18} /></span>
      <span className="stat-value">{value}</span>
      <span className="stat-name">{label}</span>
    </motion.div>
  )
}

function Step({ number, icon: Icon, title, text }: { number: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <motion.div className="step-card" variants={fadeUp} whileHover={{ y: -6 }}>
      <div className="step-top"><span>{number}</span><Icon size={19} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.div>
  )
}

function Dashboard({ reports, stats, onNavigate, onOpenReport }: {
  reports: Report[]
  stats: { total: number; pending: number; progress: number; resolved: number }
  onNavigate: (v: View) => void
  onOpenReport: (r: Report) => void
}) {
  const rate = stats.total ? Math.round(stats.resolved / stats.total * 100) : 0
  const statusData = [
    { name: 'Pending', value: stats.pending, fill: STATUS_COLORS.Pending },
    { name: 'In progress', value: stats.progress, fill: STATUS_COLORS['In Progress'] },
    { name: 'Resolved', value: stats.resolved, fill: STATUS_COLORS.Resolved },
  ]
  return (
    <div className="page-wrap">
      <PageTitle
        eyebrow="YOUR COMMUNITY OVERVIEW"
        title="Dashboard"
        text="A quick look at environmental reports around your community."
        action={<button className="button button-dark" onClick={() => onNavigate('Report an Issue')}><Plus size={16} /> New report</button>}
      />
      <div className="welcome-strip">
        <div className="welcome-mark"><Leaf size={19} /></div>
        <div>
          <b>Good things grow when we notice.</b>
          <p>Every report helps your community understand what needs attention.</p>
        </div>
        <span className="welcome-count"><b>{stats.total}</b> community reports</span>
      </div>
      <div className="stat-grid">
        <StatTile label="Total reports" value={stats.total} icon={FileText} tone="green" />
        <StatTile label="Awaiting action" value={stats.pending} icon={Clock3} tone="gold" />
        <StatTile label="In progress" value={stats.progress} icon={Activity} tone="blue" />
        <StatTile label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="green" />
      </div>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-head">
            <div><span className="eyebrow">LATEST ACTIVITY</span><h2>Recent reports</h2></div>
            <button className="link-button" onClick={() => onNavigate('Reports')}>See all <ArrowRight size={14} /></button>
          </div>
          {reports.slice(0, 4).map(r => <ReportRow key={r.id} report={r} onClick={() => onOpenReport(r)} />)}
        </section>
        <section className="panel impact-panel">
          <div className="panel-head">
            <div><span className="eyebrow">COMMUNITY IMPACT</span><h2>Resolution progress</h2></div>
            <span className="impact-icon"><Leaf size={18} /></span>
          </div>
          <div className="dash-chart">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={4} stroke="none">
                  {statusData.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="ring-center"><b>{rate}%</b><small>resolved</small></div>
          </div>
          <p className="impact-note">{stats.resolved} of {stats.total} reports have been resolved.</p>
          <button className="link-button" onClick={() => onNavigate('Analytics')}>Explore the numbers <ArrowRight size={14} /></button>
        </section>
      </div>
      <div className="quote-strip">
        <div className="quote-leaf">✳</div>
        <p>“When we care enough to notice, we’re already part of the solution.”</p>
        <span>— EcoWatch community</span>
      </div>
    </div>
  )
}

function AdminDashboard({ reports, stats, onNavigate, onOpenReport, onStatus }: {
  reports: Report[]
  stats: { total: number; pending: number; progress: number; resolved: number }
  onNavigate: (v: View) => void
  onOpenReport: (r: Report) => void
  onStatus: (report: Report, status: ReportStatus) => void
}) {
  return (
    <div className="page-wrap">
      <PageTitle
        eyebrow="ADMIN CONTROL CENTER"
        title="Admin Dashboard"
        text="Review community reports and keep environmental issues moving toward resolution."
        action={<button className="button button-dark" onClick={() => onNavigate('Reports')}><FileText size={16} /> Manage reports</button>}
      />
      <div className="welcome-strip">
        <div className="welcome-mark"><ShieldCheck size={19} /></div>
        <div>
          <b>Welcome, administrator.</b>
          <p>You can review reports and update their progress from this dashboard.</p>
        </div>
        <span className="welcome-count"><b>{stats.total}</b> total reports</span>
      </div>
      <div className="stat-grid">
        <StatTile label="All reports" value={stats.total} icon={FileText} tone="green" />
        <StatTile label="Pending review" value={stats.pending} icon={Clock3} tone="gold" />
        <StatTile label="In progress" value={stats.progress} icon={Activity} tone="blue" />
        <StatTile label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="green" />
      </div>
      <section className="panel recent-panel">
        <div className="panel-head">
          <div><span className="eyebrow">ADMIN QUEUE</span><h2>Recent reports</h2></div>
          <button className="link-button" onClick={() => onNavigate('Reports')}>View all <ArrowRight size={14} /></button>
        </div>
        <div className="admin-report-list">
          {reports.slice(0, 8).map(report => (
            <div className="admin-report-item" key={report.id}>
              <button className="admin-report-main" onClick={() => onOpenReport(report)}>
                <span className={`issue-symbol issue-${report.type.toLowerCase()}`}>{typeIcon[report.type] || '✳'}</span>
                <span><b>{report.type} concern</b><small>{report.id} · {report.submitter || 'Community member'} · {report.location}</small></span>
              </button>
              <select aria-label={`Update status for ${report.id}`} value={report.status} onChange={event => onStatus(report, event.target.value as ReportStatus)}>
                <option>Pending</option>
                <option>In Progress</option>
                <option>Resolved</option>
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ReportRow({ report, onClick }: { report: Report; onClick: () => void }) {
  return (
    <button className="report-row" onClick={onClick}>
      <span className={`issue-symbol issue-${report.type.toLowerCase()}`}>{typeIcon[report.type] || '✳'}</span>
      <span className="report-row-main">
        <b>{report.type} concern <small>· {report.id}</small></b>
        <span><MapPin size={13} /> {report.location}</span>
      </span>
      <span className={`status-pill ${statusClass[report.status]}`}>{report.status}</span>
      <span className="row-date">{readableDate(report.created_at)}</span>
      <ChevronRight size={16} className="row-arrow" />
    </button>
  )
}

function ReportForm({ user, onSubmit, onLogin, busy }: {
  user: User | null
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onLogin: () => void
  busy: boolean
}) {
  const [photoName, setPhotoName] = useState('')
  return (
    <div className="page-wrap">
      <PageTitle eyebrow="HELP YOUR COMMUNITY" title="Report an issue" text="A few details can help make a local environmental concern visible." />
      {!user && (
        <div className="signin-hint">
          <ShieldCheck size={19} />
          <span>
            <b>Sign in to submit your report</b>
            <small>Your account helps keep the community reporting process clear and accountable.</small>
          </span>
          <button className="button button-dark button-small" onClick={onLogin}><LogIn size={15} /> Log in</button>
        </div>
      )}
      <form className="report-form panel" onSubmit={onSubmit}>
        <div className="form-intro">
          <div className="form-step">01 <span> / 01</span></div>
          <div>
            <h2>What did you notice?</h2>
            <p>Share the details you know. You can add a photo if it helps explain the issue.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Issue type <i>*</i></span>
            <select name="type" required defaultValue="">
              <option value="" disabled>Choose a category</option>
              {issueTypes.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Severity <i>*</i></span>
            <select name="severity" required defaultValue="Medium">
              <option>Low</option><option>Medium</option><option>High</option>
            </select>
          </label>
          <label className="field field-full">
            <span>Short description <i>*</i></span>
            <textarea name="description" required minLength={12} maxLength={1000} placeholder="What is happening? Add any details that could help someone understand the issue." rows={4} />
            <small>Keep it clear and respectful. Avoid sharing anyone’s private information.</small>
          </label>
          <label className="field field-full">
            <span>Location or area <i>*</i></span>
            <div className="input-icon"><MapPin size={17} /><input name="location" required maxLength={180} placeholder="Street, landmark, neighborhood" /></div>
          </label>
          <label className="field">
            <span>Date noticed</span>
            <input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <div className="field">
            <span>Photo <small>(optional)</small></span>
            <label className="upload-box">
              <Upload size={17} />
              <span>{photoName || 'Choose a photo to add'}</span>
              <input type="file" name="photo" accept="image/*" onChange={e => setPhotoName(e.target.files?.[0]?.name || '')} />
            </label>
          </div>
          <details className="coordinate-details field-full">
            <summary><MapPin size={14} /> Add exact map coordinates <span>(optional)</span><ChevronDown size={14} /></summary>
            <div className="coordinate-grid">
              <label className="field"><span>Latitude</span><input name="latitude" type="number" min="-90" max="90" step="any" placeholder="e.g. 19.0760" /></label>
              <label className="field"><span>Longitude</span><input name="longitude" type="number" min="-180" max="180" step="any" placeholder="e.g. 72.8777" /></label>
            </div>
          </details>
        </div>
        <div className="form-footer">
          <span><ShieldCheck size={16} /> Your report will be reviewed by the community team.</span>
          <button className="button button-dark" disabled={busy}>{busy ? 'Sending report…' : 'Submit report'} {!busy && <ArrowRight size={16} />}</button>
        </div>
      </form>
      <p className="form-footnote"><i>*</i> Required fields · Reports should describe real local concerns.</p>
    </div>
  )
}

function ReportsView({ reports, search, setSearch, status, setStatus, issueType, setIssueType, onOpen, onCreate }: {
  reports: Report[]
  search: string
  setSearch: (s: string) => void
  status: string
  setStatus: (s: string) => void
  issueType: string
  setIssueType: (s: string) => void
  onOpen: (r: Report) => void
  onCreate: () => void
}) {
  return (
    <div className="page-wrap">
      <PageTitle
        eyebrow="THE NEIGHBORHOOD JOURNAL"
        title="Community reports"
        text="Browse issues shared by people in your area."
        action={<button className="button button-dark" onClick={onCreate}><Plus size={16} /> New report</button>}
      />
      <div className="toolbar panel">
        <div className="search-box">
          <Search size={17} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports or locations" aria-label="Search reports" />
        </div>
        <label className="select-filter">
          <Filter size={15} />
          <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
            <option>All</option><option>Pending</option><option>In Progress</option><option>Resolved</option>
          </select>
        </label>
        <label className="select-filter">
          <SlidersHorizontal size={15} />
          <select value={issueType} onChange={e => setIssueType(e.target.value)} aria-label="Filter by issue type">
            <option>All issues</option>
            {issueTypes.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="results-meta">
        <span><b>{reports.length}</b> {reports.length === 1 ? 'report' : 'reports'} found</span>
        <span><span className="legend-dot" /> Community submissions</span>
      </div>
      <div className="reports-table panel">
        <div className="table-header"><span>ISSUE</span><span>LOCATION</span><span>SEVERITY</span><span>STATUS</span><span>DATE</span><span /></div>
        {reports.map(r => (
          <button className="table-row" key={r.id} onClick={() => onOpen(r)}>
            <span className="table-issue">
              <span className={`issue-symbol issue-${r.type.toLowerCase()}`}>{typeIcon[r.type] || '✳'}</span>
              <span><b>{r.type} concern</b><small>{r.id} · {r.submitter || 'Community member'}</small></span>
            </span>
            <span className="table-location"><MapPin size={14} />{r.location}</span>
            <span><i className={`severity-dot sev-${r.severity.toLowerCase()}`} />{r.severity}</span>
            <span><i className={`status-pill ${statusClass[r.status]}`}>{r.status}</i></span>
            <span className="table-date">{readableDate(r.created_at)}</span>
            <ChevronRight size={16} className="row-arrow" />
          </button>
        ))}
        {reports.length === 0 && (
          <div className="empty-state">
            <span><Search size={22} /></span>
            <b>No reports match those filters</b>
            <p>Try a different search or clear one of the filters.</p>
            <button className="link-button" onClick={() => { setSearch(''); setStatus('All'); setIssueType('All issues') }}>Clear filters <X size={14} /></button>
          </div>
        )}
      </div>
      <div className="reports-footnote"><ShieldCheck size={16} /><span>Reports are community submissions. Their status reflects the latest available update.</span></div>
    </div>
  )
}

function MapView({ reports, issueType, setIssueType, status, setStatus, onOpen }: { reports: Report[]; issueType: string; setIssueType: (s: string) => void; status: string; setStatus: (s: string) => void; onOpen: (r: Report) => void }) {
  const [level, setLevel] = useState<'india' | 'state' | 'city'>('india')
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [selectedBounds, setSelectedBounds] = useState<[[number, number], [number, number]] | null>(null)
  const [search, setSearch] = useState('')
  const stateData = selectedState ? stateIssueData.find(item => item.stateName === selectedState) : null
  const visibleIssues = environmentalIssues.filter(issue => (issueType === 'All issues' || issue.category === issueType) && (status === 'All' || issue.status === status))
  const scopedIssues = selectedCity ? visibleIssues.filter(issue => issue.city === selectedCity) : selectedState ? visibleIssues.filter(issue => issue.state === selectedState) : visibleIssues
  const stats = { total: scopedIssues.length, resolved: scopedIssues.filter(i => i.status === 'Resolved').length, pending: scopedIssues.filter(i => i.status !== 'Resolved').length, critical: scopedIssues.filter(i => i.category === 'Air Pollution').length }
  const searchResults = search.trim() ? [...cityPoints.filter(city => `${city.state} ${city.city} ${city.district}`.toLowerCase().includes(search.toLowerCase())), ...environmentalIssues.filter(issue => `${issue.state} ${issue.city} ${issue.locality} ${issue.roadName}`.toLowerCase().includes(search.toLowerCase()))].slice(0, 6) : []
  function chooseState(name: string, bounds: [[number, number], [number, number]]) { setSelectedState(name); setSelectedCity(null); setSelectedBounds(bounds); setLevel('state') }
  function resetMap() { setSelectedState(null); setSelectedCity(null); setSelectedBounds(null); setLevel('india') }
  return <div className="page-wrap map-page"><PageTitle eyebrow="NATIONAL ENVIRONMENTAL MONITORING" title="India issue map" text="Drill from India to a state, city, locality and exact reported road location." /><div className="map-toolbar panel"><div><span className="eyebrow">{level === 'india' ? 'INDIA' : `${selectedState}${selectedCity ? ` / ${selectedCity}` : ''}`}</span><small>{level === 'india' ? '36 states and union territories' : level === 'state' ? 'District and city reporting view' : 'Exact GPS issue locations'}</small></div><label className="gis-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search state, city, area or road" aria-label="Search state, city, area or road" /></label><label className="select-filter"><Filter size={15} /><select value={issueType} onChange={e => setIssueType(e.target.value)}><option>All issues</option>{['Garbage', 'Air Pollution', 'Water Pollution', 'Illegal Dumping', 'Tree Cutting', 'Noise Pollution'].map(t => <option key={t}>{t}</option>)}</select></label><button className="map-reset" onClick={() => level === 'city' ? (setSelectedCity(null), setLevel('state')) : resetMap()} disabled={level === 'india'}>{level === 'city' ? 'Back to state' : 'India view'}</button></div>{searchResults.length > 0 && <div className="map-search-results">{searchResults.map(result => 'state' in result && 'city' in result && 'roadName' in result ? <button key={result.id} onClick={() => { setSearch(''); setSelectedState(result.state); setSelectedCity(result.city); setLevel('city') }}><b>{result.title}</b><small>{result.city} · {result.locality} · {result.roadName}</small></button> : <button key={`${result.state}-${result.city}`} onClick={() => { setSearch(''); setSelectedState(result.state); setSelectedCity(result.city); setLevel('city') }}><b>{result.city}</b><small>{result.state} · {result.district}</small></button>)}</div>}<div className="map-stat-row"><div><b>{stats.total}</b><span>Total reports</span></div><div><b>{stats.resolved}</b><span>Resolved</span></div><div><b>{stats.pending}</b><span>Pending</span></div><div><b>{stats.critical}</b><span>Critical</span></div></div><div className="map-layout gis-layout"><div className="map-canvas india-map gis-map"><MapContainer center={[22.5, 79]} zoom={5} minZoom={4} maxZoom={18} maxBounds={[[4, 65], [39, 101]]} maxBoundsViscosity={0.9} zoomControl={false} scrollWheelZoom><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapController level={level} bounds={selectedBounds} city={selectedCity ? cityPoints.find(item => item.city === selectedCity && item.state === selectedState) : null} /><StateBoundaryLayer selectedState={selectedState || undefined} onSelect={chooseState} /><CityLayer level={level} state={selectedState} onSelect={(city) => { setSelectedCity(city); setLevel('city') }} /><IssueMarkers issues={scopedIssues} onOpen={issue => onOpen({ id: issue.id, user_id: 'map', type: issue.category, description: issue.description, location: `${issue.roadName}, ${issue.locality}`, latitude: issue.latitude, longitude: issue.longitude, severity: issue.category === 'Air Pollution' ? 'High' : 'Medium', status: issue.status, photo_url: issue.imageUrl || null, created_at: issue.createdAt, updated_at: issue.createdAt, submitter: 'Environmental monitoring feed' })} /><ZoomControl position="topright" /></MapContainer><div className="map-stamp"><MapPin size={13} /> INDIA · OPENSTREETMAP GIS LAYER</div><div className="severity-legend"><b>ISSUE MARKERS</b><span><i className="marker-dot garbage" /> Garbage</span><span><i className="marker-dot air" /> Air pollution</span><span><i className="marker-dot water" /> Water pollution</span><span><i className="marker-dot land" /> Illegal dumping</span></div></div><aside className="state-panel panel" aria-live="polite">{stateData ? <StateDetail state={stateData} reports={scopedIssues} onClose={resetMap} /> : <div className="state-empty"><MapPin size={24} /><span className="eyebrow">{level === 'india' ? 'INDIA OVERVIEW' : 'MAP DETAIL'}</span><h2>{level === 'india' ? 'Select a state' : 'Select a city'}</h2><p>{level === 'india' ? 'Click a state to zoom into its districts and cities.' : 'Click a city marker to reveal exact issue locations.'}</p><div className="detail-hint"><ShieldCheck size={16} /> OpenStreetMap roads, streets, localities and landmarks remain visible underneath.</div></div>}</aside></div></div>
}

function MapController({ level, bounds, city }: { level: 'india' | 'state' | 'city'; bounds: [[number, number], [number, number]] | null; city: CityPoint | null | undefined }) { const map = useMap(); useEffect(() => { if (city) map.setView([city.latitude, city.longitude], 12, { animate: true }); else if (level === 'state' && bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 8, animate: true }); else if (level === 'india') map.setView([22.5, 79], 5, { animate: true }) }, [level, bounds, city, map]); return null }

function StateBoundaryLayer({ selectedState, onSelect }: { selectedState?: string; onSelect: (state: string, bounds: [[number, number], [number, number]]) => void }) { const map = useMap(); const [zoom, setZoom] = useState(map.getZoom()); useMapEvents({ zoomend: () => setZoom(map.getZoom()) }); return <GeoJSON key={`${selectedState || 'none'}-${zoom >= 8}`} data={indiaGeoJson as GeoJsonObject} style={feature => { const rawName = feature?.properties?.NAME_1 || ''; const stateName = stateNameAliases[rawName] || rawName; return { color: stateName === selectedState ? '#1f2e36' : '#4b5961', weight: stateName === selectedState ? 2.4 : 1.1, fillColor: '#ffffff', fillOpacity: stateName === selectedState ? .12 : 0 } }} onEachFeature={(feature, layer) => { const rawName = feature.properties?.NAME_1 || 'India'; const stateName = stateNameAliases[rawName] || rawName; const issue = nationalIssues.find(item => item.state === stateName); layer.bindTooltip(`<b>${stateName}</b><br />${issue?.issue || 'No issue summary'}`, { sticky: true, permanent: zoom >= 8, direction: 'top', className: 'state-tooltip' }); layer.on({ mouseover: event => event.target.setStyle({ weight: 2.4, color: '#1f2e36', fillOpacity: .18 }), mouseout: event => event.target.setStyle({ weight: stateName === selectedState ? 2.4 : 1.1, color: stateName === selectedState ? '#1f2e36' : '#4b5961', fillOpacity: stateName === selectedState ? .12 : 0 }), click: () => { const b = (layer as unknown as { getBounds: () => { getSouth: () => number; getWest: () => number; getNorth: () => number; getEast: () => number } }).getBounds(); onSelect(stateName, [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]) } }) }} /> }

function CityLayer({ level, state, onSelect }: { level: 'india' | 'state' | 'city'; state: string | null; onSelect: (city: string) => void }) { if (level !== 'state' || !state) return null; return <>{cityPoints.filter(city => city.state === state).map(city => <CircleMarker key={`${city.state}-${city.city}`} center={[city.latitude, city.longitude]} radius={city.reportCount > 0 ? 13 : 9} pathOptions={{ color: '#fff', weight: 2, fillColor: '#2c698a', fillOpacity: .95 }} eventHandlers={{ click: () => onSelect(city.city) }}><Popup><div className="map-popup"><b>{city.city}</b><span>{city.district} district</span><strong>{city.reportCount} reports</strong><button className="map-popup-action" onClick={() => onSelect(city.city)}>Open city</button></div></Popup></CircleMarker>)}</> }

function IssueMarkers({ issues, onOpen }: { issues: EnvironmentalIssue[]; onOpen: (issue: EnvironmentalIssue) => void }) { const map = useMap(); const [zoom, setZoom] = useState(map.getZoom()); useMapEvents({ zoomend: () => setZoom(map.getZoom()) }); const clusters = zoom < 12 ? Object.values(issues.reduce<Record<string, { lat: number; lng: number; items: EnvironmentalIssue[] }>>((acc, issue) => { const key = `${Math.floor(issue.latitude * 20)}-${Math.floor(issue.longitude * 20)}`; const group = acc[key] || { lat: 0, lng: 0, items: [] }; group.lat += issue.latitude; group.lng += issue.longitude; group.items.push(issue); acc[key] = group; return acc }, {})).map(group => ({ ...group, lat: group.lat / group.items.length, lng: group.lng / group.items.length })) : issues.map(issue => ({ lat: issue.latitude, lng: issue.longitude, items: [issue] })); return <>{clusters.map(cluster => <CircleMarker key={cluster.items.map(item => item.id).join('-')} center={[cluster.lat, cluster.lng]} radius={cluster.items.length > 1 ? 15 : 8} pathOptions={{ color: '#fff', weight: 2, fillColor: cluster.items.length > 1 ? '#173f63' : cluster.items[0].category === 'Air Pollution' ? '#c94c42' : '#2c698a', fillOpacity: .96 }} eventHandlers={{ click: () => cluster.items.length === 1 && onOpen(cluster.items[0]) }}><Popup>{cluster.items.length > 1 ? <div className="map-popup"><b>{cluster.items.length} issue reports</b><span>Zoom in to inspect exact road locations.</span></div> : <IssuePopup issue={cluster.items[0]} />}</Popup></CircleMarker>)}</> }

function IssuePopup({ issue }: { issue: EnvironmentalIssue }) { return <div className="map-popup issue-popup">{issue.imageUrl ? <img src={issue.imageUrl} alt="Report" /> : <div className="issue-image-placeholder">No report image attached</div>}<b>{issue.title}</b><span>{issue.category} · {issue.status}</span><span>{issue.description}</span><small><strong>GPS:</strong> {issue.latitude.toFixed(5)}, {issue.longitude.toFixed(5)}</small><small><strong>Road:</strong> {issue.roadName}, {issue.locality}</small><small><strong>Date:</strong> {readableDate(issue.createdAt)}</small></div> }

function StateDetail({ state, reports, onClose }: { state: StateIssueData; reports: EnvironmentalIssue[]; onClose: () => void }) { const issue = nationalIssues.find(item => item.state === state.stateName); return <div className="state-detail"><div className="state-detail-head"><div><span className="eyebrow">STATE / UNION TERRITORY</span><h2>{state.stateName}</h2></div><button className="panel-close" onClick={onClose} aria-label="Close state detail"><X size={16} /></button></div><div className="severity-banner"><span>{state.severity.toUpperCase()} ISSUE LEVEL</span><b>{issue?.issue}</b></div><div className="state-stats"><div><b>{reports.length}</b><small>Total reports</small></div><div><b>{reports.filter(r => r.status === 'Resolved').length}</b><small>Resolved</small></div><div><b>{reports.filter(r => r.status !== 'Resolved').length}</b><small>Pending</small></div></div><div className="detail-section"><span className="eyebrow">MAIN ENVIRONMENTAL ISSUE</span><p>{issue?.summary || 'No issue summary available.'}</p></div><div className="detail-section"><span className="eyebrow">RECENT COMMUNITY REPORTS</span>{reports.length ? reports.slice(0, 3).map(report => <div className="mini-report" key={report.id}><b>{report.category} · {report.status}</b><small>{report.roadName}, {report.locality}</small></div>) : <p className="detail-muted">No exact issue reports in this state feed.</p>}</div><div className="sdg-impact"><span className="eyebrow">SDG GOALS IMPACTED</span><div><span>SDG 3 · Good health</span><span>SDG 6 · Clean water</span><span>SDG 11 · Sustainable cities</span><span>SDG 13 · Climate action</span></div></div><a className="source-link" href={issue?.sourceUrl} target="_blank" rel="noreferrer">View source: {issue?.source} <ExternalLink size={13} /></a></div> }

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #d7e6d8',
  background: 'rgba(255,255,255,0.95)',
  fontSize: 12,
  color: '#164433',
}

function Analytics({ reports, stats }: { reports: Report[]; stats: { total: number; pending: number; progress: number; resolved: number } }) {
  const cats = issueTypes.slice(0, 5).map((type, i) => ({ type, count: reports.filter(r => r.type === type).length, fill: CHART_COLORS[i] }))
  const rate = stats.total ? Math.round(stats.resolved / stats.total * 100) : 0
  const statusTrend = [
    { name: 'Pending', value: stats.pending },
    { name: 'In progress', value: stats.progress },
    { name: 'Resolved', value: stats.resolved },
  ]
  return (
    <div className="page-wrap">
      <PageTitle eyebrow="UNDERSTAND THE PATTERNS" title="Community insights" text="A simple snapshot of the reports shared with EcoReport." />
      <div className="stat-grid">
        <StatTile label="Total reports" value={stats.total} icon={FileText} tone="green" />
        <StatTile label="Pending" value={stats.pending} icon={Clock3} tone="gold" />
        <StatTile label="In progress" value={stats.progress} icon={Activity} tone="blue" />
        <StatTile label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="green" />
      </div>
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div><span className="eyebrow">REPORT CATEGORIES</span><h2>What neighbors are noticing</h2></div>
            <span className="period-label">ALL REPORTS</span>
          </div>
          <div className="rechart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cats} barSize={28}>
                <CartesianGrid stroke="#e6efe6" vertical={false} />
                <XAxis dataKey="type" tick={{ fill: '#5d7468', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#5d7468', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[10, 10, 6, 6]}>
                  {cats.map(c => <Cell key={c.type} fill={c.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">Counts are calculated from the currently loaded report records.</p>
        </section>
        <section className="panel rate-panel">
          <div className="panel-head">
            <div><span className="eyebrow">FOLLOW-THROUGH</span><h2>Resolution rate</h2></div>
            <span className="rate-icon"><Check size={17} /></span>
          </div>
          <div className="rate-number">{rate}<small>%</small></div>
          <div className="rechart-wrap short">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={statusTrend}>
                <defs>
                  <linearGradient id="ecoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f7a54" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1f7a54" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fill: '#5d7468', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="value" stroke="#1f7a54" strokeWidth={2.5} fill="url(#ecoFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p><b>{stats.resolved} reports resolved</b> out of {stats.total} total reports.</p>
          <span className="rate-foot"><ArrowUpRight size={14} /> Keep checking back as updates come in.</span>
        </section>
      </div>
      <div className="analytics-callout">
        <div className="callout-mark"><CloudSun size={20} /></div>
        <div>
          <b>Every data point starts with a person who noticed.</b>
          <p>These numbers describe the reports currently available to this page, not a complete measure of environmental conditions.</p>
        </div>
      </div>
    </div>
  )
}

function SdgPage() {
  return (
    <div className="page-wrap">
      <PageTitle eyebrow="LOCAL ACTION, GLOBAL GOALS" title="A greener future, together." text="EcoReport supports community awareness and participation in environmental care." />
      <div className="sdg-intro">
        <span className="sdg-leaf"><Leaf size={22} /></span>
        <div>
          <b>Small local actions are part of a bigger picture.</b>
          <p>When communities document local concerns and follow progress, they can build awareness and support more sustainable neighborhoods.</p>
        </div>
      </div>
      <div className="sdg-grid">
        <article className="sdg-card sdg-11">
          <div className="sdg-top"><span className="sdg-number">11</span><span className="sdg-wordmark">SUSTAINABLE<br />DEVELOPMENT<br />GOALS</span></div>
          <div className="sdg-card-body">
            <span className="eyebrow">SUSTAINABLE CITIES & COMMUNITIES</span>
            <h2>Make cities inclusive, safe, resilient and sustainable.</h2>
            <p>EcoReport gives residents a simple way to share concerns about their local surroundings and see what has been reported.</p>
            <div className="sdg-points">
              <span><Check size={15} /> Supports citizen participation</span>
              <span><Check size={15} /> Makes local concerns easier to see</span>
              <span><Check size={15} /> Encourages cleaner shared spaces</span>
            </div>
          </div>
        </article>
        <article className="sdg-card sdg-13">
          <div className="sdg-top"><span className="sdg-number">13</span><span className="sdg-wordmark">SUSTAINABLE<br />DEVELOPMENT<br />GOALS</span></div>
          <div className="sdg-card-body">
            <span className="eyebrow">CLIMATE ACTION</span>
            <h2>Take urgent action to combat climate change.</h2>
            <p>By making environmental observations visible, the project encourages awareness and local action around shared environmental challenges.</p>
            <div className="sdg-points">
              <span><Check size={15} /> Raises environmental awareness</span>
              <span><Check size={15} /> Helps communities notice patterns</span>
              <span><Check size={15} /> Encourages early local action</span>
            </div>
          </div>
        </article>
      </div>
      <div className="sdg-note">
        <Globe2 size={18} />
        <span><b>Project note</b><small>EcoReport is a student initiative that supports awareness and reporting. It is not an official UN or municipal service.</small></span>
      </div>
    </div>
  )
}

function AuthModal({ mode, setMode, busy, error, apiReady, onClose, onSubmit }: {
  mode: 'login' | 'signup'
  setMode: (m: 'login' | 'signup') => void
  busy: boolean
  error: string
  apiReady: boolean
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <motion.div className="modal-backdrop" role="presentation" onMouseDown={(e: MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose() }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="auth-emblem"><Leaf size={22} /></div>
        <span className="eyebrow">A COMMUNITY THAT NOTICES</span>
        <h2 id="auth-title">{mode === 'login' ? 'Welcome back.' : 'Join your community.'}</h2>
        <p>{mode === 'login' ? 'Sign in to submit reports and follow local updates.' : 'Create an account to share what you notice.'}</p>
        {!apiReady && (
          <div className="backend-hint">
            <CircleHelp size={16} />
            <span>
              <b>Backend not connected yet</b>
              <small>Preview browsing works. Sign in and report submission will work after the Express API is running and configured.</small>
            </span>
          </div>
        )}
        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
        </div>
        <form onSubmit={onSubmit} className="auth-form">
          {mode === 'signup' && <label className="field"><span>Full name</span><input name="name" autoComplete="name" required placeholder="Your name" /></label>}
          <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
          <label className="field"><span>Password</span><input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} placeholder="At least 8 characters" /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-dark auth-submit" disabled={busy || !apiReady}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in to EcoReport' : 'Create account'}
            {apiReady && !busy && <ArrowRight size={16} />}
          </button>
        </form>
        <small className="auth-privacy"><ShieldCheck size={14} /> Your account is managed securely by the EcoReport server.</small>
      </motion.section>
    </motion.div>
  )
}

function ReportModal({ report, canModerate, onClose, onStatus }: {
  report: Report
  canModerate: boolean
  onClose: () => void
  onStatus: (s: ReportStatus) => void
}) {
  const updates = report.updates || [{ id: 'created', report_id: report.id, changed_by: report.submitter || 'Community member', old_status: null, new_status: 'Pending' as ReportStatus, note: 'Report shared with the community.', created_at: report.created_at }]
  return (
    <motion.div className="modal-backdrop" role="presentation" onMouseDown={(e: MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose() }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="detail-topline">
          <span className="eyebrow">COMMUNITY REPORT · {report.id}</span>
          <span className={`status-pill ${statusClass[report.status]}`}>{report.status}</span>
        </div>
        <div className="detail-title-line">
          <span className={`issue-symbol issue-${report.type.toLowerCase()}`}>{typeIcon[report.type] || '✳'}</span>
          <div>
            <h2 id="detail-title">{report.type} concern</h2>
            <span>{report.severity} severity · shared {readableDate(report.created_at)}</span>
          </div>
        </div>
        <p className="detail-description">{report.description}</p>
        <div className="detail-location">
          <MapPin size={17} />
          <span>
            <b>{report.location}</b>
            <small>{report.latitude != null && report.longitude != null ? 'Location coordinates are available' : 'Approximate area provided by reporter'}</small>
          </span>
        </div>
        <div className="timeline-head">
          <h3>Report progress</h3>
          <span>{updates.length} {updates.length === 1 ? 'update' : 'updates'}</span>
        </div>
        <div className="timeline">
          {updates.map((u, i) => (
            <div className="timeline-item" key={u.id}>
              <span className={`timeline-dot ${i === updates.length - 1 ? 'current' : ''}`}>{i === updates.length - 1 && <Check size={11} />}</span>
              <div>
                <b>{u.new_status}</b>
                <small>{u.note || `Status updated by ${u.changed_by}`}</small>
                <span>{readableDate(u.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
        {canModerate && (
          <div className="moderator-actions">
            <span><ShieldCheck size={15} /> Moderator tools</span>
            <select aria-label="Update report status" value={report.status} onChange={e => onStatus(e.target.value as ReportStatus)}>
              <option>Pending</option><option>In Progress</option><option>Resolved</option>
            </select>
          </div>
        )}
      </motion.section>
    </motion.div>
  )
}
