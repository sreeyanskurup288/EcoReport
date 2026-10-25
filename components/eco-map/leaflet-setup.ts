import L from 'leaflet'

// leaflet.markercluster's UMD build attaches itself to a global `L`.
if (typeof window !== 'undefined') {
  ;(window as unknown as { L: typeof L }).L = L
}

export default L
