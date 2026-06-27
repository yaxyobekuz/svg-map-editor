/**
 * Loads the Google Maps JS API, creates a satellite map in the given container,
 * and installs a custom OverlayView so we can project lat/lng <-> screen pixels.
 *
 * Returns the map, a live `Projector`, and a `version` counter that increments
 * on every map movement (drag/zoom/resize). Consumers re-render the SVG overlay
 * whenever `version` changes so drawn shapes stay glued to the map.
 */

import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useEffect, useRef, useState } from 'react'
import { makeProjector, type Projector } from './geo'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

// Tashkent as a sensible default center.
const DEFAULT_CENTER = { lat: 41.311081, lng: 69.240562 }
const DEFAULT_ZOOM = 18

export interface MapHandle {
  map: google.maps.Map | null
  projector: Projector | null
  /** Bumps on every map move; used to drive overlay re-renders. */
  version: number
  status: 'loading' | 'ready' | 'no-key' | 'error'
  error?: string
}

export function useGoogleMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
): MapHandle {
  const [handle, setHandle] = useState<MapHandle>({
    map: null,
    projector: null,
    version: 0,
    status: API_KEY ? 'loading' : 'no-key',
  })

  // Keep the projector in a ref so the bump callback always sees the latest.
  const projectorRef = useRef<Projector | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)

  useEffect(() => {
    if (!API_KEY) {
      setHandle((h) => ({ ...h, status: 'no-key' }))
      return
    }
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let listeners: google.maps.MapsEventListener[] = []
    let overlay: google.maps.OverlayView | null = null

    setOptions({ key: API_KEY, v: 'weekly' })

    importLibrary('maps')
      .then(({ Map }) => {
        if (cancelled) return

        const map = new Map(container, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeId: 'satellite',
          tilt: 0, // force flat 2D
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
          keyboardShortcuts: false,
          // Allow smooth fractional zoom levels so our wheel handler can do
          // gentle sub-level steps instead of snapping to whole levels.
          isFractionalZoomEnabled: true,
        })
        mapRef.current = map

        const bump = () =>
          setHandle((h) => ({
            ...h,
            map,
            projector: projectorRef.current,
            status: 'ready',
            version: h.version + 1,
          }))

        // A custom overlay just to access the projection.
        class ProjectionOverlay extends google.maps.OverlayView {
          onAdd() {}
          draw() {
            const projection = this.getProjection()
            if (projection) {
              projectorRef.current = makeProjector(projection)
            }
            bump()
          }
          onRemove() {}
        }
        overlay = new ProjectionOverlay()
        overlay.setMap(map)

        // Re-project on every kind of movement.
        listeners = [
          map.addListener('bounds_changed', bump),
          map.addListener('center_changed', bump),
          map.addListener('zoom_changed', bump),
          map.addListener('drag', bump),
          map.addListener('idle', bump),
        ]
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setHandle((h) => ({
          ...h,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }))
      })

    return () => {
      cancelled = true
      listeners.forEach((l) => l.remove())
      if (overlay) overlay.setMap(null)
    }
  }, [containerRef])

  return handle
}
