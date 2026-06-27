/**
 * Export the drawn map to a standalone SVG string.
 *
 * Shapes are stored as a ring of geo vertices; for export we project every
 * vertex into a flat metric plane (meters east/south from the north-west corner
 * of the overall bounding box) so the SVG is self-contained and to-scale. Every
 * shape is emitted as a <polygon>; frames wrap their children in a <g>. Each
 * element carries its attributes as `data-*` so the output is queryable.
 */

import { boundsFromPoints, metersPerDegLng } from './geo'
import type { GeoBounds, LatLng, Shape } from '../types'

const METERS_PER_DEG_LAT = (Math.PI / 180) * 6_378_137

interface ExportOptions {
  /** Pixels per meter in the output SVG. */
  scale?: number
  /** Padding around the content, in meters. */
  padding?: number
}

export function exportSvg(
  shapes: Record<string, Shape>,
  order: string[],
  opts: ExportOptions = {},
): string {
  const scale = opts.scale ?? 2
  const padding = opts.padding ?? 5

  const visible = order
    .map((id) => shapes[id])
    .filter((s): s is Shape => !!s && s.visible)

  if (visible.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>`
  }

  const all = overallBounds(visible)
  const originLat = all.north
  const originLng = all.west
  const midLat = (all.north + all.south) / 2
  const mPerLng = metersPerDegLng(midLat)

  const toPlane = (p: LatLng) => ({
    x: (p.lng - originLng) * mPerLng,
    y: (originLat - p.lat) * METERS_PER_DEG_LAT,
  })

  const contentW = (all.east - all.west) * mPerLng
  const contentH = (all.north - all.south) * METERS_PER_DEG_LAT
  const totalW = (contentW + padding * 2) * scale
  const totalH = (contentH + padding * 2) * scale

  const topLevel = visible.filter((s) => s.parentId == null)
  const body = topLevel.map((s) => renderShape(s)).join('\n')

  function dataAttrs(shape: Shape): string {
    return Object.entries(shape.attributes)
      .map(([k, v]) => `data-${escAttrName(k)}="${escAttr(v)}"`)
      .join(' ')
  }

  function styleAttrs(shape: Shape): string {
    const st = shape.style
    return (
      `fill="${st.fill}" fill-opacity="${st.fillOpacity}" ` +
      `stroke="${st.stroke}" stroke-width="${st.strokeWidth / scale}"`
    )
  }

  function polygonEl(shape: Shape): string {
    const pts = shape.points
      .map(toPlane)
      .map((p) => `${fmt(p.x)},${fmt(p.y)}`)
      .join(' ')
    return `<polygon points="${pts}" ${styleAttrs(shape)} ${dataAttrs(shape)} />`
  }

  function renderShape(shape: Shape): string {
    const children = visible.filter((s) => s.parentId === shape.id)
    const el = polygonEl(shape)

    if (children.length || shape.type === 'frame') {
      const inner = children.map((c) => '    ' + renderShape(c)).join('\n')
      const label =
        shape.type === 'frame'
          ? ` data-frame-id="${escAttr(shape.id)}" data-name="${escAttr(shape.name)}"`
          : ''
      return `  <g${label}>
    ${el}${inner ? '\n' + inner : ''}
  </g>`
    }
    return '  ' + el
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(totalW)}" height="${fmt(totalH)}" viewBox="${-padding} ${-padding} ${fmt(contentW + padding * 2)} ${fmt(contentH + padding * 2)}">
${body}
</svg>`
}

function overallBounds(shapes: Shape[]): GeoBounds {
  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity
  for (const s of shapes) {
    const b = boundsFromPoints(s.points)
    if (b.north > north) north = b.north
    if (b.south < south) south = b.south
    if (b.east > east) east = b.east
    if (b.west < west) west = b.west
  }
  return { north, south, east, west }
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0'
}

function escAttr(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escAttrName(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

/** Trigger a browser download of the given SVG string. */
export function downloadSvg(svg: string, filename = 'map.svg'): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
