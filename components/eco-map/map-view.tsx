'use client'

import 'leaflet/dist/leaflet.css'
import { useMemo } from 'react'
import useSWR from 'swr'
import { LayersControl, MapContainer, TileLayer, ZoomControl } from 'react-leaflet'
import type { Issue, Selection } from '@/lib/issues/types'
import { DistrictsLayer, StatesLayer, type DistrictsCollection, type StatesCollection } from './boundary-layers'
import { IssueClusterLayer, PlacesLayer } from './issue-layers'
import { INDIA_BOUNDS, ViewController } from './view-controller'

const fetchJson = (url: string) => fetch(url).then((res) => res.json())

interface MapViewProps {
  issues: Issue[]
  allIssues: Issue[]
  selection: Selection
  onSelect: (selection: Selection) => void
  onSelectIssue: (issue: Issue) => void
}

export default function MapView({ issues, allIssues, selection, onSelect, onSelectIssue }: MapViewProps) {
  const { data: states } = useSWR<StatesCollection>('/geo/india-states.json', fetchJson, {
    revalidateOnFocus: false,
  })
  const { data: districts } = useSWR<DistrictsCollection>(
    selection.state ? '/geo/india-districts.json' : null,
    fetchJson,
    { revalidateOnFocus: false },
  )

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const issue of issues) map.set(issue.state, (map.get(issue.state) ?? 0) + 1)
    return map
  }, [issues])

  return (
    <MapContainer
      bounds={INDIA_BOUNDS}
      boundsOptions={{ padding: [24, 24] }}
      minZoom={4}
      maxZoom={19}
      zoomControl={false}
      zoomSnap={0.25}
      zoomDelta={0.5}
      worldCopyJump={false}
      className="size-full"
      attributionControl
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OpenStreetMap">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="OSM Light (CARTO)">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxZoom={20}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      <ZoomControl position="bottomright" />

      {states && (
        <StatesLayer
          data={states}
          selectedState={selection.state}
          issueCounts={counts}
          onSelectState={(state) => onSelect({ state })}
        />
      )}
      {districts && <DistrictsLayer data={districts} selectedState={selection.state} />}
      <IssueClusterLayer issues={issues} selectedId={selection.issueId} onSelectIssue={onSelectIssue} />
      <PlacesLayer issues={issues} selection={selection} onSelect={onSelect} />
      <ViewController selection={selection} issues={allIssues} states={states} />
    </MapContainer>
  )
}
