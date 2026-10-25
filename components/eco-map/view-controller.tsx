'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from './leaflet-setup'
import { getLevel, issuesInScope } from '@/lib/issues/meta'
import type { Issue, Selection } from '@/lib/issues/types'
import type { StatesCollection } from './boundary-layers'

export const INDIA_BOUNDS = L.latLngBounds([6.2, 67.5], [37.6, 97.6])

const MAX_ZOOM_BY_LEVEL = { city: 13, locality: 15, road: 16 } as const

export function ViewController({
  selection,
  issues,
  states,
}: {
  selection: Selection
  issues: Issue[]
  states?: StatesCollection
}) {
  const map = useMap()
  const level = getLevel(selection)
  const key = [selection.state, selection.city, selection.locality, selection.road].join('|')

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  useEffect(() => {
    if (level === 'issue') return
    const opts = { padding: [48, 48] as L.PointTuple, duration: 0.9 }

    if (level === 'india') {
      map.flyToBounds(INDIA_BOUNDS, { ...opts, padding: [16, 16] })
      return
    }
    if (level === 'state') {
      const feature = states?.features.find((f) => f.properties.st_nm === selection.state)
      if (feature) map.flyToBounds(L.geoJSON(feature).getBounds(), opts)
      return
    }
    const scoped = issuesInScope(issues, selection)
    if (scoped.length === 0) return
    const bounds = L.latLngBounds(scoped.map((i) => [i.latitude, i.longitude] as L.LatLngTuple))
    map.flyToBounds(bounds, { ...opts, maxZoom: MAX_ZOOM_BY_LEVEL[level] })
    // Only re-run when the place scope changes, not on every issue array identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, level, map, states])

  return null
}
