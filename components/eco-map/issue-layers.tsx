'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from './leaflet-setup'
import 'leaflet.markercluster'
import { centroid, maxSeverity, SEVERITY_META } from '@/lib/issues/meta'
import type { Issue, Selection, Severity } from '@/lib/issues/types'
import { buildIssuePopup } from './issue-popup'

type IssueMarker = L.Marker & { severity: Severity }

function issueIcon(severity: Severity, selected: boolean) {
  const size = selected ? 22 : 16
  return L.divIcon({
    className: '',
    html: `<span class="eco-marker" data-selected="${selected}" style="width:${size}px;height:${size}px;background:${SEVERITY_META[severity].color}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

function clusterIcon(cluster: L.MarkerCluster) {
  const markers = cluster.getAllChildMarkers() as IssueMarker[]
  const count = markers.length
  let top: Severity = 'low'
  for (const m of markers) if (SEVERITY_META[m.severity].rank > SEVERITY_META[top].rank) top = m.severity
  const size = count < 5 ? 34 : count < 15 ? 40 : 48
  return L.divIcon({
    className: '',
    html: `<div class="eco-cluster" style="width:${size}px;height:${size}px;--ring-color:${SEVERITY_META[top].color}" aria-label="${count} issues">${count}</div>`,
    iconSize: [size, size],
  })
}

interface IssueClusterLayerProps {
  issues: Issue[]
  selectedId?: string
  onSelectIssue: (issue: Issue) => void
}

export function IssueClusterLayer({ issues, selectedId, onSelectIssue }: IssueClusterLayerProps) {
  const map = useMap()
  const markersRef = useRef(new Map<string, IssueMarker>())
  const groupRef = useRef<L.MarkerClusterGroup | null>(null)
  const onSelectRef = useRef(onSelectIssue)
  const selectedRef = useRef(selectedId)
  onSelectRef.current = onSelectIssue
  selectedRef.current = selectedId

  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: clusterIcon,
    })
    const markers = new Map<string, IssueMarker>()
    for (const issue of issues) {
      const marker = L.marker([issue.latitude, issue.longitude], {
        icon: issueIcon(issue.severity, issue.id === selectedRef.current),
        title: issue.title,
        keyboard: true,
        riseOnHover: true,
      }) as IssueMarker
      marker.severity = issue.severity
      marker.bindPopup(buildIssuePopup(issue), { className: 'eco-popup', maxWidth: 280, autoPanPadding: [24, 24] })
      marker.on('click', () => onSelectRef.current(issue))
      markers.set(issue.id, marker)
      group.addLayer(marker)
    }
    map.addLayer(group)
    markersRef.current = markers
    groupRef.current = group
    return () => {
      map.removeLayer(group)
      groupRef.current = null
    }
  }, [issues, map])

  const previousSelected = useRef<string | undefined>(undefined)
  useEffect(() => {
    const markers = markersRef.current
    const prev = previousSelected.current
    if (prev && markers.has(prev)) markers.get(prev)!.setIcon(issueIcon(markers.get(prev)!.severity, false))
    previousSelected.current = selectedId
    if (!selectedId) return
    const marker = markers.get(selectedId)
    if (!marker) return
    marker.setIcon(issueIcon(marker.severity, true))
    const target = marker.getLatLng()
    const open = () => {
      groupRef.current?.zoomToShowLayer(marker, () => marker.openPopup())
    }
    if (map.getZoom() >= 16 && map.getBounds().pad(-0.2).contains(target)) {
      open()
    } else {
      map.once('moveend', open)
      map.flyTo(target, 17, { duration: 1.1 })
    }
  }, [selectedId, issues, map])

  return null
}

interface PlaceLabel {
  key: string
  label: string
  count: number
  severity: Severity
  position: [number, number]
  next: Selection
}

function buildPlaces(issues: Issue[], selection: Selection): PlaceLabel[] {
  if (!selection.state || selection.issueId) return []
  const scoped = issues.filter((i) => i.state === selection.state)
  const groupKey: (i: Issue) => string = selection.city ? (i) => i.locality : (i) => i.city
  const pool = selection.city ? scoped.filter((i) => i.city === selection.city) : scoped
  const groups = new Map<string, Issue[]>()
  for (const issue of pool) {
    const key = groupKey(issue)
    groups.set(key, [...(groups.get(key) ?? []), issue])
  }
  return [...groups.entries()].map(([name, group]) => ({
    key: name,
    label: name,
    count: group.length,
    severity: maxSeverity(group) ?? 'low',
    position: centroid(group),
    next: selection.city
      ? { state: selection.state, city: selection.city, locality: name }
      : { state: selection.state, city: name },
  }))
}

export function PlacesLayer({
  issues,
  selection,
  onSelect,
}: {
  issues: Issue[]
  selection: Selection
  onSelect: (selection: Selection) => void
}) {
  const map = useMap()
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const places = buildPlaces(issues, selection)
    const layer = L.layerGroup()
    for (const place of places) {
      const active = place.label === selection.locality
      L.marker(place.position, {
        icon: L.divIcon({
          className: '',
          html: `<span class="eco-place" style="margin-top:-14px;${active ? 'border-color:#0f3d2e;background:#0f3d2e;color:#fff' : ''}"><span style="width:8px;height:8px;border-radius:9999px;background:${SEVERITY_META[place.severity].color}"></span>${place.label}<span class="eco-place-count" style="${active ? 'color:#cfe3d8' : ''}">${place.count}</span></span>`,
          iconSize: [0, 0],
        }),
        zIndexOffset: 1000,
        keyboard: true,
        title: `${place.label}: ${place.count} issues`,
      })
        .on('click', () => onSelectRef.current(place.next))
        .addTo(layer)
    }
    layer.addTo(map)
    return () => {
      layer.remove()
    }
  }, [issues, selection, map])

  return null
}
