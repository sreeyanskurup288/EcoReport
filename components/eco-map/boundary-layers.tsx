'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import L from './leaflet-setup'

type StateProps = { st_nm: string }
type DistrictProps = { st_nm: string; district: string }

export type StatesCollection = FeatureCollection<Geometry, StateProps>
export type DistrictsCollection = FeatureCollection<Geometry, DistrictProps>

const BASE_INDIA: L.PathOptions = {
  color: '#3f4a46',
  weight: 1,
  fillColor: '#ffffff',
  fillOpacity: 0.45,
}
const SELECTED: L.PathOptions = {
  color: '#14201b',
  weight: 2.5,
  fillColor: '#ffffff',
  fillOpacity: 0,
}
const DIMMED: L.PathOptions = {
  color: '#8a958f',
  weight: 0.8,
  fillColor: '#f1f4f2',
  fillOpacity: 0.72,
}
const HOVER: L.PathOptions = {
  color: '#0f3d2e',
  weight: 2,
  fillColor: '#d7e7de',
  fillOpacity: 0.55,
}

function stateStyle(name: string, selected: string | undefined, hovered: boolean): L.PathOptions {
  if (selected === name) return SELECTED
  if (hovered) return HOVER
  return selected ? DIMMED : BASE_INDIA
}

interface StatesLayerProps {
  data: StatesCollection
  selectedState?: string
  issueCounts: Map<string, number>
  onSelectState: (state: string) => void
}

export function StatesLayer({ data, selectedState, issueCounts, onSelectState }: StatesLayerProps) {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)
  const selectedRef = useRef(selectedState)
  const countsRef = useRef(issueCounts)
  const onSelectRef = useRef(onSelectState)

  selectedRef.current = selectedState
  countsRef.current = issueCounts
  onSelectRef.current = onSelectState

  useEffect(() => {
    const layer = L.geoJSON(data, {
      style: (feature) => stateStyle(feature?.properties.st_nm ?? '', selectedRef.current, false),
      onEachFeature: (feature: Feature<Geometry, StateProps>, path) => {
        const name = feature.properties.st_nm
        path.bindTooltip(
          () => {
            const count = countsRef.current.get(name) ?? 0
            return `${name}<span style="opacity:.65;font-weight:500"> · ${count} ${count === 1 ? 'issue' : 'issues'}</span>`
          },
          { sticky: true, className: 'eco-tooltip', direction: 'top', offset: [0, -8] },
        )
        path.on({
          mouseover: () => {
            ;(path as L.Path).setStyle(stateStyle(name, selectedRef.current, true))
          },
          mouseout: () => {
            ;(path as L.Path).setStyle(stateStyle(name, selectedRef.current, false))
          },
          click: () => onSelectRef.current(name),
        })
      },
    }).addTo(map)
    layerRef.current = layer
    return () => {
      layer.remove()
      layerRef.current = null
    }
  }, [data, map])

  useEffect(() => {
    layerRef.current?.eachLayer((path) => {
      const feature = (path as L.Path & { feature: Feature<Geometry, StateProps> }).feature
      ;(path as L.Path).setStyle(stateStyle(feature.properties.st_nm, selectedState, false))
    })
  }, [selectedState])

  return null
}

const DISTRICT: L.PathOptions = {
  color: '#5b6863',
  weight: 1,
  dashArray: '4 4',
  fillColor: '#0f3d2e',
  fillOpacity: 0,
}
const DISTRICT_HOVER: L.PathOptions = { ...DISTRICT, dashArray: undefined, weight: 1.8, fillOpacity: 0.08 }

export function DistrictsLayer({ data, selectedState }: { data: DistrictsCollection; selectedState?: string }) {
  const map = useMap()

  useEffect(() => {
    if (!selectedState) return
    const features = data.features.filter((f) => f.properties.st_nm === selectedState)
    const layer = L.geoJSON({ type: 'FeatureCollection', features } as DistrictsCollection, {
      style: () => DISTRICT,
      onEachFeature: (feature: Feature<Geometry, DistrictProps>, path) => {
        path.bindTooltip(`${feature.properties.district}<span style="opacity:.65;font-weight:500"> · District</span>`, {
          sticky: true,
          className: 'eco-tooltip',
          direction: 'top',
          offset: [0, -8],
        })
        path.on({
          mouseover: () => (path as L.Path).setStyle(DISTRICT_HOVER),
          mouseout: () => (path as L.Path).setStyle(DISTRICT),
          dblclick: (event) => {
            L.DomEvent.stop(event)
            map.flyToBounds((path as L.Polygon).getBounds(), { padding: [40, 40], duration: 0.8 })
          },
        })
      },
    }).addTo(map)
    return () => {
      layer.remove()
    }
  }, [data, map, selectedState])

  return null
}
