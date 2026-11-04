export type Coordinates = { latitude: number; longitude: number }

export type AddressResult = {
  displayName: string
  address: Record<string, string>
}

export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location detection is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      error => reject(new Error(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. You can enter the area manually.'
        : 'Unable to detect your location. Check your device settings and try again.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  })
}

export async function reverseGeocode({ latitude, longitude }: Coordinates): Promise<AddressResult> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('addressdetails', '1')
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('The address lookup service is unavailable. You can enter the area manually.')
  const data = await response.json() as { display_name?: string; address?: Record<string, string> }
  return { displayName: data.display_name || '', address: data.address || {} }
}

export function formatAddress(address: Record<string, string>, fallback: string) {
  const parts = [
    address.road || address.pedestrian || address.footway,
    address.neighbourhood || address.suburb || address.quarter,
    address.landmark,
    address.city || address.town || address.village || address.municipality,
    address.state,
    address.postcode,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : fallback
}

export function mapsUrl({ latitude, longitude }: Coordinates) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`
}
