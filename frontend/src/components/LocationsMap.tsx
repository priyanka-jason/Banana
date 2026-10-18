import { useEffect, useRef, useState } from 'react'
import {
  Map,
  GeoJSONSource,
  Marker,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { SearchOrigin } from '../data/storeLocations'
import { radiusRing, type NearbyBranch } from '../lib/locations'

setWorkerUrl(workerUrl)

interface Props {
  origin: SearchOrigin
  radius: number
  branches: NearbyBranch[]
  visible: boolean
  selectedId?: string
  onSelect: (id: string) => void
}

export default function LocationsMap({
  origin,
  radius,
  branches,
  selectedId,
  visible,
  onSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const region = useRef({ origin, radius })
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    region.current = { origin, radius }
  }, [origin, radius])
  useEffect(() => {
    if (!container.current) return
    let map: Map
    try {
      map = new Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [-123.105, 49.262],
        zoom: 11,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      })
    } catch {
      const frame = window.requestAnimationFrame(() => setUnavailable(true))
      return () => window.cancelAnimationFrame(frame)
    }
    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      // Restyle the provider's geographic layers; keep its geometry and attribution.
      for (const layer of map.getStyle().layers) {
        if (layer.id.startsWith('poi'))
          map.setLayoutProperty(layer.id, 'visibility', 'none')
        if (layer.id === 'water')
          map.setPaintProperty(layer.id, 'fill-color', '#b4ddeb')
        if (layer.id === 'park')
          map.setPaintProperty(layer.id, 'fill-color', '#e2ecd9')
        if (
          layer.type === 'line' &&
          layer.id.startsWith('road_') &&
          !layer.id.includes('rail')
        )
          map.setPaintProperty(
            layer.id,
            'line-color',
            layer.id.includes('casing') ? '#d9dedb' : '#ffffff',
          )
      }
      setReady(true)
      setUnavailable(false)
    })
    map.on('error', () => setUnavailable(true))
    const timeout = window.setTimeout(() => {
      if (!map.isStyleLoaded()) setUnavailable(true)
    }, 18000)
    const observer = new ResizeObserver(() => {
      map.resize()
      if (map.getSource('search-radius') && container.current?.clientWidth) {
        const bounds = new LngLatBounds()
        radiusRing(region.current.origin, region.current.radius).forEach(
          (point) => bounds.extend(point),
        )
        map.fitBounds(bounds, { padding: 38, duration: 0 })
      }
    })
    observer.observe(container.current)
    return () => {
      window.clearTimeout(timeout)
      observer.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [retry])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.resize()
    const ring = radiusRing(origin, radius)
    const collection = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'Polygon' as const, coordinates: [ring] },
        },
      ],
    }
    if (map.getSource('search-radius')) {
      const source = map.getSource('search-radius')
      if (source instanceof GeoJSONSource) source.setData(collection)
    } else {
      map.addSource('search-radius', { type: 'geojson', data: collection })
      map.addLayer({
        id: 'search-radius-fill',
        type: 'fill',
        source: 'search-radius',
        paint: { 'fill-color': '#ffdc59', 'fill-opacity': 0.09 },
      })
      map.addLayer({
        id: 'search-radius-line',
        type: 'line',
        source: 'search-radius',
        paint: {
          'line-color': '#d6ae24',
          'line-width': 2,
          'line-dasharray': [3, 3],
        },
      })
    }
    const bounds = new LngLatBounds()
    ring.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds, { padding: 38, duration: 0 })
    const originMarker = new Marker({ color: '#3788e5', scale: 0.8 })
      .setLngLat([origin.longitude, origin.latitude])
      .addTo(map)
    originMarker.getElement().setAttribute('aria-label', 'Search location')
    return () => {
      originMarker.remove()
    }
  }, [origin, radius, ready, visible])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const markers = branches.map((branch, index) => {
      const selected = branch.id === selectedId
      const marker = new Marker({
        color: selected ? '#163e2c' : '#cfaa21',
        scale: selected ? 1.15 : 1,
      })
        .setLngLat([branch.longitude, branch.latitude])
        .addTo(map)
      const element = marker.getElement()
      element.setAttribute('role', 'button')
      element.setAttribute('tabindex', '0')
      element.setAttribute(
        'aria-label',
        `Select ${branch.store.name}, ${branch.name}, ${branch.distance.toFixed(1)} km`,
      )
      element.setAttribute('aria-pressed', String(selected))
      const number = document.createElement('span')
      number.className = 'map-marker-number'
      number.textContent = String(index + 1)
      element.append(number)
      element.addEventListener('click', () => onSelect(branch.id))
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(branch.id)
        }
      })
      return marker
    })
    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [branches, selectedId, ready, onSelect])

  return (
    <div className="locations-map" aria-label="Nearby grocery stores map">
      <div className="map-canvas" ref={container} />
      {!ready && !unavailable && (
        <p className="map-message" role="status">
          Loading map…
        </p>
      )}
      {unavailable && (
        <div className="map-message" role="status">
          <strong>Map unavailable</strong>
          <p>You can still browse every nearby store in the list.</p>
          <button
            className="text-button"
            onClick={() => {
              setUnavailable(false)
              setReady(false)
              setRetry((value) => value + 1)
            }}
          >
            Retry map
          </button>
        </div>
      )}
      <p className="map-sample-label">Sample store locations · Live map</p>
    </div>
  )
}
