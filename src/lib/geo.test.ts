import { describe, expect, it } from 'vitest'
import {
  boundsFromPoints,
  midpoint,
  offsetMeters,
  pointInRing,
  rectRingFromBounds,
  rectRingFromMeters,
  ringPathMeters,
  scaleRingToBounds,
} from './geo'

describe('offsetMeters', () => {
  it('east increases lng, south decreases lat', () => {
    const o = { lat: 41, lng: 69 }
    expect(offsetMeters(o, 100, 0).lng).toBeGreaterThan(o.lng)
    expect(offsetMeters(o, 0, 100).lat).toBeLessThan(o.lat)
  })

  it('100m east at equator ≈ correct lng delta', () => {
    const p = offsetMeters({ lat: 0, lng: 0 }, 111319.49, 0)
    expect(p.lng).toBeCloseTo(1, 3)
  })
})

describe('rectRingFromMeters', () => {
  it('produces a clockwise 4-vertex ring', () => {
    const ring = rectRingFromMeters({ lat: 41.3, lng: 69.2 }, 12, 10)
    expect(ring).toHaveLength(4)
    // top-left then top-right (lng increases), then bottom (lat decreases)
    expect(ring[1].lng).toBeGreaterThan(ring[0].lng)
    expect(ring[2].lat).toBeLessThan(ring[1].lat)
  })

  it('perimeter of a 12x10m ring ≈ 44m', () => {
    const ring = rectRingFromMeters({ lat: 41.3, lng: 69.2 }, 12, 10)
    expect(ringPathMeters(ring)).toBeCloseTo(44, 0)
  })
})

describe('boundsFromPoints', () => {
  it('computes the axis-aligned bbox', () => {
    const b = boundsFromPoints([
      { lat: 2, lng: 1 },
      { lat: 3, lng: 5 },
      { lat: 1, lng: 4 },
    ])
    expect(b).toEqual({ north: 3, south: 1, east: 5, west: 1 })
  })
})

describe('scaleRingToBounds', () => {
  it('maps a ring from one bbox into another proportionally', () => {
    const from = { north: 2, south: 0, east: 2, west: 0 }
    const to = { north: 4, south: 0, east: 4, west: 0 } // 2x bigger
    const ring = rectRingFromBounds(from)
    const scaled = scaleRingToBounds(ring, from, to)
    // top-left stays at (north,west) corner of new bounds
    expect(scaled[0]).toEqual({ lat: 4, lng: 0 })
    // bottom-right maps to (south,east) corner
    expect(scaled[2]).toEqual({ lat: 0, lng: 4 })
  })
})

describe('pointInRing', () => {
  const square = [
    { lat: 1, lng: 0 },
    { lat: 1, lng: 1 },
    { lat: 0, lng: 1 },
    { lat: 0, lng: 0 },
  ]
  it('detects inside', () => {
    expect(pointInRing({ lat: 0.5, lng: 0.5 }, square)).toBe(true)
  })
  it('detects outside', () => {
    expect(pointInRing({ lat: 2, lng: 2 }, square)).toBe(false)
  })
})

describe('midpoint', () => {
  it('averages two points', () => {
    expect(midpoint({ lat: 0, lng: 0 }, { lat: 2, lng: 4 })).toEqual({
      lat: 1,
      lng: 2,
    })
  })
})

describe('ringPathMeters', () => {
  it('closed square 100x100 ≈ 400m', () => {
    const o = { lat: 0, lng: 0 }
    const ring = [
      offsetMeters(o, 0, 0),
      offsetMeters(o, 100, 0),
      offsetMeters(o, 100, 100),
      offsetMeters(o, 0, 100),
    ]
    expect(ringPathMeters(ring)).toBeCloseTo(400, 0)
  })
})
