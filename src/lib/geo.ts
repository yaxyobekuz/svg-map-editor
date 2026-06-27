/**
 * Geographic <-> screen-pixel projection helpers.
 *
 * The single source of truth for projection is a Google Maps `OverlayView`,
 * whose `getProjection().fromLatLngToContainerPixel` / `fromContainerPixelToLatLng`
 * map between geo coords and CSS pixels in the map container. We wrap those so
 * the rest of the app speaks our own `LatLng` / `Point` / `GeoBounds` types and
 * never touches the google namespace directly.
 */

import type { GeoBounds, LatLng, Point } from '../types'

/** Earth radius in meters (spherical approximation — fine at local scale). */
const EARTH_RADIUS_M = 6_378_137

/** Meters per degree of latitude (constant enough at local scale). */
const METERS_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M

/** Meters per degree of longitude at a given latitude. */
export function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
}

/**
 * A live projector backed by the map's current OverlayView projection.
 * Recreated/refreshed by the map component on every render of the overlay.
 */
export interface Projector {
  toPixel(p: LatLng): Point | null
  toLatLng(p: Point): LatLng | null
}

/** Build a Projector from a ready google.maps.MapCanvasProjection. */
export function makeProjector(
  projection: google.maps.MapCanvasProjection,
): Projector {
  return {
    toPixel(p) {
      const px = projection.fromLatLngToContainerPixel(
        new google.maps.LatLng(p.lat, p.lng),
      )
      return px ? { x: px.x, y: px.y } : null
    },
    toLatLng(p) {
      const ll = projection.fromContainerPixelToLatLng(
        new google.maps.Point(p.x, p.y),
      )
      return ll ? { lat: ll.lat(), lng: ll.lng() } : null
    },
  }
}

/** Project the four corners of a geo bounding box to a pixel rect. */
export function projectBounds(
  bounds: GeoBounds,
  proj: Projector,
): { x: number; y: number; width: number; height: number } | null {
  // north/west is the top-left corner in screen space; south/east bottom-right.
  const topLeft = proj.toPixel({ lat: bounds.north, lng: bounds.west })
  const bottomRight = proj.toPixel({ lat: bounds.south, lng: bounds.east })
  if (!topLeft || !bottomRight) return null
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  }
}

/** Convert a pixel rect (top-left origin) back into a geo bounding box. */
export function unprojectRect(
  rect: { x: number; y: number; width: number; height: number },
  proj: Projector,
): GeoBounds | null {
  const topLeft = proj.toLatLng({ x: rect.x, y: rect.y })
  const bottomRight = proj.toLatLng({
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  })
  if (!topLeft || !bottomRight) return null
  return {
    north: topLeft.lat,
    west: topLeft.lng,
    south: bottomRight.lat,
    east: bottomRight.lng,
  }
}

/** Offset a lat/lng by a number of meters east (dx) and south (dy). */
export function offsetMeters(origin: LatLng, dx: number, dy: number): LatLng {
  return {
    lat: origin.lat - dy / METERS_PER_DEG_LAT,
    lng: origin.lng + dx / metersPerDegLng(origin.lat),
  }
}

/** Length of a closed polygon ring in meters (for the "total path" attribute). */
export function ringPathMeters(points: LatLng[]): number {
  if (points.length < 2) return 0
  let total = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const midLat = (a.lat + b.lat) / 2
    const dx = (b.lng - a.lng) * metersPerDegLng(midLat)
    const dy = (b.lat - a.lat) * METERS_PER_DEG_LAT
    total += Math.hypot(dx, dy)
  }
  return total
}

// ---------------------------------------------------------------------------
// Vertex-model helpers (rect/frame are stored as a ring of LatLng vertices)
// ---------------------------------------------------------------------------

/** Axis-aligned geographic bounding box of a ring of vertices. */
export function boundsFromPoints(points: LatLng[]): GeoBounds {
  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity
  for (const p of points) {
    if (p.lat > north) north = p.lat
    if (p.lat < south) south = p.lat
    if (p.lng > east) east = p.lng
    if (p.lng < west) west = p.lng
  }
  return { north, south, east, west }
}

/**
 * Build a 4-vertex rectangle ring (clockwise from top-left) from a top-left
 * anchor plus a size in meters.
 */
export function rectRingFromMeters(
  topLeft: LatLng,
  widthM: number,
  heightM: number,
): LatLng[] {
  const tr = offsetMeters(topLeft, widthM, 0)
  const br = offsetMeters(topLeft, widthM, heightM)
  const bl = offsetMeters(topLeft, 0, heightM)
  return [topLeft, tr, br, bl]
}

/** Build a 4-vertex rectangle ring from a geo bounding box (clockwise). */
export function rectRingFromBounds(b: GeoBounds): LatLng[] {
  return [
    { lat: b.north, lng: b.west }, // top-left
    { lat: b.north, lng: b.east }, // top-right
    { lat: b.south, lng: b.east }, // bottom-right
    { lat: b.south, lng: b.west }, // bottom-left
  ]
}

/**
 * Re-map a ring of vertices from its current bounding box into a new bounding
 * box, scaling each vertex proportionally. Used by the 8-handle box resize so
 * an arbitrary polygon footprint can still be scaled as a unit.
 */
export function scaleRingToBounds(
  points: LatLng[],
  from: GeoBounds,
  to: GeoBounds,
): LatLng[] {
  const fromW = from.east - from.west || 1e-12
  const fromH = from.north - from.south || 1e-12
  const toW = to.east - to.west
  const toH = to.north - to.south
  return points.map((p) => {
    const u = (p.lng - from.west) / fromW
    const v = (from.north - p.lat) / fromH
    return {
      lng: to.west + u * toW,
      lat: to.north - v * toH,
    }
  })
}

/** Ray-casting point-in-polygon test (geo coords treated as a flat plane). */
export function pointInRing(p: LatLng, ring: LatLng[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng
    const yi = ring[i].lat
    const xj = ring[j].lng
    const yj = ring[j].lat
    const intersect =
      yi > p.lat !== yj > p.lat &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Midpoint of two geo points (for "add vertex" handles on edge midpoints). */
export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
}

/**
 * Round a pixel point to the nearest grid intersection. `offset` is the grid's
 * current pixel offset (so snapping aligns with a grid that pans with the map);
 * pass {x:0,y:0} for a grid pinned to the origin.
 */
export function snapPixelToGrid(
  p: Point,
  gridSize: number,
  offset: Point = { x: 0, y: 0 },
): Point {
  return {
    x: Math.round((p.x - offset.x) / gridSize) * gridSize + offset.x,
    y: Math.round((p.y - offset.y) / gridSize) * gridSize + offset.y,
  }
}
